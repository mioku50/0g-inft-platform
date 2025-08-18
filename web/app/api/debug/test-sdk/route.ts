import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { ethers } from 'ethers'
import {
  getComputeLedgerContract,
  getComputeInferenceContract,
  getFineTuningServingAddress
} from '@/lib/server/compute-env'

/**
 * Test the 0G SDK directly to check if we can list services
 */
export async function testSDKDirectly() {
  console.log('🔍 Testing 0G SDK directly...')
  
  try {
    // Use environment configuration
    const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY
    
    if (!privateKey) {
      throw new Error('No private key configured')
    }
    
    console.log('📡 Creating provider...')
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    
    console.log('👛 Creating wallet...')
    const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
    const wallet = new ethers.Wallet(cleanKey, provider)
    console.log(`Wallet address: ${wallet.address}`)
    
    // Test network connection
    console.log('🌐 Testing network...')
    try {
      const network = await provider.getNetwork()
      console.log(`Connected to network: Chain ID ${network.chainId}`)
    } catch (networkError: any) {
      console.log(`Network test failed: ${networkError.message}`)
      // Continue anyway
    }
    
    console.log('🏗️  Creating broker...')
    const contracts = {
      ledger: getComputeLedgerContract(),
      inference: getComputeInferenceContract(), 
      fineTuning: getFineTuningServingAddress()
    }
    console.log('Contract addresses:', contracts)
    
    const broker = await createZGComputeNetworkBroker(
      wallet,
      contracts.ledger,
      contracts.inference,
      contracts.fineTuning
    )
    
    console.log('✅ Broker created successfully')
    
    console.log('📋 Testing listService()...')
    const services = await broker.inference.listService()
    console.log(`Found ${services.length} services from contract`)
    
    if (services.length > 0) {
      console.log('🎯 Services found:')
      services.forEach((service: any, index: number) => {
        console.log(`  ${index + 1}. ${service.provider} - ${service.model}`)
        console.log(`     Type: ${service.serviceType}`)
        console.log(`     URL: ${service.url}`)
        console.log(`     Verifiability: ${service.verifiability}`)
      })
    } else {
      console.log('⚠️  No services found from contract')
      console.log('   This means either:')
      console.log('   1. No providers have registered on this contract')
      console.log('   2. We\'re using the wrong contract address')
      console.log('   3. The contract is on a different network')
    }
    
    // Test individual provider lookup for known addresses
    const knownProviders = [
      '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
    ]
    
    console.log('🔍 Testing known provider addresses...')
    for (const providerAddr of knownProviders) {
      try {
        console.log(`Testing: ${providerAddr}`)
        const metadata = await broker.inference.getServiceMetadata(providerAddr)
        console.log(`✅ Found: ${metadata.model} at ${metadata.endpoint}`)
      } catch (error: any) {
        console.log(`❌ Failed: ${error.message}`)
        if (error.message.includes('ServiceNotExist')) {
          console.log('   Provider not registered on this contract')
        }
      }
    }
    
    return {
      success: true,
      servicesFound: services.length,
      services: services.map((s: any) => ({
        provider: s.provider,
        model: s.model,
        serviceType: s.serviceType,
        url: s.url,
        verifiability: s.verifiability
      })),
      contractAddresses: contracts
    }
    
  } catch (error: any) {
    console.error('❌ SDK test failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

export async function GET() {
  try {
    const result = await testSDKDirectly()
    return Response.json(result)
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}