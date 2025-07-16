// web/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/navbar'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '0G INFT Platform - AI Agent NFTs',
  description: 'Create, own, and trade intelligent NFTs on the decentralized 0G Network',
  keywords: '0G, NFT, AI, blockchain, decentralized, agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="min-h-screen bg-white">
            <Navbar />
            <main>{children}</main>
            
            {/* Footer */}
            <footer className="bg-gray-50 border-t border-gray-200 mt-20">
              <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      0G INFT
                    </h3>
                    <p className="text-sm text-gray-600">
                      Building the future of intelligent NFTs on the 0G Network
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Platform</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li><a href="/mint" className="hover:text-purple-600 transition">Mint Agent</a></li>
                      <li><a href="/marketplace" className="hover:text-purple-600 transition">Marketplace</a></li>
                      <li><a href="/agents" className="hover:text-purple-600 transition">My Agents</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Resources</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li><a href="https://docs.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition">Documentation</a></li>
                      <li><a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition">Faucet</a></li>
                      <li><a href="https://chainscan-galileo.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition">Explorer</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Community</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li><a href="#" className="hover:text-purple-600 transition">Discord</a></li>
                      <li><a href="#" className="hover:text-purple-600 transition">Twitter</a></li>
                      <li><a href="#" className="hover:text-purple-600 transition">Telegram</a></li>
                    </ul>
                  </div>
                </div>
                <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
                  <p>&copy; 2025 0G INFT Platform. Built with ❤️ on 0G Network</p>
                </div>
              </div>
            </footer>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
