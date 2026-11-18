import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function secretsMatch(supplied: string, expected: string) {
  const suppliedBytes = new TextEncoder().encode(supplied)
  const expectedBytes = new TextEncoder().encode(expected)
  if (suppliedBytes.length !== expectedBytes.length) return false
  let difference = 0
  for (let index = 0; index < suppliedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' })

  const accessToken = Deno.env.get('COUPLE_ACCESS_TOKEN')
  if (!accessToken || accessToken.length < 32) {
    return respond(500, { error: 'The couple access token is not configured correctly.' })
  }
  const suppliedToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!secretsMatch(suppliedToken, accessToken)) {
    return respond(401, { error: 'This couple link is invalid.' })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' })
  }
  if (!body || typeof body !== 'object') return respond(400, { error: 'Invalid request body.' })

  const payload = body as Record<string, unknown>
  if (payload.action === 'verify') return respond(200, { authorized: true })
  if (payload.action !== 'delete' || typeof payload.photoId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.photoId)) {
    return respond(400, { error: 'A valid photo ID is required.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(500, { error: 'Supabase server credentials are not configured.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: photo, error: lookupError } = await admin
    .from('photos')
    .select('id, path')
    .eq('id', payload.photoId)
    .maybeSingle()
  if (lookupError) return respond(500, { error: `Could not find the photo: ${lookupError.message}` })
  if (!photo) return respond(404, { error: 'Photo not found.' })

  const { error: deleteError } = await admin.from('photos').delete().eq('id', photo.id)
  if (deleteError) return respond(500, { error: `Could not delete the photo record: ${deleteError.message}` })

  const { error: storageError } = await admin.storage.from('memories').remove([photo.path])
  if (storageError) {
    return respond(200, {
      deleted: true,
      warning: `Photo removed from the gallery, but file cleanup failed: ${storageError.message}`
    })
  }
  return respond(200, { deleted: true })
})
