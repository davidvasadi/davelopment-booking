import { compressImage } from '@/lib/compressImage'
import type { UploadState } from '@/components/blocks/upload'

/** Kép feltöltése a Media gyűjteménybe (tömörítve) — a szolgáltatás-, kategória-, munkatárs-kép és a dokumentumok is.
 *  `onProgress`: a feltöltés állapota a design 21.6.2 szerint (helyi előnézet, százalék, majd „Kicsinyítés”, amíg a szerver
 *  feldolgozza). Visszaadja az új média azonosítóját és URL-jét; hibánál kivételt dob (a hiba oka a message-ben). */
export async function uploadMedia(file: File, onProgress?: (s: UploadState) => void): Promise<{ id: number; url: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Csak kép tölthető fel (JPG, PNG, WebP, HEIC).')
  if (file.size > 15 * 1024 * 1024) throw new Error(`Túl nagy (${Math.round(file.size / 1024 / 1024)} MB, legfeljebb 15 MB). Próbáld kisebb méretben, vagy készíts képernyőképet róla.`)
  const src = URL.createObjectURL(file)
  onProgress?.({ src, pct: 0, proc: false })
  const fd = new FormData()
  fd.append('file', await compressImage(file))
  fd.set('_payload', JSON.stringify({ alt: file.name }))
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media')
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      const pct = Math.round((e.loaded / e.total) * 100)
      onProgress?.({ src, pct, proc: pct >= 100 })
    }
    xhr.upload.onload = () => onProgress?.({ src, pct: 100, proc: true })
    xhr.onload = () => {
      let json: { doc?: { id: number; url: string }; errors?: { message?: string }[] } | null = null
      try { json = JSON.parse(xhr.responseText) } catch { /* nem JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && json?.doc) resolve({ id: json.doc.id, url: json.doc.url })
      else reject(new Error(json?.errors?.[0]?.message ?? 'A feltöltés nem sikerült. Próbáld újra.'))
    }
    xhr.onerror = () => reject(new Error('Megszakadt a kapcsolat feltöltés közben. Próbáld újra.'))
    xhr.send(fd)
  })
}
