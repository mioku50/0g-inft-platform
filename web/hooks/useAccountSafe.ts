// web/hooks/useWatchAccount.ts
import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'

export function useWatchAccount() {
  const { address } = useAccount()
  const router = useRouter()
  const prevAddressRef = useRef<string>()

  useEffect(() => {
    // Слушаем изменения MetaMask напрямую
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('MetaMask accounts changed:', accounts)
        if (accounts.length > 0) {
          // Форсируем обновление страницы
          window.location.reload()
        }
      }

      window.ethereum?.on?.('accountsChanged', handleAccountsChanged)
      
      return () => {
        window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  useEffect(() => {
    if (address && prevAddressRef.current && address !== prevAddressRef.current) {
      console.log('Address changed from', prevAddressRef.current, 'to', address)
      router.refresh()
    }
    prevAddressRef.current = address
  }, [address, router])

  return { address }
}