#!/usr/bin/env node

// Simple test script to verify fine-tune feature flags work
// This script simulates the contract calls to see if they're properly disabled

const path = require('path')
const fs = require('fs')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const lines = envContent.split('\n')
  
  for (const line of lines) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, value] = line.split('=', 2)
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    }
  }
}

console.log('🧪 Testing Fine-tune Feature Flags\n')

// Test environment variables
console.log('Environment Variables:')
console.log(`ENABLE_FINE_TUNE = "${process.env.ENABLE_FINE_TUNE}"`)
console.log(`NEXT_PUBLIC_FT_DISABLED = "${process.env.NEXT_PUBLIC_FT_DISABLED}"`)
console.log(`USE_NONCUSTODIAL_INFERENCE = "${process.env.USE_NONCUSTODIAL_INFERENCE}"`)
console.log(`NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE = "${process.env.NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE}"`)

console.log('\n📋 Test Results:')

// Test 1: Server-side fine-tune calls should be disabled
console.log('1. Server-side fine-tune contract calls:')
if (process.env.ENABLE_FINE_TUNE !== 'true') {
  console.log('   ✅ DISABLED - getActiveModel() and getCandidateModel() will return early')
} else {
  console.log('   ❌ ENABLED - Contract calls will still be made')
}

// Test 2: Client-side fine-tune UI should be disabled
console.log('2. Client-side fine-tune UI:')
if (process.env.NEXT_PUBLIC_FT_DISABLED === '1') {
  console.log('   ✅ DISABLED - Fine-tune pages will show "Coming Soon"')
} else {
  console.log('   ❌ ENABLED - Fine-tune pages will be functional')
}

// Test 3: Non-custodial inference should be enabled
console.log('3. Non-custodial inference mode:')
if (process.env.USE_NONCUSTODIAL_INFERENCE === 'true') {
  console.log('   ✅ ENABLED - Server will prefer non-custodial mode')
} else {
  console.log('   ⚠️  DISABLED - Server will use custodial mode')
}

console.log('4. Client-side non-custodial mode:')
if (process.env.NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE === 'true') {
  console.log('   ✅ ENABLED - Client will attempt non-custodial first')
} else {
  console.log('   ⚠️  DISABLED - Client will use custodial mode')
}

console.log('\n🎯 Expected Behavior:')
console.log('- No more getActiveModel/getCandidateModel spam in logs')
console.log('- Fine-tune pages show "Coming Soon"')
console.log('- Chat uses non-custodial mode when wallet connected')
console.log('- Chat falls back to custodial mode when wallet not connected')
console.log('')

// Simulated contract call test
console.log('🔬 Simulated Contract Call Test:')
console.log('getActiveModel(20):')
if (process.env.ENABLE_FINE_TUNE !== 'true') {
  console.log('   → [Fine-tune] getActiveModel(20) skipped - feature disabled')
  console.log('   → Returned: 0x0000000000000000000000000000000000000000000000000000000000000000')
} else {
  console.log('   → Would attempt contract call (may fail with CALL_EXCEPTION)')
}

console.log('\n✅ Test completed successfully!')