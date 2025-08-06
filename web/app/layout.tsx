// web/app/layout.tsx
'use client'

import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useMetadataSync } from '@/hooks/useMetadataSync'

// Use system fonts instead of Google Fonts to avoid network issues
const fontClassName = 'font-sans'

// Metadata нужно вынести в отдельный layout для серверных компонентов
// export const metadata: Metadata = {
//   title: '0G INFT Platform',
//   description: 'Create and manage AI agents as NFTs',
// }


function Navigation() {
  const pathname = usePathname()
  
  const isActive = (path: string) => {
    return pathname === path
  }
  
  return (
    <nav className="bg-gray-900/90 backdrop-blur-sm shadow-lg sticky top-0 z-50 border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-white">
              0G INFT
            </Link>
            
            <div className="hidden md:flex space-x-6">
              <Link 
                href="/" 
                className={pathname === '/' 
                  ? 'text-purple-400 font-medium' 
                  : 'text-white/80 hover:text-white'
                }
              >
                Home
              </Link>
              <Link 
                href="/mint" 
                className={pathname === '/mint' 
                  ? 'text-purple-400 font-medium' 
                  : 'text-white/80 hover:text-white'
                }
              >
                Mint Agent
              </Link>
              <Link 
                href="/agents" 
                className={pathname === '/agents' 
                  ? 'text-purple-400 font-medium' 
                  : 'text-white/80 hover:text-white'
                }
              >
                My Agents
              </Link>
              <Link 
                href="/marketplace" 
                className={pathname === '/marketplace' 
                  ? 'text-purple-400 font-medium' 
                  : 'text-white/80 hover:text-white'
                }
              >
                Marketplace
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Автоматическая синхронизация метаданных каждые 5 минут
  useMetadataSync(true, 5)
  
  // Устанавливаем title через useEffect для клиентского компонента
  useEffect(() => {
    document.title = '0G INFT Platform'
  }, [])
  
  return (
    <html lang="en">
      <head>
        <meta name="description" content="Create and manage AI agents as NFTs" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body 
        className={`${fontClassName} bg-gray-950`}
        style={{
          background: 'linear-gradient(135deg, #581c87 0%, #1e3a8a 50%, #312e81 100%)',
          minHeight: '100vh'
        }}
      >
        <Providers>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
