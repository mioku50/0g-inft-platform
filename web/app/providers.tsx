'use client'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { RainbowKitProvider, getDefaultWallets, ConnectButton } from '@rainbow-me/rainbowkit'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import '@rainbow-me/rainbowkit/styles.css'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMetadataSync } from '@/hooks/useMetadataSync'

// Определяем 0G Network
const ogNetwork = {
  id: 16601,
  name: '0G-Galileo-Testnet',
  network: '0g-testnet',
  nativeCurrency: {
    decimals: 18,
    name: '0G',
    symbol: 'OG',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
    public: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
  },
  blockExplorers: {
    default: { 
      name: '0G Explorer', 
      url: 'https://chainscan-galileo.0g.ai' 
    },
  },
  testnet: true,
}

const { chains, publicClient } = configureChains(
  [ogNetwork],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: chain.rpcUrls.default.http[0],
      }),
    }),
  ]
)

const { connectors } = getDefaultWallets({
  appName: '0G INFT Platform',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '98b3feb7c073aaa813638123c8fdb523',
  chains,
})

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

function Navigation() {
  const pathname = usePathname()
  
  const isActive = (path: string) => {
    return pathname === path
  }
  
  return (
    <nav className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl">🐼</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                0G INFT
              </span>
            </a>
            
            <div className="hidden md:flex items-center gap-6">
              <a 
                href="/" 
                aria-current={isActive('/') ? 'page' : undefined}
                className={`relative px-3 py-1.5 rounded-lg transition-all font-medium ${
                  isActive('/')
                    ? 'font-semibold text-gray-900 dark:text-white bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 ring-1 ring-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:ring-1 hover:ring-purple-400/30'
                }`}
              >
                Home
              </a>
              <a 
                href="/mint" 
                aria-current={isActive('/mint') ? 'page' : undefined}
                className={`relative px-3 py-1.5 rounded-lg transition-all font-medium ${
                  isActive('/mint')
                    ? 'font-semibold text-gray-900 dark:text-white bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 ring-1 ring-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:ring-1 hover:ring-purple-400/30'
                }`}
              >
                Mint Agent
              </a>
              <a 
                href="/agents" 
                aria-current={isActive('/agents') ? 'page' : undefined}
                className={`relative px-3 py-1.5 rounded-lg transition-all font-medium ${
                  isActive('/agents')
                    ? 'font-semibold text-gray-900 dark:text-white bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 ring-1 ring-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:ring-1 hover:ring-purple-400/30'
                }`}
              >
                My Agents
              </a>
              <a 
                href="/marketplace" 
                aria-current={isActive('/marketplace') ? 'page' : undefined}
                className={`relative px-3 py-1.5 rounded-lg transition-all font-medium ${
                  isActive('/marketplace')
                    ? 'font-semibold text-gray-900 dark:text-white bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 ring-1 ring-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:ring-1 hover:ring-purple-400/30'
                }`}
              >
                Marketplace
              </a>
            </div>
          </div>
          
          <ConnectButton />
        </div>
      </div>
    </nav>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  // Автоматическая синхронизация метаданных каждые 5 минут
  useMetadataSync(true, 5)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <Navigation />
        <div className="relative z-10">
          {children}
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}