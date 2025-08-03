#!/usr/bin/env node
/**
 * Test parseBoolEnv utility function
 */

// Import the function (this is a temporary test file)
const { parseBoolEnv } = require('./dist/lib/server/compute-env.js');

console.log('Testing parseBoolEnv utility function...\n');

// Test cases
const testCases = [
  { env: '1', expected: true, description: 'String "1"' },
  { env: 'true', expected: true, description: 'String "true"' },
  { env: 'TRUE', expected: true, description: 'String "TRUE"' },
  { env: 'yes', expected: true, description: 'String "yes"' },
  { env: 'YES', expected: true, description: 'String "YES"' },
  { env: 'on', expected: true, description: 'String "on"' },
  { env: 'enable', expected: true, description: 'String "enable"' },
  { env: 'enabled', expected: true, description: 'String "enabled"' },
  
  { env: '0', expected: false, description: 'String "0"' },
  { env: 'false', expected: false, description: 'String "false"' },
  { env: 'FALSE', expected: false, description: 'String "FALSE"' },
  { env: 'no', expected: false, description: 'String "no"' },
  { env: 'NO', expected: false, description: 'String "NO"' },
  { env: 'off', expected: false, description: 'String "off"' },
  { env: 'disable', expected: false, description: 'String "disable"' },
  { env: 'disabled', expected: false, description: 'String "disabled"' },
  
  // Test comment handling
  { env: '1 # this is a comment', expected: true, description: 'Value with comment' },
  { env: 'true # another comment', expected: true, description: 'True with comment' },
  { env: 'false # comment here', expected: false, description: 'False with comment' },
  
  // Test edge cases
  { env: '', expected: false, description: 'Empty string (should use default)' },
  { env: 'invalid', expected: false, description: 'Invalid value (should use default)' },
  { env: '  true  ', expected: true, description: 'True with whitespace' },
  { env: '  false  ', expected: false, description: 'False with whitespace' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ env, expected, description }) => {
  // Set environment variable
  process.env.TEST_VAR = env;
  
  try {
    const result = parseBoolEnv('TEST_VAR', false);
    if (result === expected) {
      console.log(`✅ PASS: ${description} -> ${result}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${description} -> expected ${expected}, got ${result}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${description} -> ${error.message}`);
    failed++;
  }
  
  // Clean up
  delete process.env.TEST_VAR;
});

// Test default value when env var is not set
delete process.env.TEST_VAR;
const defaultResult = parseBoolEnv('TEST_VAR', true);
if (defaultResult === true) {
  console.log(`✅ PASS: Default value handling -> ${defaultResult}`);
  passed++;
} else {
  console.log(`❌ FAIL: Default value handling -> expected true, got ${defaultResult}`);
  failed++;
}

console.log(`\nTest Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);

if (failed === 0) {
  console.log(`\n🎉 All tests passed!`);
  process.exit(0);
} else {
  console.log(`\n💥 ${failed} test(s) failed!`);
  process.exit(1);
}