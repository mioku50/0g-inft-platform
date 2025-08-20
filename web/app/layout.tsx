// web/app/layout.tsx
'use client'

import './globals.css'
import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import { Providers } from './providers'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useMetadataSync } from '@/hooks/useMetadataSync'

// const inter = Inter({ subsets: ['latin'] })

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
    <nav className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl">🐼</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                0G INFT
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link 
                href="/" 
                className={`font-medium transition-colors ${
                  isActive('/') 
                    ? 'text-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Home
              </Link>
              <Link 
                href="/mint" 
                className={`font-medium transition-colors ${
                  isActive('/mint') 
                    ? 'text-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Mint Agent
              </Link>
              <Link 
                href="/agents" 
                className={`font-medium transition-colors ${
                  isActive('/agents') 
                    ? 'text-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                My Agents
              </Link>
              <Link 
                href="/marketplace" 
                className={`font-medium transition-colors ${
                  isActive('/marketplace') 
                    ? 'text-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                Marketplace
              </Link>
            </div>
          </div>
          
          <ConnectButton />
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
      <body className="font-sans">
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
