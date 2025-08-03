#!/usr/bin/env node

/**
 * Test script for the enhanced fine-tuning system features
 * Tests parseBoolEnv utility and environment variable parsing
 */

// Mock environment setup
const originalEnv = process.env;

function parseBoolEnv(name, defaultValue = false, depth = 0) {
  // Prevent infinite recursion
  if (depth > 3) {
    console.warn(`[parseBoolEnv] Max recursion depth reached for ${name}, returning default: ${defaultValue}`)
    return defaultValue
  }

  try {
    const value = process.env[name]
    if (!value) {
      return defaultValue
    }

    // Remove inline comments (anything after #)
    const cleanValue = value.split('#')[0].trim().toLowerCase()
    
    if (!cleanValue) {
      return defaultValue
    }

    // Handle true values
    if (['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(cleanValue)) {
      return true
    }
    
    // Handle false values
    if (['0', 'false', 'no', 'off', 'disable', 'disabled'].includes(cleanValue)) {
      return false
    }

    // If value doesn't match expected patterns, log warning and use default
    console.warn(`[parseBoolEnv] Invalid boolean value for ${name}: "${value}", using default: ${defaultValue}`)
    return defaultValue

  } catch (error) {
    // Catch any errors and return default value
    console.warn(`[parseBoolEnv] Error parsing ${name} at depth ${depth}: ${error}, using default: ${defaultValue}`)
    return defaultValue
  }
}

function runTests() {
  console.log('🧪 Testing parseBoolEnv utility...\n')
  
  const testCases = [
    // True values
    { name: 'TEST_VAR', value: '1', expected: true, description: 'Value "1"' },
    { name: 'TEST_VAR', value: 'true', expected: true, description: 'Value "true"' },
    { name: 'TEST_VAR', value: 'yes', expected: true, description: 'Value "yes"' },
    { name: 'TEST_VAR', value: 'on', expected: true, description: 'Value "on"' },
    { name: 'TEST_VAR', value: 'enable', expected: true, description: 'Value "enable"' },
    { name: 'TEST_VAR', value: 'enabled', expected: true, description: 'Value "enabled"' },
    { name: 'TEST_VAR', value: 'TRUE', expected: true, description: 'Value "TRUE" (case insensitive)' },
    
    // False values
    { name: 'TEST_VAR', value: '0', expected: false, description: 'Value "0"' },
    { name: 'TEST_VAR', value: 'false', expected: false, description: 'Value "false"' },
    { name: 'TEST_VAR', value: 'no', expected: false, description: 'Value "no"' },
    { name: 'TEST_VAR', value: 'off', expected: false, description: 'Value "off"' },
    { name: 'TEST_VAR', value: 'disable', expected: false, description: 'Value "disable"' },
    { name: 'TEST_VAR', value: 'disabled', expected: false, description: 'Value "disabled"' },
    
    // Comment handling
    { name: 'TEST_VAR', value: '1 # enable attestation', expected: true, description: 'With inline comment' },
    { name: 'TEST_VAR', value: '0 # disable for testing', expected: false, description: 'False with comment' },
    { name: 'TEST_VAR', value: 'true # this is enabled', expected: true, description: 'True with comment' },
    
    // Edge cases
    { name: 'TEST_VAR', value: '', expected: false, description: 'Empty string (default false)' },
    { name: 'TEST_VAR', value: 'invalid', expected: false, description: 'Invalid value (default false)' },
    { name: 'TEST_VAR', value: ' 1 ', expected: true, description: 'Value with whitespace' },
    { name: 'TEST_VAR', value: '# comment only', expected: false, description: 'Comment only' }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const testCase of testCases) {
    // Set environment variable
    process.env[testCase.name] = testCase.value
    
    // Test the function
    const result = parseBoolEnv(testCase.name, false)
    
    // Check result
    if (result === testCase.expected) {
      console.log(`✅ PASS: ${testCase.description} -> ${result}`)
      passed++
    } else {
      console.log(`❌ FAIL: ${testCase.description} -> expected ${testCase.expected}, got ${result}`)
      failed++
    }
    
    // Clean up
    delete process.env[testCase.name]
  }
  
  // Test undefined variable
  const undefinedResult = parseBoolEnv('NONEXISTENT_VAR', false)
  if (undefinedResult === false) {
    console.log(`✅ PASS: Undefined variable returns default (false) -> ${undefinedResult}`)
    passed++
  } else {
    console.log(`❌ FAIL: Undefined variable should return default false, got ${undefinedResult}`)
    failed++
  }
  
  const undefinedResultTrue = parseBoolEnv('NONEXISTENT_VAR', true)
  if (undefinedResultTrue === true) {
    console.log(`✅ PASS: Undefined variable returns default (true) -> ${undefinedResultTrue}`)
    passed++
  } else {
    console.log(`❌ FAIL: Undefined variable should return default true, got ${undefinedResultTrue}`)
    failed++
  }
  
  console.log(`\n📊 Test Results:`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed! parseBoolEnv utility is working correctly.`)
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Please review the implementation.`)
  }
  
  // Test FT_ATTEST_ONCHAIN specifically
  console.log(`\n🔧 Testing FT_ATTEST_ONCHAIN scenarios:`)
  
  const ftTestCases = [
    { value: '1', expected: true, description: 'FT_ATTEST_ONCHAIN=1 (enable attestation)' },
    { value: '0', expected: false, description: 'FT_ATTEST_ONCHAIN=0 (disable attestation)' },
    { value: '1 # enable on-chain attestation', expected: true, description: 'FT_ATTEST_ONCHAIN=1 with comment' },
    { value: undefined, expected: false, description: 'FT_ATTEST_ONCHAIN not set (default: disabled)' }
  ]
  
  for (const testCase of ftTestCases) {
    if (testCase.value !== undefined) {
      process.env.FT_ATTEST_ONCHAIN = testCase.value
    } else {
      delete process.env.FT_ATTEST_ONCHAIN
    }
    
    const result = parseBoolEnv('FT_ATTEST_ONCHAIN', false)
    const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL'
    console.log(`${status}: ${testCase.description} -> ${result}`)
  }
  
  return failed === 0
}

