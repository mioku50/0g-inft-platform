import { ethers } from 'ethers'
import { INFT_ABI } from '../lib/contracts/abis'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const RPC_URL = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS

async function checkMetadataHashes() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  
  console.log('Checking metadata hashes in contract...')
  
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, INFT_ABI, provider)
    
    // Get total supply
    const totalSupply = await contract.totalSupply()
    console.log(`Total tokens: ${totalSupply}`)
    
    const problematicTokens = []
    
    for (let i = 0; i < Number(totalSupply); i++) {
      try {
        const tokenId = await contract.tokenByIndex(i)
        const encryptedURI = await contract.getEncryptedURI(tokenId)
        
        if (encryptedURI.includes('http://') || encryptedURI.includes('https://')) {
          console.log(`Token ${tokenId}: Contains URL - ${encryptedURI}`)
          problematicTokens.push({
            tokenId: tokenId.toString(),
            uri: encryptedURI
          })
        } else {
          console.log(`Token ${tokenId}: OK - ${encryptedURI}`)
        }
      } catch (error) {
        console.error(`Error checking token ${i}:`, error)
      }
    }
    
    if (problematicTokens.length > 0) {
      console.log('\n⚠️  Found tokens with URL in metadata hash:')
      problematicTokens.forEach(t => {
        console.log(`  Token ${t.tokenId}: ${t.uri}`)
      })
      console.log('\nThese tokens will use fallback metadata until fixed.')
    } else {
      console.log('\n✅ All tokens have proper metadata hashes')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run if called directly
if (require.main === module) {
  checkMetadataHashes().catch(console.error)
}

// package.json - добавьте скрипт
/*
"scripts": {
  "check-metadata": "ts-node scripts/fix-metadata-urls.ts"
}
*/