// web/app/providers.tsx
'use client'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import '@rainbow-me/rainbowkit/styles.css'
import { useEffect, useState } from 'react'

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

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  )
}