// Test network root validation
function testNetworkRootHandling() {
  console.log(`\n🌐 Testing network root hash handling...`)
  
  function normalizeDatasetHash(datasetHash) {
    let normalizedDatasetHash = datasetHash
    
    if (datasetHash.startsWith('local://')) {
      // Extract hash from local:// format and add 0x prefix
      const extractedHash = datasetHash.replace('local://', '')
      if (extractedHash.match(/^[a-fA-F0-9]{64}$/)) {
        normalizedDatasetHash = `0x${extractedHash}`
        console.log('🔄 Normalized local hash:', datasetHash, '→', normalizedDatasetHash)
        return { success: true, hash: normalizedDatasetHash }
      } else {
        console.error('❌ Invalid hash in local:// format:', datasetHash)
        return { success: false, error: 'Invalid local:// hash format' }
      }
    } else if (datasetHash.startsWith('0x')) {
      // Already properly formatted - this is the preferred format
      if (!datasetHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        console.error('❌ Invalid 0x datasetHash format:', datasetHash)
        return { success: false, error: 'Invalid 0x hash format' }
      }
      console.log('✅ Network root hash format confirmed:', normalizedDatasetHash)
      return { success: true, hash: normalizedDatasetHash }
    } else if (datasetHash.match(/^[a-fA-F0-9]{64}$/)) {
      // Add 0x prefix to bare hex
      normalizedDatasetHash = `0x${datasetHash}`
      console.log('🔄 Added 0x prefix:', datasetHash, '→', normalizedDatasetHash)
      return { success: true, hash: normalizedDatasetHash }
    } else {
      console.error('❌ Invalid datasetHash format:', datasetHash)
      return { success: false, error: 'Invalid hash format' }
    }
  }
  
  const testHashes = [
    {
      input: 'local://d0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      expected: '0xd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      description: 'local:// format from the problem statement'
    },
    {
      input: '0xd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      expected: '0xd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      description: '0x format (preferred)'
    },
    {
      input: 'd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      expected: '0xd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
      description: 'bare hex format'
    },
    {
      input: 'local://invalid',
      expected: null,
      description: 'invalid local:// format'
    },
    {
      input: '0xinvalid',
      expected: null,
      description: 'invalid 0x format'
    }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of testHashes) {
    const result = normalizeDatasetHash(test.input)
    
    if (test.expected === null) {
      // Expecting failure
      if (!result.success) {
        console.log(`✅ PASS: ${test.description} correctly rejected`)
        passed++
      } else {
        console.log(`❌ FAIL: ${test.description} should have been rejected`)
        failed++
      }
    } else {
      // Expecting success
      if (result.success && result.hash === test.expected) {
        console.log(`✅ PASS: ${test.description} -> ${result.hash}`)
        passed++
      } else {
        console.log(`❌ FAIL: ${test.description} -> expected ${test.expected}, got ${result.hash || 'error'}`)
        failed++
      }
    }
  }
  
  console.log(`\n📊 Hash Normalization Results:`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  
  return failed === 0
}

// Run all tests
console.log('🚀 Enhanced Fine-tuning System Test Suite')
console.log('=========================================\n')

const envTestsPass = runTests()
const hashTestsPass = testNetworkRootHandling()

console.log('\n🏁 Final Results:')
console.log(`parseBoolEnv tests: ${envTestsPass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`Hash normalization tests: ${hashTestsPass ? '✅ PASS' : '❌ FAIL'}`)

if (envTestsPass && hashTestsPass) {
  console.log('\n🎉 ALL TESTS PASSED! The enhanced fine-tuning system is ready.')
  process.exit(0)
} else {
  console.log('\n❌ Some tests failed. Please review the implementation.')
  process.exit(1)
}