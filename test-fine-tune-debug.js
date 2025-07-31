#!/usr/bin/env node

/**
 * Fine Tune Debug Test Script
 * Диагностика проблем с Upload Dataset и Ledger Balance
 */

const https = require('https');
const http = require('http');

console.log('🚀 Fine Tune Debug Test Starting...\n');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || '1';

async function testLedgerBalanceAPI() {
  console.log('📊 Testing Ledger Balance API...');
  console.log('URL:', BASE_URL + '/api/compute/fine-tune/account');
  console.log('');
}

async function runAllTests() {
  console.log('Testing Fine Tune functionality on', BASE_URL);
  await testLedgerBalanceAPI();
  console.log('🎉 Fine Tune Debug Test Complete!');
}

runAllTests().catch(console.error);
