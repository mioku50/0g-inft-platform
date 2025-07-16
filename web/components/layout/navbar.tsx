// web/components/layout/navbar.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useForceAccountSync } from '@/hooks/useForceAccountSync'
import { RefreshCw } from 'lucide-react'

export function Navbar() {
  const { address, isConnected } = useAccount()
  const { address: syncedAddress } = useForceAccountSync()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Функция для ручного обновления
  const handleManualRefresh = () => {
    console.log('Manual refresh triggered')
    window.location.reload()
  }

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">0G</span>
            </div>
            <span className="text-xl font-bold">INFT</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="hover:text-purple-600 transition-colors">
              Home
            </Link>
            <Link href="/mint" className="hover:text-purple-600 transition-colors">
              Mint Agent
            </Link>
            <Link href="/agents" className="hover:text-purple-600 transition-colors">
              My Agents
            </Link>
            <Link href="/marketplace" className="hover:text-purple-600 transition-colors">
              Marketplace
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {mounted && isConnected && address && (
              <>
                <span className="text-xs text-gray-500 font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <button
                  onClick={handleManualRefresh}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Refresh if account not updating"
                >
                  <RefreshCw className="h-4 w-4 text-gray-500" />
                </button>
              </>
            )}
            
            {mounted ? (
              <ConnectButton />
            ) : (
              <div className="w-[138px] h-[40px] bg-gray-200 rounded-lg animate-pulse" />
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}