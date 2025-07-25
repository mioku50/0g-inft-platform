#!/usr/bin/env node

// Простая проверка ENV переменных
console.log('🩺 Testing ENV variables...\n')

const requiredVars = [
  'OG_RPC_URL',
  'OG_COMPUTE_PRIVATE_KEY', 
  'FINE_TUNING_SERVING_ADDRESS',
  'FINE_TUNE_PROVIDER'
]

const optionalVars = [
  'COMPUTE_LEDGER_CONTRACT',
  'COMPUTE_INFERENCE_CONTRACT'
]

let hasErrors = false

console.log('Required variables:')
requiredVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`)
  } else {
    console.log(`❌ ${varName}: NOT SET`)
    hasErrors = true
  }
})

console.log('\nOptional variables:')
optionalVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`✅ ${varName}: ${value}`)
  } else {
    console.log(`⚠️  ${varName}: Using default`)
  }
})

if (hasErrors) {
  console.log('\n❌ Some required variables are missing!')
  console.log('Make sure .env.local is configured properly.')
  process.exit(1)
} else {
  console.log('\n🎉 All required ENV variables are set!')
}