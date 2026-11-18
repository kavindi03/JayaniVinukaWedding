import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Heart, ImagePlus, Trash2, X } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase, urlOf, COUPLE, Photo } from '../lib/supabase'
import { compress } from '../lib/compress'

export default function Guest() {
  const { table } = useParams()
  const [guestId, setGuestId] = useState('')
  const [authLoading, setAuthLoading] = useState(true)
  const [name, setName] = useState(localStorage.getItem('gname') || '')
  const [caption, setCaption] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selected, setSelected] = useState<Photo | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function initializeGuest() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      let user = sessionData.session?.user ?? null
      if (!user) {
        const { data, error: signInError } = await supabase.auth.signInAnonymously()
        if (signInError) throw signInError
        user = data.user
      }
      if (!user) throw new Error('Could not establish a guest session.')
      if (active) setGuestId(user.id)
    }

    initializeGuest()
      .catch(reason => {
        const message = reason instanceof Error ? reason.message : 'Could not start a guest session.'
        const lowerMessage = message.toLowerCase()
        if (lowerMessage.includes('signups not allowed') || lowerMessage.includes('signup is disabled')) {
          setError('Supabase is blocking new guest sessions. In Authentication settings, turn on “Allow new users to sign up” and enable the Anonymous Sign-Ins provider. Guests still do not need to register.')
        } else if (lowerMessage.includes('anonymous sign-ins are disabled') || lowerMessage.includes('anonymous provider')) {
          setError('Guest uploads are disabled in Supabase. In Authentication → Sign In / Providers, enable Anonymous Sign-Ins. Guests do not need to register.')
        } else {
          setError(message)
        }
      })
      .finally(() => { if (active) setAuthLoading(false) })

    return () => { active = false }
  }, [])

  async function loadGallery() {
    const photoResult = await supabase.from('photos').select('*').order('created_at', { ascending: false })
    if (photoResult.error) throw photoResult.error
    setPhotos((photoResult.data as Photo[]) || [])
  }

  useEffect(() => {
    if (!guestId) return
    loadGallery().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load photos.'))
  }, [guestId])

  useEffect(() => {
    if (!selected) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selected])

  async function onFiles(files: FileList | null) {
    if (!files?.length || !guestId) return
    setError('')
    localStorage.setItem('gname', name)
    const selectedFiles = Array.from(files)
    const failures: string[] = []
    let uploaded = 0
    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]
        setBusy(`Uploading photo ${index + 1} of ${selectedFiles.length}…`)
        let path = ''
        try {
          path = `t${table}/${crypto.randomUUID()}.jpg`
          const upload = await supabase.storage.from('memories').upload(path, await compress(file), { contentType: 'image/jpeg' })
          if (upload.error) throw upload.error

          const { error: insertError } = await supabase.from('photos').insert({
            table_no: Number(table),
            guest_name: name || 'A guest',
            guest_id: guestId,
            path,
            caption: caption || null
          })
          if (insertError) {
            const { error: cleanupError } = await supabase.storage.from('memories').remove([path])
            if (cleanupError) throw new Error(`${insertError.message} (Could not clean up uploaded file: ${cleanupError.message})`)
            throw insertError
          }
          uploaded += 1
        } catch (reason) {
          failures.push(`${file.name}: ${reason instanceof Error ? reason.message : 'upload failed'}`)
        }
      }
      setCaption('')
      if (uploaded) {
        confetti({ particleCount: 120, spread: 80, colors: ['#f3a6bd', '#f7d8e2', '#ffffff'] })
        await loadGallery()
      }
      if (failures.length) {
        setError(`${uploaded} of ${selectedFiles.length} photos uploaded. ${failures.join(' · ')}`)
      }
    } catch (reason) {
      setError(`Uploaded ${uploaded} photo${uploaded === 1 ? '' : 's'}, but could not refresh the gallery: ${reason instanceof Error ? reason.message : 'unknown error'}`)
    } finally {
      setBusy('')
    }
  }

  async function removePhoto(photo: Photo) {
    if (photo.guest_id !== guestId || !confirm('Remove your photo from the gallery?')) return
    setError('')
    try {
      const { error: storageError } = await supabase.storage.from('memories').remove([photo.path])
      if (storageError) throw storageError
      const { error: deleteError } = await supabase.from('photos').delete().eq('id', photo.id)
      if (deleteError) throw deleteError
      if (selected?.id === photo.id) setSelected(null)
      await loadGallery()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove your photo.')
    }
  }

  return (
    <main className="wrap">
      <motion.header className="hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
        <Heart className="pulse" size={28} />
        <h1>{COUPLE}</h1>
        <p>Share a moment from today</p>
      </motion.header>

      <section className="card">
        <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Add a wish or caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
        <label className={`btn${authLoading || !guestId || !!busy ? ' disabled' : ''}`}>
          <Camera size={20} /> {busy || 'Take or choose photos'}
          <input type="file" accept="image/*" multiple hidden disabled={authLoading || !guestId || !!busy} onChange={e => { void onFiles(e.target.files); e.currentTarget.value = '' }} />
        </label>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="gallery-heading">
        <div>
          <h2>Wedding memories</h2>
          <p>Every photo shared by your guests, in one place.</p>
        </div>
        <span className="latest-label">Latest uploads</span>
      </section>
      {!photos.length && !error && <p className="empty"><ImagePlus size={18} /> No photos yet — be the first to share a memory.</p>}
      <div className="grid">
        <AnimatePresence>
          {photos.map(photo => (
              <motion.figure key={photo.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <button className="photo-open" onClick={() => setSelected(photo)} aria-label={`View photo from ${photo.guest_name}`}>
                  <img src={urlOf(photo.path)} loading="lazy" alt={photo.caption || `Shared by ${photo.guest_name}`} />
                </button>
                <figcaption>
                  <span>{photo.caption || `Shared by ${photo.guest_name}`}</span>
                </figcaption>
                <div className="acts">
                  {photo.guest_id === guestId && (
                    <button className="delete-button" onClick={() => void removePhoto(photo)} aria-label="Remove your photo">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </motion.figure>
          ))}
        </AnimatePresence>
      </div>

      {selected && (
        <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Full-size photo" onClick={() => setSelected(null)}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close photo">
            <X size={28} />
          </button>
          <img src={urlOf(selected.path)} alt={selected.caption || `Shared by ${selected.guest_name}`} onClick={event => event.stopPropagation()} />
          <p>{selected.caption || `Shared by ${selected.guest_name}`}</p>
        </div>
      )}
    </main>
  )
}
