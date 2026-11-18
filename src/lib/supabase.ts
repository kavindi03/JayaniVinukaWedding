import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export type Photo = { id: string; table_no: number; guest_name: string; guest_id: string; path: string; caption: string | null; created_at: string }
export const urlOf = (p: string) => supabase.storage.from('memories').getPublicUrl(p).data.publicUrl
export const COUPLE = import.meta.env.VITE_COUPLE_NAMES || 'Our Wedding'
