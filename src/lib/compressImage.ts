/**
 * Client-side image compression using Canvas API.
 * SVG files are returned as-is (can't be rasterised).
 * Output: WebP at the given quality, max maxPx × maxPx (never upscaled).
 */
export async function compressImage(
  file: File,
  maxPx = 2000,
  quality = 0.82,
): Promise<File> {
  if (file.type === 'image/svg+xml') return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('a böngésző nem tudta feldolgozni a képet')); return }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('a kép tömörítése nem sikerült')); return }
          const name = file.name.replace(/\.[^.]+$/, '.webp')
          resolve(new File([blob], name, { type: 'image/webp' }))
        },
        'image/webp',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('a kép nem olvasható be — nem támogatott formátum (pl. HEIC)? Próbáld JPG vagy PNG fájllal'))
    }

    img.src = url
  })
}
