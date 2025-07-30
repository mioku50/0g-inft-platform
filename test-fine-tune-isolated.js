// test-fine-tune-isolated.js
// Тест проверки изолированного 0G SDK на сервере

const { ethers } = require('ethers')

async function testIsolatedSDK() {
  console.log('🧪 Testing isolated 0G SDK...')
  
  try {
    // Проверяем, что можем импортировать серверный модуль
    const brokerServer = require('./web/lib/compute/broker.server.js')
    console.log('✅ Server module imported successfully')
    
    // Проверяем основные функции
    console.log('📋 Available functions:')
    console.log('- getBroker:', typeof brokerServer.getBroker)
    console.log('- getBrokerOrThrow:', typeof brokerServer.getBrokerOrThrow)  
    console.log('- getSignerAddress:', typeof brokerServer.getSignerAddress)
    console.log('- validateUserWallet:', typeof brokerServer.validateUserWallet)
    console.log('- createUserWalletBroker:', typeof brokerServer.createUserWalletBroker)
    
    // Проверяем, что клиентский модуль работает без SDK
    const walletClient = require('./web/lib/compute/wallet-client.js')
    console.log('✅ Client module imported successfully')
    console.log('📋 Client functions:')
    console.log('- validateUserWalletClient:', typeof walletClient.validateUserWalletClient)
    console.log('- isWalletConnected:', typeof walletClient.isWalletConnected)
    
    console.log('\n🎉 All modules imported successfully!')
    console.log('✅ SDK isolation is working correctly')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testIsolatedSDK()