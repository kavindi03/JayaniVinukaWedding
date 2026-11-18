import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Trash2, Play, X, Printer } from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, urlOf, COUPLE, Photo } from '../lib/supabase'

async function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof FunctionsHttpError && reason.context instanceof Response) {
    const body: unknown = await reason.context.json().catch(() => null)
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  }
  return reason instanceof Error ? reason.message : fallback
}

export default function Admin() {
  const [searchParams] = useSearchParams()
  const accessToken = searchParams.get('key') || ''
  const [authorized, setAuthorized] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filter, setFilter] = useState(0)
  const [tables, setTables] = useState(10)
  const [show, setShow] = useState(false)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function verifyLink() {
      try {
        if (!accessToken) throw new Error('This couple link is missing its access key.')
        const { error: verifyError } = await supabase.functions.invoke('couple-delete-photo', {
          body: { action: 'verify' },
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (verifyError) throw verifyError
        if (active) setAuthorized(true)
      } catch (reason) {
        if (active) setError(await errorMessage(reason, 'Could not verify the couple link.'))
      } finally {
        if (active) setAuthLoading(false)
      }
    }

    void verifyLink()
    return () => { active = false }
  }, [accessToken])

  const load = async () => {
    const photoResult = await supabase.from('photos').select('*').order('created_at', { ascending: false })
    if (photoResult.error) throw photoResult.error
    setPhotos((photoResult.data as Photo[]) || [])
  }

  useEffect(() => {
    if (authorized) load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load photos.'))
  }, [authorized])

  useEffect(() => {
    if (!show) return
    const timer = setInterval(() => setIdx(current => current + 1), 4000)
    return () => clearInterval(timer)
  }, [show])

  const list = filter ? photos.filter(photo => photo.table_no === filter) : photos
  const base = location.origin + location.pathname

  async function downloadPhoto(photo: Photo) {
    setError('')
    try {
      const response = await fetch(urlOf(photo.path))
      if (!response.ok) throw new Error(`The photo request failed (${response.status}).`)
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = photo.path.split('/').pop() || 'wedding-memory.jpg'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (reason) {
      setError(`Could not download photo: ${reason instanceof Error ? reason.message : 'unknown error'}`)
    }
  }

  async function remove(photo: Photo) {
    if (!authorized) {
      setError('The couple link is not authorized to delete photos.')
      return
    }
    if (!confirm('Delete this photo for everyone?')) return
    setError('')
    try {
      const { data, error: deleteError } = await supabase.functions.invoke<{ deleted: boolean; warning?: string }>('couple-delete-photo', {
        body: { action: 'delete', photoId: photo.id },
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (deleteError) throw deleteError
      if (!data?.deleted) throw new Error('The server did not confirm photo deletion.')
      if (selected?.id === photo.id) setSelected(null)
      await load()
      if (data.warning) setError(data.warning)
    } catch (reason) {
      setError(`Could not delete photo: ${await errorMessage(reason, 'unknown error')}`)
    }
  }

  if (authLoading) return (
    <main className="wrap">
      <section className="card"><h1>Couple gallery</h1><p>Checking your access link…</p></section>
    </main>
  )

  if (!authorized) return (
    <main className="wrap">
      <section className="card">
        <h1>Couple link unavailable</h1>
        <p>{error || 'This link is not authorized.'}</p>
      </section>
    </main>
  )

  if (error && photos.length === 0) return (
    <main className="wrap">
      <section className="card"><h1>Couple gallery</h1><p className="error" role="alert">{error}</p></section>
    </main>
  )

  return (
    <main className="wrap wide">
      <h1>{COUPLE} · {photos.length} memories</h1>
      <div className="bar">
        <select value={filter} onChange={event => setFilter(+event.target.value)}>
          <option value={0}>All tables</option>
          {[...new Set(photos.map(photo => photo.table_no))].sort((a, b) => a - b).map(tableNo => <option key={tableNo} value={tableNo}>Table {tableNo}</option>)}
        </select>
        <button className="btn" onClick={() => { setIdx(0); setShow(true) }}><Play size={16} /> Slideshow</button>
        <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print QR cards</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="grid">
        {list.map(photo => (
          <figure key={photo.id}>
            <button className="photo-open" onClick={() => setSelected(photo)} aria-label={`View photo from ${photo.guest_name}`}>
              <img src={urlOf(photo.path)} loading="lazy" alt={photo.caption || `Shared by ${photo.guest_name}`} />
            </button>
            <figcaption>Table {photo.table_no} · {photo.guest_name}{photo.caption ? ` — ${photo.caption}` : ''}</figcaption>
            <div className="acts">
              <button onClick={() => void downloadPhoto(photo)} aria-label="Download photo"><Download size={16} /></button>
              <button className="delete-button" onClick={() => void remove(photo)} aria-label="Delete photo"><Trash2 size={16} /></button>
            </div>
          </figure>
        ))}
      </div>

      <section className="qrs">
        <h2>Table QR codes <input type="number" min={1} value={tables} onChange={event => setTables(+event.target.value)} /></h2>
        <div className="qrgrid">
          {Array.from({ length: tables }, (_, index) => index + 1).map(tableNo => (
            <div className="qrcard" key={tableNo}>
              <QRCodeSVG value={`${base}#/t/${tableNo}`} size={150} fgColor="#C65E83" />
              <b>Table {tableNo}</b><small>Scan to share your photos</small>
            </div>
          ))}
        </div>
      </section>

      {show && list.length > 0 && (
        <div className="slides" onClick={() => setShow(false)}>
          <img src={urlOf(list[idx % list.length].path)} alt="Wedding slideshow" />
          <p>{list[idx % list.length].guest_name} · Table {list[idx % list.length].table_no}</p>
          <button className="close" onClick={() => setShow(false)} aria-label="Close slideshow"><X size={28} /></button>
        </div>
      )}

      {selected && (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Full-size photo" onClick={() => setSelected(null)}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close photo"><X size={28} /></button>
          <img src={urlOf(selected.path)} alt={selected.caption || `Shared by ${selected.guest_name}`} onClick={event => event.stopPropagation()} />
          <p>{selected.caption || `Shared by ${selected.guest_name}`} · Table {selected.table_no}</p>
        </div>
      )}
    </main>
  )
}