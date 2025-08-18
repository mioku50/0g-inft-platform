/**
 * Utility to check multiple contract addresses to find the one with registered services
 * This helps identify if we're using the wrong contract address for Galileo v3
 */

export const POSSIBLE_INFERENCE_CONTRACTS = [
  // Current configured address
  {
    address: '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
    description: 'Currently configured in NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT',
    source: 'environment'
  },
  
  // Alternative addresses that might be correct for Galileo v3
  {
    address: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
    description: 'Fine-tuning serving address (might also handle inference)',
    source: 'FINE_TUNING_SERVING_ADDRESS'
  },
  
  // These would be other possible addresses if documentation shows them
  // We can add more as we discover them
]

export async function checkAllPossibleContracts() {
  console.log('🔍 Checking all possible inference contract addresses...')
  
  const results = []
  
  for (const contractInfo of POSSIBLE_INFERENCE_CONTRACTS) {
    console.log(`\n📋 Testing contract: ${contractInfo.address}`)
    console.log(`   Description: ${contractInfo.description}`)
    
    try {
      // This would use our existing test functionality
      // but with different contract addresses
      const result = await testContractAddress(contractInfo.address)
      
      results.push({
        ...contractInfo,
        ...result,
        tested: true
      })
      
      if (result.success && result.servicesFound > 0) {
        console.log(`✅ Found ${result.servicesFound} services on this contract!`)
      } else {
        console.log(`⚠️  No services found on this contract`)
      }
      
    } catch (error: any) {
      console.log(`❌ Failed to test contract: ${error.message}`)
      results.push({
        ...contractInfo,
        success: false,
        error: error.message,
        tested: true
      })
    }
  }
  
  return results
}

async function testContractAddress(contractAddress: string) {
  // This would be similar to our existing testContract function
  // but allow passing a custom contract address
  
  // For now, return a placeholder
  return {
    success: false,
    servicesFound: 0,
    error: 'Test implementation needed'
  }
}

export async function GET() {
  try {
    const results = await checkAllPossibleContracts()
    
    // Find contracts with services
    const workingContracts = results.filter(r => r.success && r.servicesFound > 0)
    const failedContracts = results.filter(r => !r.success)
    const emptyContracts = results.filter(r => r.success && r.servicesFound === 0)
    
    return Response.json({
      summary: {
        total: results.length,
        working: workingContracts.length,
        empty: emptyContracts.length,
        failed: failedContracts.length
      },
      workingContracts,
      emptyContracts,
      failedContracts,
      allResults: results,
      recommendation: workingContracts.length > 0 
        ? `Use contract ${workingContracts[0].address} which has ${workingContracts[0].servicesFound} services`
        : 'No contracts found with registered services. Providers may need to register first.',
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}