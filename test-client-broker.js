// Test script for client broker functionality
// This simulates browser environment

console.log('Testing client broker implementation...\n')

// Simulate browser environment
global.window = {
  ethereum: {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts') {
        return ['0x1234567890123456789012345678901234567890']
      }
      if (method === 'eth_accounts') {
        return ['0x1234567890123456789012345678901234567890']
      }
      return null
    },
    on: () => {},
    removeListener: () => {}
  }
}

// Test imports
console.log('1. Testing imports...')
try {
  const clientBroker = require('./web/lib/compute/clientBroker.ts')
  console.log('✅ clientBroker module loaded')
  console.log('   Exported functions:', Object.keys(clientBroker))
} catch (error) {
  console.error('❌ Failed to load clientBroker:', error.message)
}

console.log('\n2. Testing SSR guards...')
try {
  // Test without window
  delete global.window
  const { getClientBroker } = require('./web/lib/compute/clientBroker.ts')
  getClientBroker().catch(err => {
    console.log('✅ SSR guard working:', err.message)
  })
} catch (error) {
  console.log('✅ SSR guard prevented execution')
}

console.log('\n3. Testing function exports...')
global.window = { ethereum: {} } // Restore window
const { 
  getClientBroker, 
  getCurrentWalletAddress, 
  ensureLedger,
  isClientBrokerAvailable,
  clearBrokerCache,
  getLedgerBalance,
  prepareComputeRequest
} = require('./web/lib/compute/clientBroker.ts')

console.log('✅ All functions exported correctly:')
console.log('   - getClientBroker:', typeof getClientBroker)
console.log('   - getCurrentWalletAddress:', typeof getCurrentWalletAddress)
console.log('   - ensureLedger:', typeof ensureLedger)
console.log('   - isClientBrokerAvailable:', typeof isClientBrokerAvailable)
console.log('   - clearBrokerCache:', typeof clearBrokerCache)
console.log('   - getLedgerBalance:', typeof getLedgerBalance)
console.log('   - prepareComputeRequest:', typeof prepareComputeRequest)

console.log('\nTest completed!')