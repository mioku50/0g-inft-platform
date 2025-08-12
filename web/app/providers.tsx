// web/app/providers.tsx
'use client'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets'
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import '@rainbow-me/rainbowkit/styles.css'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Load ComputeProvider on client only
const ComputeProvider = dynamic(
  () => import('@/lib/compute/ComputeProvider'),
  { ssr: false }
)

// Определяем 0G Network
const ogNetwork = {
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '16601'),
  name: '0G-Galileo-Testnet',
  network: '0g-testnet',
  nativeCurrency: {
    decimals: 18,
    name: '0G',
    symbol: 'OG',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc-testnet.0g.ai'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc-testnet.0g.ai'],
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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '98b3feb7c073aaa813638123c8fdb523'
const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet({ projectId, chains }),
    ],
  },
])

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

  useEffect(() => {
    // SDK pre-warming with delayed execution to avoid HMR conflicts
    const warmupTimer = setTimeout(() => {
      import('@/lib/compute/clientBroker')
        .then((m) => m.loadSdk?.())
        .then(() => console.log('[Providers] SDK pre-warmed successfully'))
        .catch((e) => console.log('[Providers] SDK pre-warm failed:', e.message))
    }, 1000) // 1 second delay to let the app settle

    return () => clearTimeout(warmupTimer)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <ComputeProvider>
          {children}
        </ComputeProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}