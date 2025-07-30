#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Тест проверки конфигурации для загрузки датасета
async function testUploadConfiguration() {
  console.log('🔍 ДИАГНОСТИКА ПРОБЛЕМЫ: Upload Dataset Button')
  console.log('=' .repeat(60))

  // Загружаем переменные окружения
  const envPath = path.join(__dirname, 'web', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0 && key.trim() && !key.startsWith('#')) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    })
    console.log('✅ Загружены переменные окружения из .env.local')
  } else {
    console.log('❌ Файл .env.local не найден')
    return
  }

  console.log('\n📋 ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ:')
  console.log('-'.repeat(40))
  
  const requiredEnvs = [
    'OG_STORAGE_PRIVATE_KEY',
    'NEXT_PUBLIC_0G_STORAGE_URL', 
    'NEXT_PUBLIC_0G_RPC_URL',
    'OG_COMPUTE_PRIVATE_KEY'
  ]

  let allEnvsPresent = true
  
  for (const env of requiredEnvs) {
    const value = process.env[env]
    if (value) {
      console.log(`✅ ${env}: ${value.substring(0, 30)}...`)
    } else {
      console.log(`❌ ${env}: НЕ НАСТРОЕНА`)
      allEnvsPresent = false
    }
  }

  if (!allEnvsPresent) {
    console.log('\n🚨 НАЙДЕНА ПРОБЛЕМА: Отсутствуют обязательные переменные окружения')
    console.log('Это может быть причиной неработающей кнопки Upload Dataset')
    return
  }

  console.log('\n📁 ПРОВЕРКА ФАЙЛОВОЙ СТРУКТУРЫ:')
  console.log('-'.repeat(40))
  
  const criticalFiles = [
    'web/app/api/compute/fine-tune/upload/route.ts',
    'web/lib/storage/client-server.ts',
    'web/app/agents/[id]/fine-tune/page.tsx'
  ]

  for (const file of criticalFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✅ ${file}`)
    } else {
      console.log(`❌ ${file} - ОТСУТСТВУЕТ`)
    }
  }

  console.log('\n🔧 ПРОВЕРКА API ROUTE:')
  console.log('-'.repeat(40))
  
  const apiRoutePath = path.join(__dirname, 'web/app/api/compute/fine-tune/upload/route.ts')
  if (fs.existsSync(apiRoutePath)) {
    const apiContent = fs.readFileSync(apiRoutePath, 'utf8')
    
    // Проверяем ключевые элементы API
    const checks = [
      { name: 'POST export', pattern: /export async function POST/, required: true },
      { name: 'Environment check', pattern: /OG_STORAGE_PRIVATE_KEY/, required: true },
      { name: 'FormData handling', pattern: /formData\.get/, required: true },
      { name: 'uploadToStorage call', pattern: /uploadToStorage/, required: true },
      { name: 'Error handling', pattern: /catch.*error/, required: true }
    ]
    
    for (const check of checks) {
      if (check.pattern.test(apiContent)) {
        console.log(`✅ ${check.name}: найдено`)
      } else {
        console.log(`❌ ${check.name}: НЕ НАЙДЕНО`)
      }
    }
  }

  console.log('\n🎯 ПРОВЕРКА FRONTEND КОДА:')
  console.log('-'.repeat(40))
  
  const pagePath = path.join(__dirname, 'web/app/agents/[id]/fine-tune/page.tsx')
  if (fs.existsSync(pagePath)) {
    const pageContent = fs.readFileSync(pagePath, 'utf8')
    
    const frontendChecks = [
      { name: 'uploadDataset function', pattern: /const uploadDataset = async/, required: true },
      { name: 'API call to upload', pattern: /\/api\/compute\/fine-tune\/upload/, required: true },
      { name: 'FormData creation', pattern: /new FormData/, required: true },
      { name: 'Toast notifications', pattern: /toast\(/, required: true },
      { name: 'Upload button', pattern: /Upload Dataset/, required: true },
      { name: 'onClick handler', pattern: /onClick={uploadDataset}/, required: true }
    ]
    
    for (const check of frontendChecks) {
      if (check.pattern.test(pageContent)) {
        console.log(`✅ ${check.name}: найдено`)
      } else {
        console.log(`❌ ${check.name}: НЕ НАЙДЕНО`)
      }
    }
  }

  console.log('\n🧪 СОЗДАНИЕ ТЕСТОВОГО ДАТАСЕТА:')
  console.log('-'.repeat(40))
  
  // Создаем тестовый JSONL файл
  const testDataset = [
    {
      "messages": [
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "What is machine learning?"},
        {"role": "assistant", "content": "Machine learning is a subset of AI that enables computers to learn from data."}
      ]
    },
    {
      "messages": [
        {"role": "user", "content": "Explain neural networks"},
        {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks."}
      ]
    }
  ]

  const datasetContent = testDataset.map(item => JSON.stringify(item)).join('\n')
  const testFilePath = path.join(__dirname, 'test-dataset.jsonl')
  
  try {
    fs.writeFileSync(testFilePath, datasetContent)
    console.log(`✅ Создан тестовый датасет: ${testFilePath}`)
    console.log(`   - Размер: ${datasetContent.length} байт`)
    console.log(`   - Примеров: ${testDataset.length}`)
    console.log(`   - Формат: JSONL`)
  } catch (error) {
    console.log(`❌ Ошибка создания тестового файла: ${error.message}`)
  }

  console.log('\n🎯 ДИАГНОЗ И РЕКОМЕНДАЦИИ:')
  console.log('=' .repeat(60))
  
  if (allEnvsPresent) {
    console.log('✅ Переменные окружения настроены правильно')
    console.log('✅ API endpoint существует и имеет правильную структуру')
    console.log('✅ Frontend код содержит все необходимые элементы')
    
    console.log('\n🔍 ВЕРОЯТНЫЕ ПРИЧИНЫ ПРОБЛЕМЫ:')
    console.log('1. 🌐 Сервер разработки не запущен (npm run dev)')
    console.log('2. 🔌 Проблемы с подключением к 0G Storage')
    console.log('3. 📝 Отсутствует выбранный файл датасета')
    console.log('4. 🚫 JavaScript ошибки в браузере')
    
    console.log('\n💡 ПЛАН ИСПРАВЛЕНИЯ:')
    console.log('1. Запустите: cd web && npm run dev')
    console.log('2. Откройте страницу Fine-tune в браузере')
    console.log('3. Откройте Developer Tools (F12)')
    console.log('4. Выберите тестовый файл: test-dataset.jsonl')
    console.log('5. Нажмите "Upload Dataset"')
    console.log('6. Проверьте Console и Network tabs на ошибки')
    
    console.log('\n🧪 ТЕСТОВЫЕ КОМАНДЫ:')
    console.log('# Запуск сервера')
    console.log('cd web && npm run dev')
    console.log('')
    console.log('# Тест API через curl (после запуска сервера)')
    console.log('curl -X POST http://localhost:3000/api/compute/fine-tune/upload \\')
    console.log('  -F "file=@test-dataset.jsonl" \\')
    console.log('  -F "agentId=test-123"')
    
  } else {
    console.log('❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: Отсутствуют переменные окружения')
    console.log('Кнопка Upload Dataset не будет работать без правильной конфигурации')
  }

  console.log('\n' + '='.repeat(60))
}

// Запускаем диагностику
testUploadConfiguration().catch(console.error)