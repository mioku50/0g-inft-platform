// scripts/update-problematic-tokens.ts
const { ethers } = require('ethers')
const { INFT_ABI } = require('../lib/contracts/abis')
const dotenv = require('dotenv')

dotenv.config({ path: '.env' })

async function updateProblematicTokens() {
  console.log('🔄 Checking Problematic Token Metadata\n')
  
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!
  
  const contract = new ethers.Contract(contractAddress, INFT_ABI, provider)
  
  // Токены с URL проблемами из check-metadata
  const problematicTokenIds = ['1', '2', '3', '4', '5']
  
  console.log('📋 Checking problematic tokens...\n')
  
  const extractedHashes: Record<string, string> = {}
  
  for (const tokenId of problematicTokenIds) {
    try {
      const owner = await contract.ownerOf(tokenId)
      const currentHash = await contract.getEncryptedURI(tokenId)
      
      console.log(`Token #${tokenId}:`)
      console.log(`  Owner: ${owner}`)
      console.log(`  Current URI: ${currentHash.substring(0, 60)}...`)
      
      if (currentHash.includes('http://') || currentHash.includes('https://')) {
        // Извлекаем хэш из URL
        const parts = currentHash.split('/')
        const extractedHash = parts[parts.length - 1]
        extractedHashes[tokenId] = extractedHash
        console.log(`  ✅ Extracted hash: ${extractedHash}`)
        console.log(`  💡 This hash should work with the fixed retrieve API\n`)
      } else {
        console.log(`  ℹ️  Already using hash format\n`)
      }
    } catch (error: any) {
      console.error(`  ❌ Error checking token #${tokenId}:`, error?.message || 'Unknown error')
    }
  }
  
  console.log('\n✨ Summary:')
  console.log('The retrieve API has been fixed to handle URLs automatically.')
  console.log('Tokens should now display correctly with their metadata.')
  
  if (Object.keys(extractedHashes).length > 0) {
    console.log('\n📋 Extracted hashes from URLs:')
    Object.entries(extractedHashes).forEach(([tokenId, hash]) => {
      console.log(`  Token #${tokenId}: ${hash}`)
    })
  }
  
  console.log('\n💡 Next steps:')
  console.log('1. The retrieve API will automatically extract hashes from URLs')
  console.log('2. Local fallback metadata is available for tokens #1-5')
  console.log('3. Restart your dev server to see the changes')
}

updateProblematicTokens().catch(console.error)