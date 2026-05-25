import path from 'path'
import { CollectionConfig } from 'payload'

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
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt szöveg',
    },
  ],
}
