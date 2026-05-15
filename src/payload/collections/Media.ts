import path from 'path'
import { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
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
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/tiff',
    ],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 100,
        height: 100,
        crop: 'center',
      },
      {
        name: 'small',
        width: 300,
        height: 300,
        crop: 'center',
      },
      {
        name: 'medium',
        width: 600,
        height: 600,
        crop: 'center',
      },
      {
        name: 'large',
        width: 1200,
        height: 1200,
        crop: 'center',
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
