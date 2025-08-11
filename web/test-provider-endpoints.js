#!/usr/bin/env node

/**
 * Test script to discover actual 0G provider endpoints
 * This helps us update the proxy allowlist with real hosts
 */

const { ethers } = require('ethers')

async function testProviderEndpoints() {
  console.log('🔍 Testing 0G provider endpoints...\n')
  
  try {
    // Create a provider (read-only, no private key needed)
    const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai')
    
    // Import the 0G SDK
    const pkg = ['@0glabs', '0g-serving-broker'].join('/')
    const { createZGComputeNetworkBroker } = require(pkg)
    
    // We need a signer for the broker, but we can use a dummy one for testing
    const dummyWallet = ethers.Wallet.createRandom().connect(provider)
    
    console.log('📡 Initializing broker...')
    const broker = await createZGComputeNetworkBroker(dummyWallet)
    
    console.log('🔍 Listing available services...')
    const services = await broker.inference.listService()
    
    console.log(`Found ${services.length} services:\n`)
    
    const providerEndpoints = new Set()
    
    for (const service of services) {
      console.log(`Provider: ${service.provider}`)
      console.log(`  Model: ${service.model}`)
      console.log(`  Service Type: ${service.serviceType}`)
      console.log(`  URL: ${service.url}`)
      console.log(`  Verifiability: ${service.verifiability}`)
      
      // Extract hostname from URL
      try {
        const url = new URL(service.url)
        providerEndpoints.add(url.hostname)
        console.log(`  🌐 Hostname: ${url.hostname}`)
      } catch (e) {
        console.log(`  ❌ Invalid URL: ${service.url}`)
      }
      
      console.log('') // blank line
    }
    
    console.log('🎯 Unique provider hostnames found:')
    Array.from(providerEndpoints).sort().forEach(host => {
      console.log(`  - ${host}`)
    })
    
    console.log('\n📋 Add these to ALLOWED_HOSTS in proxy/route.ts:')
    Array.from(providerEndpoints).sort().forEach(host => {
      console.log(`  '${host}',`)
    })
    
  } catch (error) {
    console.error('❌ Error testing provider endpoints:', error.message)
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 This is expected - we just need to discover endpoints, not create accounts')
    }
  }
}

// Run the test
testProviderEndpoints().catch(console.error)