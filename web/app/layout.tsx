import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '0G INFT Platform - AI Agent NFTs',
  description: 'Create, manage and trade AI agents as NFTs on 0G Network',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
            <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center">
                    <a href="/" className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">0G</span>
                      </div>
                      <span className="text-xl font-bold text-white">INFT Platform</span>
                    </a>
                    <nav className="ml-10 flex space-x-8">
                      <a href="/mint" className="text-gray-300 hover:text-white transition-colors">
                        Mint Agent
                      </a>
                      <a href="/agents" className="text-gray-300 hover:text-white transition-colors">
                        My Agents
                      </a>
                      <a href="/marketplace" className="text-gray-300 hover:text-white transition-colors">
                        Marketplace
                      </a>
                    </nav>
                  </div>
                  <div id="connect-button-container" />
                </div>
              </div>
            </nav>
            <main>{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
