#!/usr/bin/env ts-node

/**
 * Smoke test script for on-chain contract calls
 * Tests getActiveModel calls for tokens 1-50 to validate contract ABI/address
 */

import * as dotenv from 'dotenv'
import { ethers } from 'ethers'

// Load environment variables
dotenv.config({ path: '.env.local' })

import { AgentModelRegistryService } from '../lib/contracts/agent-model-registry'
import { create0GProvider } from '../lib/server/provider'
import { 
  getRpcUrl, 
  getPrivateKey, 
  CHAIN_ID,
  logEnvironmentStatus 
} from '../lib/server/compute-env'

async function runSmokeTest() {
  console.log('🚀 Starting on-chain smoke test...\n')
  
  // Log environment status
  logEnvironmentStatus()
  
  const provider = create0GProvider()
  const pk = getPrivateKey()
  
  if (!pk) {
    console.error('❌ OG_COMPUTE_PRIVATE_KEY not set')
    process.exit(1)
  }
  
  const wallet = new ethers.Wallet(pk, provider)
  console.log(`📝 Testing with wallet: ${wallet.address}`)
  console.log(`🌐 RPC URL: ${getRpcUrl()}`)
  console.log(`⛓️  Chain ID: ${CHAIN_ID}`)
  
  // Test network connection
  try {
    const network = await provider.getNetwork()
    console.log(`✅ Connected to network: ${network.name} (${network.chainId})`)
  } catch (e: any) {
    console.error('❌ Failed to connect to network:', e.message)
    process.exit(1)
  }
  
  console.log('\n🔍 Testing getActiveModel calls...')
  
  let successCount = 0
  let revertCount = 0
  let errorCount = 0
  const successfulTokens: number[] = []
  const errors: string[] = []
  
  // Test tokens 1-50
  for (let tokenId = 1; tokenId <= 50; tokenId++) {
    try {
      const model = await AgentModelRegistryService.getActiveModel(tokenId)
      
      if (model && model !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        successCount++
        successfulTokens.push(tokenId)
        console.log(`✅ Token ${tokenId}: ${model}`)
      } else {
        revertCount++
        console.log(`⭕ Token ${tokenId}: No model assigned (expected)`)
      }
      
    } catch (error: any) {
      errorCount++
      const errorMsg = error.message
      
      if (errorMsg.includes('execution reverted') || errorMsg.includes('require(false)')) {
        revertCount++
        console.log(`⭕ Token ${tokenId}: Reverted (no model - expected)`)
      } else {
        console.error(`❌ Token ${tokenId}: Unexpected error - ${errorMsg}`)
        errors.push(`Token ${tokenId}: ${errorMsg}`)
      }
    }
    
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n📊 Smoke Test Results:')
  console.log(`✅ Successful calls: ${successCount}`)
  console.log(`⭕ Reverted calls (no model): ${revertCount}`)
  console.log(`❌ Error calls: ${errorCount}`)
  console.log(`📈 Total tested: 50`)
  
  if (successfulTokens.length > 0) {
    console.log(`\n🎉 Found models for tokens: ${successfulTokens.join(', ')}`)
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Unexpected errors:')
    errors.forEach(error => console.log(`  - ${error}`))
  }
  
  // Test getCandidateModel as well
  console.log('\n🔍 Testing getCandidateModel calls (sample)...')
  for (const tokenId of [1, 2, 3]) {
    try {
      const candidate = await AgentModelRegistryService.getCandidateModel(tokenId)
      console.log(`✅ Token ${tokenId} candidate:`, candidate)
    } catch (error: any) {
      console.log(`⭕ Token ${tokenId} candidate: ${error.message}`)
    }
  }
  
  // Validate results
  if (successCount === 0 && revertCount === 0 && errorCount === 50) {
    console.log('\n❌ SMOKE TEST FAILED: All calls failed with errors')
    console.log('This likely indicates wrong contract address or ABI')
    process.exit(1)
  }
  
  if (successCount > 0 || revertCount > 0) {
    console.log('\n✅ SMOKE TEST PASSED: Contract calls working correctly')
    console.log('Revert calls are expected for tokens without assigned models')
    process.exit(0)
  }
  
  console.log('\n⚠️  SMOKE TEST INCONCLUSIVE: Mixed results')
  process.exit(1)
}

// Run the test
runSmokeTest().catch(error => {
  console.error('💥 Smoke test crashed:', error)
  process.exit(1)
})