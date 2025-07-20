// scripts/check-metadata.ts
export {}
import { ethers } from 'ethers'
import { INFT_ABI } from '../lib/contracts/abis'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

async function checkAllMetadata() {
  console.log('🔍 Checking All Token Metadata\n')
  
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!
  
  const contract = new ethers.Contract(contractAddress, INFT_ABI, provider)
  
  try {
    const totalSupply = await contract.totalSupply()
    console.log(`📊 Total tokens: ${totalSupply}\n`)
    
    const problematicTokens: any[] = []
    const workingTokens: any[] = []
    
    for (let i = 0; i < Number(totalSupply); i++) {
      const tokenId = await contract.tokenByIndex(i)
      const owner = await contract.ownerOf(tokenId)
      
      let metadataHash = ''
      try {
        metadataHash = await contract.getEncryptedURI(tokenId)
      } catch {
        metadataHash = 'Not found'
      }
      
      // Check if metadata is URL instead of hash
      const hasUrlProblem = metadataHash.includes('http://') || metadataHash.includes('https://')
      
      const tokenInfo = {
        tokenId: tokenId.toString(),
        owner,
        metadataHash: metadataHash.substring(0, 50) + '...',
        hasUrlProblem
      }
      
      if (hasUrlProblem || metadataHash === 'Not found' || metadataHash === '0x') {
        problematicTokens.push(tokenInfo)
      } else {
        workingTokens.push(tokenInfo)
      }
      
      console.log(`Token #${tokenId}: ${hasUrlProblem ? '❌ Has URL problem' : '✅ OK'}`)
    }
    
    console.log('\n📈 Summary:')
    console.log(`✅ Working tokens: ${workingTokens.length}`)
    console.log(`❌ Problematic tokens: ${problematicTokens.length}`)
    
    if (problematicTokens.length > 0) {
      console.log('\n⚠️  Problematic tokens:')
      problematicTokens.forEach(t => {
        console.log(`  - Token #${t.tokenId}: ${t.hasUrlProblem ? 'URL instead of hash' : 'No metadata'}`)
      })
    }
    
  } catch (error) {
    console.error('Error checking metadata:', error)
  }
}

checkAllMetadata().catch(console.error)