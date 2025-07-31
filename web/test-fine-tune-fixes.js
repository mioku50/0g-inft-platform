#!/usr/bin/env node

console.log('🧪 TESTING FINE TUNE FIXES')
console.log('==========================\n')

// Test environment variables
const envFile = '.env.local'
const fs = require('fs')

if (fs.existsSync(envFile)) {
  console.log('✅ .env.local file exists')
  
  const envContent = fs.readFileSync(envFile, 'utf8')
  const hasFineTuneVars = envContent.includes('FINE_TUNING_SERVING_ADDRESS')
  const hasStorageKey = envContent.includes('OG_STORAGE_PRIVATE_KEY')
  
  console.log('✅ Fine Tune variables:', hasFineTuneVars ? 'PRESENT' : 'MISSING')
  console.log('✅ Storage private key:', hasStorageKey ? 'PRESENT' : 'MISSING')
} else {
  console.log('❌ .env.local file not found')
}

console.log('\n�� Environment check complete!')
