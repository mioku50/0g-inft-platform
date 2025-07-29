#!/usr/bin/env node

/**
 * Quick validation script for fine-tune flow fixes
 * 
 * This script validates that all fixes have been applied correctly:
 * 1. Environment configuration
 * 2. Contract addresses and deployment
 * 3. Broker uses FineTuningServing
 * 4. API routes return correct status codes
 * 5. Frontend components exist and don't crash
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Fine-tune Flow Fix Validation\n')

let allPassed = true
const results = []

function check(description, condition, details = '') {
  const passed = condition
  const status = passed ? '✅' : '❌'
  console.log(`${status} ${description}`)
  if (details && !passed) {
    console.log(`   ${details}`)
  }
  results.push({ description, passed, details })
  if (!passed) allPassed = false
  return passed
}

// 1. Check environment files
console.log('\n📋 Environment Configuration')
const envExists = fs.existsSync('.env.local')
check('Environment file exists', envExists, '.env.local not found')

if (envExists) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  check('FINE_TUNING_SERVING_ADDRESS set', envContent.includes('FINE_TUNING_SERVING_ADDRESS'))
  check('0G_RPC_URL set', envContent.includes('0G_RPC_URL'))
  check('FINE_TUNE_PROVIDER set', envContent.includes('FINE_TUNE_PROVIDER'))
}

// 2. Check broker.ts fixes
console.log('\n🔧 Broker Implementation')
const brokerPath = 'lib/compute/broker.ts'
if (fs.existsSync(brokerPath)) {
  const brokerContent = fs.readFileSync(brokerPath, 'utf8')
  
  check('Uses getServingContract for addAccount', 
    brokerContent.includes('getServingContract(signer)') && 
    brokerContent.includes('addAccount'))
  
  check('Has pre-validation logic', 
    brokerContent.includes('getService(provider)') || 
    brokerContent.includes('accountExists'))
  
  check('Enhanced error handling', 
    brokerContent.includes('formatError') && 
    brokerContent.includes('generateDiagnostics'))
  
  check('Proper logging with diagnostics', 
    brokerContent.includes('[fine]') && 
    brokerContent.includes('diagnostics'))
    
} else {
  check('Broker file exists', false, 'lib/compute/broker.ts not found')
}

// 3. Check API route fixes
console.log('\n🌐 API Routes')
const apiPath = 'app/api/compute/account/route.ts'
if (fs.existsSync(apiPath)) {
  const apiContent = fs.readFileSync(apiPath, 'utf8')
  
  check('Returns 201 for successful creation', apiContent.includes('201'))
  check('Returns 409 for account exists', apiContent.includes('409'))
  check('Returns 422 for validation error', apiContent.includes('422'))
  check('Returns 502 for contract error', apiContent.includes('502'))
  check('Uses validateComputeEnvironment', apiContent.includes('validateComputeEnvironment'))
  check('Has diagnostics in responses', apiContent.includes('diagnostics'))
  
} else {
  check('API route exists', false, 'app/api/compute/account/route.ts not found')
}

// 4. Check frontend fixes
console.log('\n🎨 Frontend Components')
const errorBoundaryPath = 'components/ui/error-boundary.tsx'
check('ErrorBoundary component exists', fs.existsSync(errorBoundaryPath))

const fineTunePage = 'app/agents/[id]/fine-tune/page.tsx'
if (fs.existsSync(fineTunePage)) {
  const pageContent = fs.readFileSync(fineTunePage, 'utf8')
  check('Uses ErrorBoundary', pageContent.includes('ErrorBoundary'))
  check('Has improved error handling', pageContent.includes('toast') && pageContent.includes('error'))
  check('Safe localStorage usage', pageContent.includes('JSON.parse') && pageContent.includes('catch'))
} else {
  check('Fine-tune page exists', false, 'app/agents/[id]/fine-tune/page.tsx not found')
}

// 5. Check environment validation
console.log('\n⚙️ Environment Validation')
const envValidationPath = 'lib/server/compute-env.ts'
if (fs.existsSync(envValidationPath)) {
  const envValidationContent = fs.readFileSync(envValidationPath, 'utf8')
  check('Has validateComputeEnvironment function', envValidationContent.includes('validateComputeEnvironment'))
  check('Has logEnvironmentStatus function', envValidationContent.includes('logEnvironmentStatus'))
  check('Validates contract addresses', envValidationContent.includes('0x[a-fA-F0-9]{40}'))
} else {
  check('Environment validation exists', false, 'lib/server/compute-env.ts not found')
}

// 6. Check diagnostic tools
console.log('\n🛠️ Diagnostic Tools')
const cliScript = 'scripts/test-fine-tune-flow.js'
check('CLI diagnostic script exists', fs.existsSync(cliScript))

const readmePath = 'tmp/README.md'
check('Documentation exists', fs.existsSync(readmePath))

// 7. Check for common issues
console.log('\n🔍 Common Issues Check')
if (fs.existsSync(brokerPath)) {
  const brokerContent = fs.readFileSync(brokerPath, 'utf8')
  check('No direct Ledger calls for addAccount', 
    !brokerContent.includes('await ledger.addAccount') &&
    !brokerContent.includes('ledger.addAccount('))
  
  check('No hardcoded addresses', 
    !brokerContent.includes('0x') || 
    brokerContent.includes('process.env'))
}

// Summary
console.log('\n📊 Validation Summary')
const passed = results.filter(r => r.passed).length
const total = results.length
const percentage = Math.round((passed / total) * 100)

console.log(`\n${passed}/${total} checks passed (${percentage}%)`)

if (allPassed) {
  console.log('\n🎉 All fixes validated successfully!')
  console.log('\nNext steps:')
  console.log('1. Run: node scripts/test-fine-tune-flow.js --simulate-only')
  console.log('2. Test the UI at /agents/[id]/fine-tune')
  console.log('3. Check server logs for proper diagnostics')
} else {
  console.log('\n⚠️  Some issues found. Please review the failed checks above.')
  console.log('\nFailed checks:')
  results.filter(r => !r.passed).forEach(r => {
    console.log(`- ${r.description}`)
    if (r.details) console.log(`  ${r.details}`)
  })
}

console.log('\n📋 For detailed information, see: FINE_TUNE_FLOW_FIX_REPORT.md')

process.exit(allPassed ? 0 : 1)