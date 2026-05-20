import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'HurryOps · Chofer',
  description: 'App de ruta para choferes',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HurryOps',
  },
}

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
