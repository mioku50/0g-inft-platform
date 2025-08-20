import './globals.css'
import dynamic from 'next/dynamic'

const Providers = dynamic(() => import('./providers').then(mod => ({ default: mod.Providers })), { ssr: false })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>0G INFT Platform</title>
        <meta name="description" content="Create and manage AI agents as NFTs" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans">
        <Providers>
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
