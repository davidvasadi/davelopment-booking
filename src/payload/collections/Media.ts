import path from 'path'
import type { CollectionConfig } from 'payload'

// Dev-ben a Payload a feltöltés pillanatában érvényes serverURL-t menti az adatbázisba.
// Ha portot váltottunk (pl. 3000→3001), a tárolt URL-ek elavulnak. Ez a hook minden
// Media-olvasáskor normalizálja az URL-eket az aktuális NEXT_PUBLIC_APP_URL-re.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const fixUrl = (url: string | null | undefined): string | null | undefined => {
  if (!url || process.env.NODE_ENV !== 'development') return url
  if (!/^http:\/\/localhost:\d+/.test(url)) return url
  return url.replace(/^http:\/\/localhost:\d+/, APP_URL)
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Médiafájl', plural: 'Médiatár' },
  admin: {
    group: 'Rendszer',
    useAsTitle: 'filename',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  upload: {
    staticDir: path.join(process.cwd(), 'public/uploads'),
    // A felhasználó bármilyen elterjedt képformátumot feltölthet; a Sharp minden
    // generált változatot (és magát az eredetit is) WebP-re konvertál — ez a
    // legjobb minőség/méret arány a Google PageSpeed és a szerver sebessége szempontjából.
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/tiff',
      'image/avif',
      'image/heic',
      'image/heif',
    ],
    // Az eredeti feltöltött fájl is WebP-re konvertálódik és max 2000px-re szűkül
    // (felfelé sosem nagyít), így nem marad többMB-os nyers fotó a szerveren.
    formatOptions: {
      format: 'webp',
      options: { quality: 82 },
    },
    resizeOptions: {
      width: 2000,
      height: 2000,
      fit: 'inside',
      withoutEnlargement: true,
    },
    imageSizes: [
      // A négyzetes thumbnail az admin listanézethez kell (fix méret, középre vágva).
      {
        name: 'thumbnail',
        width: 100,
        height: 100,
        crop: 'center',
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      // A többi méret arányosan méreteződik (nincs height → nincs torzítás/levágás).
      {
        name: 'small',
        width: 300,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'medium',
        width: 600,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'large',
        width: 1200,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (process.env.NODE_ENV !== 'development') return doc
        if (doc.url) doc.url = fixUrl(doc.url)
        if (doc.thumbnailURL) doc.thumbnailURL = fixUrl(doc.thumbnailURL)
        if (doc.sizes && typeof doc.sizes === 'object') {
          for (const size of Object.values(doc.sizes as Record<string, { url?: string | null }>)) {
            if (size?.url) size.url = fixUrl(size.url) ?? size.url
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt szöveg',
    },
  ],
}
