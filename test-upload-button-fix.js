#!/usr/bin/env node

/**
 * 🧪 ТЕСТ: Проверка исправлений кнопки Upload Dataset
 * 
 * Проверяет:
 * 1. Добавлены ли отладочные логи
 * 2. Правильность data-атрибутов
 * 3. Обработчик файлов
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 ТЕСТ: Проверка исправлений Upload Dataset Button')
console.log('=' .repeat(60))

const pagePath = path.join(__dirname, 'web/app/agents/[id]/fine-tune/page.tsx')

if (!fs.existsSync(pagePath)) {
  console.log('❌ ОШИБКА: Файл не найден:', pagePath)
  process.exit(1)
}

const pageContent = fs.readFileSync(pagePath, 'utf8')

console.log('\n1. 🔍 Проверка отладочных логов...')

const debugChecks = [
  {
    name: 'UPLOAD DEBUG логи',
    pattern: /\[UPLOAD DEBUG\]/g,
    expected: 'минимум 5 вхождений'
  },
  {
    name: 'FILE DEBUG логи',
    pattern: /\[FILE DEBUG\]/g,
    expected: 'минимум 5 вхождений'
  },
  {
    name: 'Alert для отладки',
    pattern: /alert\(/g,
    expected: 'минимум 3 вхождения'
  },
  {
    name: 'Детальное логирование события',
    pattern: /console\.log\('\[UPLOAD DEBUG\] Event object:'/,
    expected: '1 вхождение'
  },
  {
    name: 'Логирование состояния файла',
    pattern: /console\.log\('\[UPLOAD DEBUG\] datasetFile:'/,
    expected: '1 вхождение'
  }
]

let allChecksPass = true

debugChecks.forEach(check => {
  const matches = pageContent.match(check.pattern)
  const count = matches ? matches.length : 0
  
  if (count > 0) {
    console.log(`   ✅ ${check.name}: найдено ${count} вхождений`)
  } else {
    console.log(`   ❌ ${check.name}: НЕ НАЙДЕНО (ожидалось: ${check.expected})`)
    allChecksPass = false
  }
})

console.log('\n2. 🏷️ Проверка data-атрибутов...')

const dataAttributes = [
  'data-testid="upload-dataset-button"',
  'data-debug-disabled',
  'data-debug-dataset-file',
  'data-debug-is-uploading'
]

dataAttributes.forEach(attr => {
  if (pageContent.includes(attr)) {
    console.log(`   ✅ ${attr}: найден`)
  } else {
    console.log(`   ❌ ${attr}: НЕ НАЙДЕН`)
    allChecksPass = false
  }
})

console.log('\n3. 📁 Проверка обработчика файлов...')

const fileHandlerChecks = [
  'console.log(\'[FILE DEBUG] 📁 FILE INPUT CHANGED\')',
  'console.log(\'[FILE DEBUG] Files:\', e.target.files)',
  'console.log(\'[FILE DEBUG] About to call setDatasetFile...\')'
]

fileHandlerChecks.forEach(check => {
  if (pageContent.includes(check)) {
    console.log(`   ✅ Найден: ${check.substring(0, 50)}...`)
  } else {
    console.log(`   ❌ НЕ НАЙДЕН: ${check.substring(0, 50)}...`)
    allChecksPass = false
  }
})

console.log('\n4. 🔧 Проверка структуры кнопки...')

const buttonStructureChecks = [
  {
    name: 'onClick handler с async',
    pattern: /onClick=\{async \(e\) => \{/
  },
  {
    name: 'disabled условие',
    pattern: /disabled=\{!datasetFile \|\| isUploading\}/
  },
  {
    name: 'Вызов uploadDataset()',
    pattern: /await uploadDataset\(\)/
  },
  {
    name: 'Обработка ошибок',
    pattern: /} catch \(error\) \{/
  }
]

buttonStructureChecks.forEach(check => {
  if (check.pattern.test(pageContent)) {
    console.log(`   ✅ ${check.name}: найден`)
  } else {
    console.log(`   ❌ ${check.name}: НЕ НАЙДЕН`)
    allChecksPass = false
  }
})

console.log('\n' + '='.repeat(60))

if (allChecksPass) {
  console.log('🎉 ВСЕ ПРОВЕРКИ ПРОШЛИ УСПЕШНО!')
  console.log('\n📋 Что было добавлено:')
  console.log('✅ Детальные отладочные логи в onClick handler')
  console.log('✅ Alert сообщения для гарантированной видимости')
  console.log('✅ Отладочные логи в file input onChange')
  console.log('✅ Data-атрибуты для инспекции в браузере')
  console.log('✅ Логирование состояния datasetFile')
  
  console.log('\n🚀 Следующие шаги:')
  console.log('1. Перезапустите сервер разработки')
  console.log('2. Откройте страницу Fine-tune в браузере')
  console.log('3. Попробуйте выбрать файл и нажать Upload Dataset')
  console.log('4. Проверьте консоль браузера на наличие логов')
  console.log('5. Обратите внимание на alert сообщения')
  
} else {
  console.log('❌ НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОШЛИ')
  console.log('Проверьте файл и убедитесь, что все изменения применены корректно')
}

console.log('\n📊 ТЕСТ ЗАВЕРШЕН')