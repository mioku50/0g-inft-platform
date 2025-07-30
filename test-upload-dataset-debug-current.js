#!/usr/bin/env node

/**
 * 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ: Upload Dataset Button
 * 
 * Проверяет:
 * 1. Существование API endpoint
 * 2. Работоспособность API
 * 3. Переменные окружения
 * 4. Интеграцию фронтенда
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 ДИАГНОСТИКА: Upload Dataset Button')
console.log('=' .repeat(50))

// 1. Проверка API endpoint
console.log('\n1. 📁 Проверка API endpoint...')
const apiPath = path.join(__dirname, 'web/app/api/compute/fine-tune/upload/route.ts')
if (fs.existsSync(apiPath)) {
  console.log('   ✅ API endpoint существует:', apiPath)
  
  const apiContent = fs.readFileSync(apiPath, 'utf8')
  if (apiContent.includes('export async function POST')) {
    console.log('   ✅ POST метод реализован')
  } else {
    console.log('   ❌ POST метод не найден')
  }
  
  if (apiContent.includes('formData.get(\'file\')')) {
    console.log('   ✅ Обработка FormData реализована')
  } else {
    console.log('   ❌ Обработка FormData не найдена')
  }
} else {
  console.log('   ❌ API endpoint НЕ СУЩЕСТВУЕТ:', apiPath)
}

// 2. Проверка фронтенда
console.log('\n2. 🖥️ Проверка фронтенда...')
const pagePath = path.join(__dirname, 'web/app/agents/[id]/fine-tune/page.tsx')
if (fs.existsSync(pagePath)) {
  console.log('   ✅ Fine-tune страница существует')
  
  const pageContent = fs.readFileSync(pagePath, 'utf8')
  if (pageContent.includes('fetch(\'/api/compute/fine-tune/upload\'')) {
    console.log('   ✅ Fetch запрос к правильному API')
  } else {
    console.log('   ❌ Fetch запрос не найден или неправильный путь')
  }
  
  if (pageContent.includes('uploadDataset')) {
    console.log('   ✅ Функция uploadDataset существует')
  } else {
    console.log('   ❌ Функция uploadDataset не найдена')
  }
  
  if (pageContent.includes('onClick') && pageContent.includes('uploadDataset')) {
    console.log('   ✅ Кнопка связана с функцией')
  } else {
    console.log('   ❌ Кнопка не связана с функцией')
  }
} else {
  console.log('   ❌ Fine-tune страница НЕ СУЩЕСТВУЕТ:', pagePath)
}

// 3. Проверка переменных окружения
console.log('\n3. 🔧 Проверка переменных окружения...')
const envFiles = [
  '.env.local',
  '.env',
  'web/.env.local',
  'web/.env'
]

let envFound = false
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, envFile)
  if (fs.existsSync(envPath)) {
    console.log(`   ✅ Найден файл окружения: ${envFile}`)
    envFound = true
    
    const envContent = fs.readFileSync(envPath, 'utf8')
    if (envContent.includes('OG_STORAGE_PRIVATE_KEY')) {
      console.log('   ✅ OG_STORAGE_PRIVATE_KEY настроен')
    } else {
      console.log('   ⚠️ OG_STORAGE_PRIVATE_KEY не найден в', envFile)
    }
  }
}

if (!envFound) {
  console.log('   ⚠️ Файлы окружения не найдены')
}

// 4. Проверка зависимостей
console.log('\n4. 📦 Проверка зависимостей...')
const packagePath = path.join(__dirname, 'web/package.json')
if (fs.existsSync(packagePath)) {
  console.log('   ✅ package.json найден')
  
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const deps = { ...packageContent.dependencies, ...packageContent.devDependencies }
  
  if (deps['next']) {
    console.log('   ✅ Next.js установлен:', deps['next'])
  } else {
    console.log('   ❌ Next.js не найден')
  }
} else {
  console.log('   ❌ package.json не найден')
}

// 5. Проверка структуры проекта
console.log('\n5. 🏗️ Проверка структуры проекта...')
const webDir = path.join(__dirname, 'web')
if (fs.existsSync(webDir)) {
  console.log('   ✅ Папка web существует')
  
  const appDir = path.join(webDir, 'app')
  if (fs.existsSync(appDir)) {
    console.log('   ✅ Папка app существует (Next.js App Router)')
  } else {
    console.log('   ❌ Папка app не найдена')
  }
} else {
  console.log('   ❌ Папка web не найдена')
}

console.log('\n' + '='.repeat(50))
console.log('🎯 РЕКОМЕНДАЦИИ:')

if (!fs.existsSync(apiPath)) {
  console.log('❌ КРИТИЧНО: API endpoint не существует')
  console.log('   → Создайте файл:', apiPath)
} else {
  console.log('✅ API endpoint существует')
}

if (!fs.existsSync(pagePath)) {
  console.log('❌ КРИТИЧНО: Fine-tune страница не существует')
} else {
  console.log('✅ Fine-tune страница существует')
}

console.log('\n🚀 Для тестирования:')
console.log('1. cd web && npm run dev')
console.log('2. Откройте http://localhost:3000/agents/1/fine-tune')
console.log('3. Попробуйте загрузить файл')
console.log('4. Проверьте логи в консоли браузера и терминале')

console.log('\n📊 ДИАГНОСТИКА ЗАВЕРШЕНА')