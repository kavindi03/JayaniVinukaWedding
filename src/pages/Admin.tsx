import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Trash2, Play, X, Printer } from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { supabase, urlOf, COUPLE, Photo } from '../lib/supabase'

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filter, setFilter] = useState(0)
  const [tables, setTables] = useState(10)
  const [show, setShow] = useState(false)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError
        setSession(data.session)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load your session.'))
  }, [])

  const load = async () => {
    const photoResult = await supabase.from('photos').select('*').order('created_at', { ascending: false })
    if (photoResult.error) throw photoResult.error
    setPhotos((photoResult.data as Photo[]) || [])
  }

  useEffect(() => {
    if (session) load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load photos.'))
  }, [session])

  useEffect(() => {
    if (!show) return
    const timer = setInterval(() => setIdx(current => current + 1), 4000)
    return () => clearInterval(timer)
  }, [show])

  const list = filter ? photos.filter(photo => photo.table_no === filter) : photos
  const base = location.origin + location.pathname

  async function remove(photo: Photo) {
    if (photo.guest_id !== session?.user.id || !confirm('Remove your photo from the gallery?')) return
    setError('')
    const { error: storageError } = await supabase.storage.from('memories').remove([photo.path])
    if (storageError) { setError(storageError.message); return }
    const { error: deleteError } = await supabase.from('photos').delete().eq('id', photo.id)
    if (deleteError) { setError(deleteError.message); return }
    if (selected?.id === photo.id) setSelected(null)
    load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not refresh photos.'))
  }

  async function login() {
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (loginError) setError(loginError.message)
    else { setError(''); setSession(data.session) }
  }

  if (!session) return (
    <main className="wrap">
      <section className="card">
        <h1>Couple login</h1>
        <input placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} />
        <input placeholder="Password" type="password" value={pw} onChange={event => setPw(event.target.value)} />
        <button className="btn" onClick={() => void login()}>Sign in</button>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
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
              <figcaption>{photo.guest_name}{photo.caption ? ` — ${photo.caption}` : ''}</figcaption>
              <div className="acts">
                <a href={urlOf(photo.path)} download target="_blank" rel="noreferrer" aria-label="Download photo"><Download size={16} /></a>
                {photo.guest_id === session.user.id && (
                  <button className="delete-button" onClick={() => void remove(photo)} aria-label="Remove your photo"><Trash2 size={16} /></button>
                )}
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
          <p>{list[idx % list.length].guest_name}</p>
          <button className="close" onClick={() => setShow(false)} aria-label="Close slideshow"><X size={28} /></button>
        </div>
      )}

      {selected && (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Full-size photo" onClick={() => setSelected(null)}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close photo"><X size={28} /></button>
          <img src={urlOf(selected.path)} alt={selected.caption || `Shared by ${selected.guest_name}`} onClick={event => event.stopPropagation()} />
          <p>{selected.caption || `Shared by ${selected.guest_name}`}</p>
        </div>
      )}
    </main>
  )
}
