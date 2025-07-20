// web/hooks/useForceAccountSync.ts
import { useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

export function useForceAccountSync() {
  const { address } = useAccount()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    let checkInterval: NodeJS.Timeout

    const checkAccount = async () => {
      try {
        const accounts = await (window.ethereum as any)?.request({
          method: 'eth_accounts'
        })
        
        const currentMetaMaskAccount = accounts[0]?.toLowerCase()
        const wagmiAccount = address?.toLowerCase()

        if (currentMetaMaskAccount && wagmiAccount && 
            currentMetaMaskAccount !== wagmiAccount) {
          console.log('Account mismatch detected!')
          console.log('MetaMask:', currentMetaMaskAccount)
          console.log('Wagmi:', wagmiAccount)
          
          // Отключаемся и перезагружаем
          disconnect()
          setTimeout(() => {
            window.location.reload()
          }, 100)
        }
      } catch (error) {
        console.error('Error checking accounts:', error)
      }
    }

    // Проверяем сразу
    checkAccount()

    // Проверяем каждые 2 секунды
    checkInterval = setInterval(checkAccount, 2000)

    // Слушаем события
    const handleAccountsChanged = () => {
      console.log('MetaMask accountsChanged event')
      disconnect()
      setTimeout(() => {
        window.location.reload()
      }, 100)
    }

    window.ethereum?.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      clearInterval(checkInterval)
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [address, disconnect])

  return { address }
}