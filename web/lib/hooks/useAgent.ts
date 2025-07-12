import { useState, useEffect } from ‘react’
import { useContractRead } from ‘wagmi’
import { INFT_ABI } from ‘../contracts/abis’
import { retrieveFromStorage } from ‘../storage/client’

export function useAgent(tokenId: string, userAddress?: string) {
const [agent, setAgent] = useState<any>(null)
const [loading, setLoading] = useState(true)

const { data: encryptedURI } = useContractRead({
address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
abi: INFT_ABI,
functionName: ‘getEncryptedURI’,
args: [BigInt(tokenId)],
})

const { data: owner } = useContractRead({
address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
abi: INFT_ABI,
functionName: ‘ownerOf’,
args: [BigInt(tokenId)],
})

useEffect(() => {
const loadAgent = async () => {
if (!encryptedURI || !userAddress) {
setLoading(false)
return
}

```
  try {
    const metadata = await retrieveFromStorage(
      encryptedURI as string,
      userAddress
    )
    setAgent({
      tokenId,
      owner,
      metadata,
      encryptedURI
    })
  } catch (error) {
    console.error('Failed to load agent:', error)
  } finally {
    setLoading(false)
  }
}

loadAgent()
```

}, [tokenId, encryptedURI, userAddress, owner])

return { agent, loading, isOwner: userAddress === owner }
}