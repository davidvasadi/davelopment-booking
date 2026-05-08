import { NotFoundPage } from '@payloadcms/next/views'
import config from '@payload-config'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, importMap: {}, params, searchParams })

export default NotFound
