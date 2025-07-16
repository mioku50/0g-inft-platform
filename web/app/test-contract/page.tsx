// web/app/agents/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { INFT_ABI } from '@/lib/contracts/abis'
import { parseAbiItem } from 'viem'

export default function AgentsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const contractAddress = '0x25DB0F8e03eF8E9d81d975c0839F4c8e609e701b'

  useEffect(() => {
    if (!address || !publicClient) {
      setLoading(false)
      return
    }

    const loadAgents = async () => {
      console.log('Loading agents for address:', address)
      
      try {
        // Поскольку нет totalSupply, будем искать через события
        const logs = await publicClient.getLogs({
          address: contractAddress as `0x${string}`,
          event: parseAbiItem('event AgentMinted(uint256 indexed tokenId, address indexed owner, string encryptedURI)'),
          fromBlock: 0n,
          toBlock: 'latest',
        })
        
        console.log('Found mint events:', logs.length)
        
        const userAgents = []
        
        // Проверяем каждый токен из событий
        for (const log of logs) {
          const tokenId = Number(log.args.tokenId)
          console.log(`Checking token ${tokenId} from event`)
          
          try {
            // Проверяем текущего владельца
            const currentOwner = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: INFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            })
            
            console.log(`Token ${tokenId} current owner:`, currentOwner)
            
            if (currentOwner && currentOwner.toLowerCase() === address.toLowerCase()) {
              console.log(`User owns token ${tokenId}`)
              
              // Получаем метаданные
              const metadataHash = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: INFT_ABI,
                functionName: 'getMetadataHash',
                args: [BigInt(tokenId)],
              })
              
              const encryptedURI = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: INFT_ABI,
                functionName: 'getEncryptedURI',
                args: [BigInt(tokenId)],
              })
              
              console.log(`Token ${tokenId} metadata hash:`, metadataHash)
              console.log(`Token ${tokenId} encrypted URI:`, encryptedURI)
              
              // Пробуем загрузить метаданные
              let metadata = null
              try {
                const response = await fetch('/api/storage/retrieve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rootHash: metadataHash }),
                })
                
                if (response.ok) {
                  const data = await response.json()
                  metadata = JSON.parse(data.content)
                  console.log(`Loaded metadata for token ${tokenId}:`, metadata)
                }
              } catch (metaErr) {
                console.error(`Failed to load metadata for token ${tokenId}:`, metaErr)
              }
              
              userAgents.push({
                tokenId,
                owner: currentOwner,
                metadataHash,
                encryptedURI,
                metadata: metadata || { 
                  name: `Agent #${tokenId}`, 
                  description: 'Metadata loading failed',
                  model: 'Unknown'
                }
              })
            }
          } catch (err) {
            console.error(`Error checking token ${tokenId}:`, err)
          }
        }
        
        // Также попробуем проверить первые несколько токенов напрямую
        for (let i = 0; i < 10; i++) {
          try {
            const owner = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: INFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(i)],
            })
            
            if (owner && owner.toLowerCase() === address.toLowerCase()) {
              // Проверяем, не добавили ли мы уже этот токен
              if (!userAgents.find(a => a.tokenId === i)) {
                console.log(`Found additional token ${i} owned by user`)
                
                const metadataHash = await publicClient.readContract({
                  address: contractAddress as `0x${string}`,
                  abi: INFT_ABI,
                  functionName: 'getMetadataHash',
                  args: [BigInt(i)],
                })
                
                userAgents.push({
                  tokenId: i,
                  owner,
                  metadataHash,
                  metadata: { 
                    name: `Agent #${i}`, 
                    description: 'Loading...',
                    model: 'Unknown'
                  }
                })
              }
            }
          } catch (err) {
            // Token doesn't exist, continue
          }
        }
        
        console.log('Final agents found:', userAgents)
        setAgents(userAgents)
        
      } catch (error) {
        console.error('Error loading agents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [address, publicClient])

  if (!isConnected) {
    return (
      <div className="container mx-auto py-20">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-600">Please connect your wallet to view your AI agents</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">My AI Agents</h1>
        <p className="text-gray-600 mt-2">Connected as: {address}</p>
      </div>
      
      <div className="mb-4">
        <Link href="/mint">
          <Button>Create New Agent</Button>
        </Link>
      </div>

      {loading ? (
        <p>Loading agents...</p>
      ) : agents.length === 0 ? (
        <div>
          <p className="text-lg mb-4">No agents found.</p>
          <p className="text-sm text-gray-600">Contract: {contractAddress}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.tokenId}>
              <CardHeader>
                <CardTitle>{agent.metadata?.name || `Agent #${agent.tokenId}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2">{agent.metadata?.description || 'No description'}</p>
                <p className="text-xs text-gray-500">Token ID: {agent.tokenId}</p>
                <p className="text-xs text-gray-500">Model: {agent.metadata?.model || 'Unknown'}</p>
                <p className="text-xs text-gray-500">Hash: {agent.metadataHash?.slice(0, 10)}...</p>
                <div className="mt-4">
                  <Link href={`/agent/${agent.tokenId}`}>
                    <Button size="sm" className="w-full">Chat with Agent</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}