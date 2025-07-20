// web/scripts/debug-token-metadata.ts
import { ethers } from 'ethers'
import { INFT_ABI } from '../lib/contracts/abis'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const RPC_URL = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!

interface TokenInfo {
  tokenId: string
  owner: string
  encryptedURI: string
  hasUrl: boolean
  extractedHash?: string
  localExists?: boolean
}

async function debugTokenMetadata() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, INFT_ABI, provider)
  
  console.log('🔍 Debugging Token Metadata')
  console.log('='.repeat(60))
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log(`RPC: ${RPC_URL}`)
  console.log('='.repeat(60))
  
  try {
    // Get total supply
    const totalSupply = await contract.totalSupply()
    console.log(`\nTotal tokens: ${totalSupply}\n`)
    
    const problematicTokens: TokenInfo[] = []
    const workingTokens: TokenInfo[] = []
    
    // Check each token
    for (let i = 0; i < Number(totalSupply); i++) {
      try {
        const tokenId = await contract.tokenByIndex(i)
        const owner = await contract.ownerOf(tokenId)
        let encryptedURI = ''
        
        // Try to get encrypted URI
        try {
          encryptedURI = await contract.getEncryptedURI(tokenId)
        } catch {
          // Try alternative method
          try {
            encryptedURI = await contract.getMetadataHash(tokenId)
          } catch {
            encryptedURI = '0x0'
          }
        }
        
        const hasUrl = encryptedURI.includes('http://') || encryptedURI.includes('https://')
        let extractedHash = encryptedURI
        
        if (hasUrl) {
          const parts = encryptedURI.split('/')
          extractedHash = parts[parts.length - 1]
        }
        
        // Check if local file exists
        let localExists = false
        if (extractedHash && extractedHash !== '0x0') {
          const localPath = path.join(process.cwd(), 'data', 'metadata', `${extractedHash}.json`)
          try {
            await fs.access(localPath)
            localExists = true
          } catch {
            localExists = false
          }
        }
        
        const tokenInfo: TokenInfo = {
          tokenId: tokenId.toString(),
          owner: owner.substring(0, 10) + '...',
          encryptedURI: hasUrl ? encryptedURI.substring(0, 50) + '...' : encryptedURI,
          hasUrl,
          extractedHash,
          localExists
        }
        
        if (hasUrl) {
          problematicTokens.push(tokenInfo)
          console.log(`❌ Token #${tokenInfo.tokenId}: URL in metadata`)
          console.log(`   Owner: ${tokenInfo.owner}`)
          console.log(`   URI: ${tokenInfo.encryptedURI}`)
          console.log(`   Hash: ${tokenInfo.extractedHash}`)
          console.log(`   Local: ${tokenInfo.localExists ? '✅' : '❌'}`)
        } else if (encryptedURI === '0x0' || encryptedURI === '0x') {
          console.log(`⚠️  Token #${tokenId}: No metadata hash`)
        } else {
          workingTokens.push(tokenInfo)
          console.log(`✅ Token #${tokenInfo.tokenId}: OK (${tokenInfo.encryptedURI.substring(0, 20)}...)`)
          if (localExists) {
            console.log(`   📁 Local cache exists`)
          }
        }
        
        console.log()
        
      } catch (error: any) {
        console.error(`Error checking token ${i}:`, error.message)
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Working tokens: ${workingTokens.length}`)
    console.log(`❌ Problematic tokens (URL in hash): ${problematicTokens.length}`)
    
    if (problematicTokens.length > 0) {
      console.log('\n🔧 Tokens that need fixing:')
      problematicTokens.forEach(t => {
        console.log(`  - Token #${t.tokenId}: ${t.extractedHash}`)
      })
      
      console.log('\n💡 Solution:')
      console.log('  1. Update retrieve/upload routes with the fixes')
      console.log('  2. These tokens will automatically work with hash extraction')
      console.log('  3. Or manually save metadata to data/metadata/{hash}.json')
    }
    
    // Check local metadata directory
    console.log('\n📁 Local Metadata Cache:')
    const localDir = path.join(process.cwd(), 'data', 'metadata')
    try {
      const files = await fs.readdir(localDir)
      console.log(`  Found ${files.length} cached metadata files`)
      if (files.length > 0) {
        console.log('  Files:')
        files.slice(0, 5).forEach(f => console.log(`    - ${f}`))
        if (files.length > 5) console.log(`    ... and ${files.length - 5} more`)
      }
    } catch {
      console.log('  ❌ Local cache directory not found')
      console.log('  Run: mkdir -p data/metadata')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the debug
debugTokenMetadata().catch(console.error)

// To run: npx ts-node scripts/debug-token-metadata.ts