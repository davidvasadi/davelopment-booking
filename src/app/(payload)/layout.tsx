import type React from 'react'
import { RootLayout } from '@payloadcms/next/layouts'
import { handleServerFunctions } from '@payloadcms/next/layouts'
import config from '@payload-config'
import '@payloadcms/next/css'

type Args = {
  children: React.ReactNode
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverFn = async function serverFn(args: any) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap: {} })
}

const Layout = ({ children }: Args) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <RootLayout config={config} importMap={{}} serverFunction={serverFn as any}>
    {children}
  </RootLayout>
)

export default Layout
