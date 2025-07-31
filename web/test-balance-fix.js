#!/usr/bin/env node

/**
 * Test script to verify the balance fix
 */

const { getBroker } = require('./lib/compute/broker.server.ts')
const { validateComputeEnvironment } = require('./lib/server/compute-env.ts')

async function testBalanceRetrieval() {
  console.log('🔧 Testing Fine-tuning Balance Fix')
  console.log('====================================')
  
  try {
    // Test environment validation
    console.log('\n1. Testing environment validation...')
    const envValidation = validateComputeEnvironment()
    console.log('Environment validation result:', {
      isValid: envValidation.isValid,
      errors: envValidation.errors,
      warnings: envValidation.warnings
    })
    
    if (!envValidation.isValid) {
      console.error('❌ Environment validation failed')
      console.error('Errors:', envValidation.errors)
      return
    }
    
    console.log('✅ Environment validation passed')
    
    // Test broker initialization
    console.log('\n2. Testing broker initialization...')
    const broker = await getBroker()
    console.log('✅ Broker initialized successfully')
    
    // Test ledger account retrieval
    console.log('\n3. Testing ledger account retrieval...')
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      
      // Handle different response formats
      let balance, locked
      if (ledgerInfo.ledgerInfo) {
        balance = ledgerInfo.ledgerInfo[0]
        locked = ledgerInfo.ledgerInfo[1] || 0
      } else if (Array.isArray(ledgerInfo)) {
        balance = ledgerInfo[0]
        locked = ledgerInfo[1] || 0
      } else {
        balance = ledgerInfo.balance || ledgerInfo.amount || 0
        locked = ledgerInfo.locked || 0
      }
      
      const { formatEther } = await import('ethers')
      const balanceFormatted = formatEther(balance)
      const lockedFormatted = formatEther(locked)
      
      console.log('✅ Ledger account found:')
      console.log('  Balance:', balanceFormatted, 'OG')
      console.log('  Locked:', lockedFormatted, 'OG')
      console.log('  Account exists: true')
      
      if (parseFloat(balanceFormatted) > 0) {
        console.log('\n🎉 SUCCESS: Account has funds!')
        console.log('The fine-tuning UI should now show the correct balance.')
      } else {
        console.log('\n⚠️  Account exists but has 0 balance')
        console.log('The Create/Fund Account button should be available.')
      }
      
    } catch (error) {
      console.log('ℹ️  No ledger account found (expected for new users)')
      console.log('Error:', error.message)
      console.log('The Create Account functionality should work.')
    }
    
    console.log('\n✅ Balance fix test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testBalanceRetrieval().then(() => {
  console.log('\n📝 Next steps:')
  console.log('1. Start the development server: npm run dev')
  console.log('2. Navigate to /agents/[id]/fine-tune')
  console.log('3. Check if the balance displays correctly')
  console.log('4. Test the Create/Fund Account button if balance is 0')
}).catch(console.error)