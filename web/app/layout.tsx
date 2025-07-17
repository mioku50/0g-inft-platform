// web/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '0G INFT Platform',
  description: 'Create and manage AI agents as NFTs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {/* Упрощенная навигация */}
          <nav className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-8">
                  <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl">🐼</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      0G INFT
                    </span>
                  </Link>
                  
                  <div className="hidden md:flex items-center gap-6">
                    <Link 
                      href="/" 
                      className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                    >
                      Home
                    </Link>
                    <Link 
                      href="/mint" 
                      className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                    >
                      Mint Agent
                    </Link>
                    <Link 
                      href="/agents" 
                      className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                    >
                      My Agents
                    </Link>
                    <Link 
                      href="/marketplace" 
                      className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                    >
                      Marketplace
                    </Link>
                  </div>
                </div>
                
                <ConnectButton />
              </div>
            </div>
          </nav>
          
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}