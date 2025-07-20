// scripts/fix-all-missing-metadata.ts
const fs = require('fs').promises
const path = require('path')
const { ethers } = require('ethers')
const { INFT_ABI } = require('../lib/contracts/abis')
const dotenv = require('dotenv')

dotenv.config({ path: '.env' })

// Хэши из ваших логов, которые не найдены
const MISSING_HASHES: Record<string, { name: string; tokenId: string }> = {
  '0xadebc6129d6e50af2d8dc8d5d30740871e58a75ad197fb0274a163ec67b85871': {
    name: 'AI Assistant #15',
    tokenId: '15'
  },
  '0xad885696ac005c4043bc23ae67b78ab05d58e117ef6ee8629d78016cb404f2e1': {
    name: 'Creative Muse #13', 
    tokenId: '13'
  }
}

async function fixAllMissingMetadata() {
  console.log('🔧 Creating metadata for all missing tokens\n')
  
  const metadataDir = path.join(process.cwd(), 'data', 'metadata')
  await fs.mkdir(metadataDir, { recursive: true })
  
  // Получаем все токены из контракта
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!
  const contract = new ethers.Contract(contractAddress, INFT_ABI, provider)
  
  try {
    const totalSupply = await contract.totalSupply()
    console.log(`Total tokens: ${totalSupply}\n`)
    
    // Проверяем каждый токен
    for (let i = 0; i < Number(totalSupply); i++) {
      const tokenId = await contract.tokenByIndex(i)
      
      try {
        const metadataHash = await contract.getEncryptedURI(tokenId)
        
        // Очищаем хэш от URL
        let cleanHash = metadataHash
        if (metadataHash.includes('http://') || metadataHash.includes('https://')) {
          const parts = metadataHash.split('/')
          cleanHash = parts[parts.length - 1]
        }
        
        // Проверяем существует ли файл
        const filePath = path.join(metadataDir, `${cleanHash}.json`)
        try {
          await fs.access(filePath)
          console.log(`Token #${tokenId}: Already has metadata`)
          continue
        } catch {
          // Файл не существует, создаем
        }
        
        // Получаем имя из предопределенных или генерируем
        const predefinedData = MISSING_HASHES[cleanHash as string]
        const agentName = predefinedData?.name || `AI Agent #${tokenId}`
        
        // Создаем метаданные
        const metadata = {
          name: agentName,
          description: `Intelligent AI assistant with unique capabilities`,
          model: Number(tokenId) % 2 === 0 ? 'deepseek-r1-70b' : 'llama-3.3-70b',
          personality: ['friendly', 'professional', 'creative', 'analytical'][Number(tokenId) % 4],
          systemPrompt: `You are ${agentName}, an intelligent AI assistant.`,
          expertise: 'General AI assistance, problem solving, creative tasks',
          skills: ['chat', 'analysis'],
          image: `https://api.dicebear.com/7.x/bottts/svg?seed=agent-${tokenId}`,
          createdAt: new Date().toISOString(),
          creator: '0x0000000000000000000000000000000000000000',
          version: '1.0',
          tokenId: tokenId.toString()
        }
        
        await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
        console.log(`Token #${tokenId}: Created metadata (${cleanHash})`)
        
      } catch (err: any) {
        console.error(`Token #${tokenId}: Error - ${err?.message || 'Unknown error'}`)
      }
    }
    
    console.log('\n✅ All missing metadata created!')
    
  } catch (error: any) {
    console.error('Error:', error?.message || error)
  }
}

fixAllMissingMetadata().catch(console.error)