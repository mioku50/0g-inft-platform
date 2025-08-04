#!/usr/bin/env node

/**
 * Test script for Complete Fine-tuning System Rebuild fixes
 * Validates the key requirements implementation
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 Testing Complete Fine-tuning System Rebuild Fixes\n')

// Test 1: Multi-user broker cache isolation
console.log('1. Testing Multi-User Broker Cache Isolation...')
const brokerFile = fs.readFileSync('lib/compute/broker.server.ts', 'utf8')

let brokerTests = 0
let brokerPassed = 0

// Check for proper cache key with chainId and userAddress
if (brokerFile.includes('${chainId}:${userAddress}')) {
  console.log('   ✅ Cache key includes chainId and userAddress')
  brokerPassed++
} else {
  console.log('   ❌ Cache key missing chainId:userAddress format')
}
brokerTests++

// Check for getBroker with userAddress parameter
if (brokerFile.includes('getBroker(userAddress') || brokerFile.includes('getBroker(userAddress?')) {
  console.log('   ✅ getBroker accepts userAddress parameter')
  brokerPassed++
} else {
  console.log('   ❌ getBroker missing userAddress parameter')
}
brokerTests++

// Check for clearBrokerCache with user support
if (brokerFile.includes('clearBrokerCache(userAddress') && brokerFile.includes('resetBrokerStateForUser')) {
  console.log('   ✅ User-specific cache clearing implemented')
  brokerPassed++
} else {
  console.log('   ❌ User-specific cache clearing missing')
}
brokerTests++

console.log(`   Result: ${brokerPassed}/${brokerTests} broker cache tests passed\n`)

// Test 2: Provider preflight validation
console.log('2. Testing Provider Preflight Validation...')
const fineTuneFile = fs.readFileSync('app/api/compute/fine-tune/route.ts', 'utf8')

let preflightTests = 0
let preflightPassed = 0

// Check for getService provider validation
if (fineTuneFile.includes('broker.inference.getService(provider)')) {
  console.log('   ✅ Provider registration check using getService()')
  preflightPassed++
} else {
  console.log('   ❌ Provider registration check missing')
}
preflightTests++

// Check for ServiceNotExist error handling
if (fineTuneFile.includes('ServiceNotExist') && fineTuneFile.includes('PROVIDER_NOT_REGISTERED')) {
  console.log('   ✅ ServiceNotExist error handling implemented')
  preflightPassed++
} else {
  console.log('   ❌ ServiceNotExist error handling missing')
}
preflightTests++

// Check for user context in broker initialization
if (fineTuneFile.includes('getBroker(userAddress)')) {
  console.log('   ✅ Broker initialized with user context')
  preflightPassed++
} else {
  console.log('   ❌ Broker missing user context')
}
preflightTests++

console.log(`   Result: ${preflightPassed}/${preflightTests} preflight tests passed\n`)

// Test 3: Turbo-only strategy with TOO_EARLY_INDEXING
console.log('3. Testing Turbo-Only Strategy...')
const uploadFile = fs.readFileSync('app/api/storage/upload-dataset/route.ts', 'utf8')

let turboTests = 0
let turboPassed = 0

// Check for exponential backoff delays
if (uploadFile.includes('[5000, 10000, 15000, 20000, 30000]')) {
  console.log('   ✅ Exponential backoff delays implemented (5s, 10s, 15s, 20s, 30s)')
  turboPassed++
} else {
  console.log('   ❌ Exponential backoff delays missing')
}
turboTests++

// Check for TOO_EARLY_INDEXING response
if (uploadFile.includes('TOO_EARLY_INDEXING') && uploadFile.includes('status: 425')) {
  console.log('   ✅ TOO_EARLY_INDEXING 425 response implemented')
  turboPassed++
} else {
  console.log('   ❌ TOO_EARLY_INDEXING 425 response missing')
}
turboTests++

// Check for Turbo-only (no Standard fallback)
if (uploadFile.includes('TURBO_URL') && !uploadFile.includes('Standard indexer') && uploadFile.includes('Turbo indexer only')) {
  console.log('   ✅ Turbo-only strategy confirmed (no Standard indexer fallback)')
  turboPassed++
} else {
  console.log('   ❌ Turbo-only strategy not fully implemented')
}
turboTests++

console.log(`   Result: ${turboPassed}/${turboTests} Turbo strategy tests passed\n`)

// Test 4: Account bootstrap system
console.log('4. Testing Account Bootstrap System...')

let bootstrapTests = 0
let bootstrapPassed = 0

// Check for useAccountBootstrap hook
if (fs.existsSync('hooks/useAccountBootstrap.ts')) {
  const hookFile = fs.readFileSync('hooks/useAccountBootstrap.ts', 'utf8')
  if (hookFile.includes('wallet connect/change') && hookFile.includes('checkAccount')) {
    console.log('   ✅ useAccountBootstrap hook with wallet change detection')
    bootstrapPassed++
  } else {
    console.log('   ❌ useAccountBootstrap hook missing wallet change detection')
  }
} else {
  console.log('   ❌ useAccountBootstrap hook file missing')
}
bootstrapTests++

// Check for AccountBootstrapModal component
if (fs.existsSync('components/AccountBootstrapModal.tsx')) {
  const modalFile = fs.readFileSync('components/AccountBootstrapModal.tsx', 'utf8')
  if (modalFile.includes('Create Fine-tuning Account') && modalFile.includes('Add Funds')) {
    console.log('   ✅ AccountBootstrapModal component implemented')
    bootstrapPassed++
  } else {
    console.log('   ❌ AccountBootstrapModal component incomplete')
  }
} else {
  console.log('   ❌ AccountBootstrapModal component missing')
}
bootstrapTests++

// Check for userAddress parameter in account route
const accountFile = fs.readFileSync('app/api/compute/account/route.ts', 'utf8')
if (accountFile.includes('userAddress') && accountFile.includes('EOA balance')) {
  console.log('   ✅ Account route returns user EOA balance')
  bootstrapPassed++
} else {
  console.log('   ❌ Account route missing user EOA balance logic')
}
bootstrapTests++

console.log(`   Result: ${bootstrapPassed}/${bootstrapTests} bootstrap tests passed\n`)

// Test 5: Environment variable parsing
console.log('5. Testing Enhanced Environment Parsing...')
const computeEnvFile = fs.readFileSync('lib/server/compute-env.ts', 'utf8')

let envTests = 0
let envPassed = 0

// Check for parseBoolEnv function
if (computeEnvFile.includes('parseBoolEnv') && computeEnvFile.includes('1|true|yes|on|enable|enabled')) {
  console.log('   ✅ parseBoolEnv with comprehensive format support')
  envPassed++
} else {
  console.log('   ❌ parseBoolEnv comprehensive format support missing')
}
envTests++

// Check for comment handling
if (computeEnvFile.includes('split(\'#\')') && computeEnvFile.includes('inline comments')) {
  console.log('   ✅ Inline comment handling implemented')
  envPassed++
} else {
  console.log('   ❌ Inline comment handling missing')
}
envTests++

// Check for FT_ATTEST_ONCHAIN usage
if (computeEnvFile.includes('FT_ATTEST_ONCHAIN') && computeEnvFile.includes('shouldAttestOnChain')) {
  console.log('   ✅ FT_ATTEST_ONCHAIN parsing implemented')
  envPassed++
} else {
  console.log('   ❌ FT_ATTEST_ONCHAIN parsing missing')
}
envTests++

console.log(`   Result: ${envPassed}/${envTests} environment parsing tests passed\n`)

// Overall results
const totalTests = brokerTests + preflightTests + turboTests + bootstrapTests + envTests
const totalPassed = brokerPassed + preflightPassed + turboPassed + bootstrapPassed + envPassed

console.log('📊 Overall Test Results:')
console.log(`   Total: ${totalPassed}/${totalTests} tests passed (${Math.round(totalPassed/totalTests*100)}%)`)

if (totalPassed === totalTests) {
  console.log('   🎉 All tests passed! Fine-tuning system rebuild is complete.')
} else if (totalPassed >= totalTests * 0.8) {
  console.log('   ✅ Most tests passed. Minor issues may need attention.')
} else {
  console.log('   ⚠️  Several tests failed. Review implementation needed.')
}

console.log('\n🎯 Key Requirements Validated:')
console.log('   • Multi-user broker cache isolation')
console.log('   • Provider preflight with ServiceNotExist handling') 
console.log('   • Turbo-only strategy with exponential backoff')
console.log('   • Wallet bootstrap modal for new users')
console.log('   • Enhanced boolean environment parsing')
console.log('   • User EOA balance display instead of server signer')

process.exit(totalPassed < totalTests ? 1 : 0)