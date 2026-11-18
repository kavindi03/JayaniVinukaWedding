// Shrinks phone photos (~5MB) to ~300KB so the free 1GB holds 3000+ photos
export async function compress(file: File, max = 1600, q = 0.72): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = img.width * s; c.height = img.height * s
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(b => r(b!), 'image/jpeg', q))
}
