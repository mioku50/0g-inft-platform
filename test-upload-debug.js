#!/usr/bin/env node

/**
 * Test script для проверки Upload Dataset API
 * Запуск: node test-upload-debug.js
 */

const fs = require('fs')
const FormData = require('form-data')

// Создаем тестовый датасет
const testDataset = `{"messages": [
  {"role": "system", "content": "You are a helpful AI assistant."},
  {"role": "user", "content": "What is machine learning?"},
  {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed."}
]}
{"messages": [
  {"role": "user", "content": "Explain neural networks"},
  {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information and learn patterns from data."}
]}
{"messages": [
  {"role": "user", "content": "What is deep learning?"},
  {"role": "assistant", "content": "Deep learning is a subset of machine learning that uses neural networks with multiple layers to learn complex patterns and representations from data."}
]}`

async function testUploadDataset() {
  console.log('🧪 [TEST] Starting Upload Dataset test...')
  
  try {
    // Создаем временный файл
    const tempFile = 'test-dataset.jsonl'
    fs.writeFileSync(tempFile, testDataset)
    console.log('📁 [TEST] Created test dataset file:', tempFile)
    
    // Создаем FormData
    const formData = new FormData()
    formData.append('file', fs.createReadStream(tempFile))
    formData.append('agentId', 'test-123')
    
    console.log('📤 [TEST] Making API request to /api/storage/upload-dataset...')
    
    const response = await fetch('http://localhost:3000/api/storage/upload-dataset', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    })
    
    console.log('📥 [TEST] API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ [TEST] Upload successful:', data)
    } else {
      const errorText = await response.text()
      console.error('❌ [TEST] Upload failed:', errorText)
    }
    
    // Удаляем временный файл
    fs.unlinkSync(tempFile)
    console.log('🗑️ [TEST] Cleaned up test file')
    
  } catch (error) {
    console.error('💥 [TEST] Test failed:', error)
  }
}

async function testAccountInfo() {
  console.log('🏦 [TEST] Testing account info API...')
  
  try {
    const response = await fetch('http://localhost:3000/api/compute/fine-tune/account')
    
    console.log('📥 [TEST] Account API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ [TEST] Account info:', data)
    } else {
      const errorText = await response.text()
      console.error('❌ [TEST] Account info failed:', errorText)
    }
    
  } catch (error) {
    console.error('💥 [TEST] Account test failed:', error)
  }
}

async function runTests() {
  console.log('🚀 [TEST] Starting Fine-tune API tests...')
  console.log('🔧 [TEST] Make sure the Next.js dev server is running on localhost:3000')
  console.log('🔧 [TEST] And NEXT_PUBLIC_DEBUG_FINE_TUNE=true is set')
  console.log('')
  
  await testAccountInfo()
  console.log('')
  await testUploadDataset()
  
  console.log('')
  console.log('✨ [TEST] Tests completed!')
}

// Запускаем тесты
runTests().catch(console.error)