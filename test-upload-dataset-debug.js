#!/usr/bin/env node

/**
 * Debug test for Upload Dataset functionality
 * Tests the /api/compute/fine-tune/upload endpoint
 */

const fs = require('fs')
const path = require('path')

// Create test dataset file
const testDataset = `{"messages": [
  {"role": "system", "content": "You are a helpful AI assistant."},
  {"role": "user", "content": "What is machine learning?"},
  {"role": "assistant", "content": "Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed."}
]}
{"messages": [
  {"role": "user", "content": "Explain neural networks"},
  {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information."}
]}
{"messages": [
  {"role": "user", "content": "What is deep learning?"},
  {"role": "assistant", "content": "Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data."}
]}
`

async function testUploadDataset() {
  console.log('🧪 Testing Upload Dataset functionality...\n')

  try {
    // Create temporary test file
    const testFile = path.join(__dirname, 'temp-test-dataset.jsonl')
    fs.writeFileSync(testFile, testDataset)
    console.log('✅ Created test dataset file:', testFile)
    console.log('📊 Dataset size:', testDataset.length, 'bytes')
    console.log('📋 Dataset lines:', testDataset.trim().split('\n').length)

    // Test 1: Check if file can be read
    const fileContent = fs.readFileSync(testFile, 'utf-8')
    console.log('\n📖 File content preview:')
    console.log(fileContent.substring(0, 100) + '...')

    // Test 2: Simulate FormData creation (like in browser)
    const FormData = require('form-data')
    const form = new FormData()
    form.append('file', fs.createReadStream(testFile), {
      filename: 'test-dataset.jsonl',
      contentType: 'application/jsonl'
    })
    form.append('agentId', '123')

    console.log('\n📦 FormData created successfully')
    console.log('🔑 Form fields:', Object.keys(form.getHeaders()))

    // Test 3: Make API request
    const fetch = require('node-fetch')
    const API_URL = 'http://localhost:3000/api/compute/fine-tune/upload'
    
    console.log('\n🌐 Making API request to:', API_URL)
    
    const response = await fetch(API_URL, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    })

    console.log('📡 Response status:', response.status, response.statusText)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('📄 Response body:', responseText)

    if (response.ok) {
      const data = JSON.parse(responseText)
      console.log('\n✅ Upload successful!')
      console.log('🔗 Root hash:', data.rootHash)
      console.log('📊 Data size:', data.dataSize)
      console.log('📁 Filename:', data.filename)
    } else {
      console.log('\n❌ Upload failed!')
      try {
        const errorData = JSON.parse(responseText)
        console.log('🚨 Error details:', errorData)
      } catch (e) {
        console.log('🚨 Raw error:', responseText)
      }
    }

    // Cleanup
    fs.unlinkSync(testFile)
    console.log('\n🧹 Cleaned up test file')

  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
    console.error('📍 Stack trace:', error.stack)
  }
}

// Test environment variables
console.log('🔧 Environment check:')
console.log('- OG_STORAGE_PRIVATE_KEY:', process.env.OG_STORAGE_PRIVATE_KEY ? '✅ Set' : '❌ Missing')
console.log('- NEXT_PUBLIC_0G_STORAGE_URL:', process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'Using default')
console.log('- NEXT_PUBLIC_0G_RPC_URL:', process.env.NEXT_PUBLIC_0G_RPC_URL || 'Using default')
console.log('')

// Run test
testUploadDataset()