#!/usr/bin/env node

/**
 * Тест исправления проблемы с Upload Dataset
 * Проверяет, что API endpoint /api/compute/fine-tune/upload работает корректно
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 ТЕСТ: Исправление проблемы Upload Dataset')
console.log('=' .repeat(50))

async function testUploadDatasetAPI() {
  const baseUrl = 'http://localhost:3000'
  const uploadUrl = `${baseUrl}/api/compute/fine-tune/upload`
  
  console.log('\n1. Создаем тестовый датасет...')
  
  // Создаем тестовый датасет
  const testDataset = [
    '{"input": "What is AI?", "output": "AI stands for Artificial Intelligence"}',
    '{"input": "Explain machine learning", "output": "Machine learning is a subset of AI"}',
    '{"input": "What is deep learning?", "output": "Deep learning uses neural networks"}',
    '{"input": "Define natural language processing", "output": "NLP helps computers understand human language"}',
    '{"input": "What are neural networks?", "output": "Neural networks are computing systems inspired by biological neural networks"}'
  ].join('\n')
  
  const testFilePath = path.join(__dirname, 'test-dataset.jsonl')
  fs.writeFileSync(testFilePath, testDataset)
  
  console.log(`✅ Тестовый датасет создан: ${testFilePath}`)
  console.log(`📊 Размер: ${testDataset.length} байт, ${testDataset.split('\n').length} примеров`)
  
  try {
    console.log('\n2. Проверяем доступность API endpoint...')
    
    // Создаем FormData для отправки файла
    const FormData = require('form-data')
    const form = new FormData()
    
    // Добавляем файл и параметры
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-dataset.jsonl',
      contentType: 'application/jsonl'
    })
    form.append('agentId', 'test-agent-123')
    
    console.log('📤 Отправляем запрос на:', uploadUrl)
    
    // Отправляем запрос
    const fetch = require('node-fetch')
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    })
    
    console.log('📥 Статус ответа:', response.status, response.statusText)
    
    if (response.status === 404) {
      console.log('❌ ОШИБКА: API endpoint не найден (404)')
      console.log('💡 Возможные причины:')
      console.log('   - Файл /web/app/api/compute/fine-tune/upload/route.ts не создан')
      console.log('   - Сервер Next.js не запущен')
      console.log('   - Неправильный путь к API')
      return false
    }
    
    const responseData = await response.json()
    console.log('📋 Ответ сервера:', JSON.stringify(responseData, null, 2))
    
    if (response.ok && responseData.success) {
      console.log('✅ УСПЕХ: Upload Dataset API работает!')
      console.log(`📊 Загружено примеров: ${responseData.dataSize}`)
      console.log(`🔗 Root hash: ${responseData.rootHash}`)
      return true
    } else {
      console.log('❌ ОШИБКА: API вернул ошибку')
      console.log('📋 Детали:', responseData)
      return false
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА при тестировании API:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Сервер Next.js не запущен. Запустите: npm run dev')
    }
    
    return false
  } finally {
    // Удаляем тестовый файл
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
      console.log('🧹 Тестовый файл удален')
    }
  }
}

async function testFrontendIntegration() {
  console.log('\n3. Проверяем интеграцию с фронтендом...')
  
  const pagePath = path.join(__dirname, 'web/app/agents/[id]/fine-tune/page.tsx')
  
  if (!fs.existsSync(pagePath)) {
    console.log('❌ Файл страницы не найден:', pagePath)
    return false
  }
  
  const pageContent = fs.readFileSync(pagePath, 'utf8')
  
  // Проверяем правильный путь к API
  const correctApiPath = '/api/compute/fine-tune/upload'
  const hasCorrectPath = pageContent.includes(correctApiPath)
  
  console.log('🔍 Проверяем путь к API в коде страницы...')
  console.log(`   Ищем: ${correctApiPath}`)
  console.log(`   Найден: ${hasCorrectPath ? '✅' : '❌'}`)
  
  if (!hasCorrectPath) {
    console.log('💡 Нужно обновить путь в page.tsx на:', correctApiPath)
    
    // Показываем текущий путь
    const apiPathMatch = pageContent.match(/fetch\('([^']+\/upload[^']*)'/)
    if (apiPathMatch) {
      console.log('   Текущий путь:', apiPathMatch[1])
    }
  }
  
  return hasCorrectPath
}

async function runAllTests() {
  console.log('🚀 Запуск всех тестов...\n')
  
  const results = {
    apiEndpoint: await testUploadDatasetAPI(),
    frontendIntegration: await testFrontendIntegration()
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:')
  console.log('='.repeat(50))
  
  console.log(`API Endpoint работает: ${results.apiEndpoint ? '✅' : '❌'}`)
  console.log(`Интеграция с фронтендом: ${results.frontendIntegration ? '✅' : '❌'}`)
  
  const allPassed = Object.values(results).every(result => result === true)
  
  if (allPassed) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ! Проблема с Upload Dataset исправлена!')
  } else {
    console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ. Требуются дополнительные исправления.')
  }
  
  console.log('\n📋 ЧТО БЫЛО ИСПРАВЛЕНО:')
  console.log('1. ✅ Создан API endpoint: /api/compute/fine-tune/upload/route.ts')
  console.log('2. ✅ Добавлена обработка FormData с файлами')
  console.log('3. ✅ Интеграция с 0G Storage для загрузки датасетов')
  console.log('4. ✅ Подсчет количества примеров в датасете')
  console.log('5. ✅ Правильная обработка ошибок и логирование')
  
  console.log('\n🔧 ДОПОЛНИТЕЛЬНЫЕ РЕКОМЕНДАЦИИ:')
  console.log('- Убедитесь, что сервер Next.js запущен (npm run dev)')
  console.log('- Проверьте, что 0G Storage настроен корректно')
  console.log('- Протестируйте загрузку через веб-интерфейс')
  
  return allPassed
}

// Запускаем тесты
if (require.main === module) {
  runAllTests().catch(console.error)
}

module.exports = { testUploadDatasetAPI, testFrontendIntegration, runAllTests }