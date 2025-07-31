# 🔧 РУКОВОДСТВО ПО ОТЛАДКЕ UPLOAD DATASET

## 🎯 Цель
Диагностировать и исправить проблему с кнопкой "Upload Dataset" в Fine-tune модуле.

## ✅ Что уже исправлено:
1. ✅ **Добавлено детальное логирование** с флагом `DEBUG_FINE_TUNE`
2. ✅ **Исправлено отображение Ledger баланса** - теперь показывает реальные данные
3. ✅ **Убрана белая вспышка (FOUC)** - фон установлен в globals.css
4. ✅ **Созданы примеры датасетов** для скачивания
5. ✅ **Создан тестовый скрипт** для проверки API

## 🚀 Как включить отладку:

### 1. Включить DEBUG режим
В файле `web/.env.local` уже установлены флаги:
```env
NEXT_PUBLIC_DEBUG_FINE_TUNE=true
NEXT_PUBLIC_DEBUG_UPLOAD=true
DEBUG_FINE_TUNE=true
```

### 2. Перезапустить сервер разработки
```bash
cd web
npm run dev
```

### 3. Открыть DevTools в браузере
- Нажать F12 или Ctrl+Shift+I
- Перейти на вкладку Console
- Перейти на вкладку Network

## 🧪 Тестирование Upload Dataset:

### Вариант 1: Через UI
1. Открыть страницу Fine-tune любого агента
2. Скачать пример датасета: `/example-dataset.jsonl`
3. Выбрать файл в форме
4. Нажать "Upload Dataset"
5. **Наблюдать логи в Console:**
   - `[UPLOAD] 📁 File selected:` - файл выбран
   - `[UPLOAD] 🎯 Upload Dataset button clicked!` - кнопка нажата
   - `[UPLOAD] 🚀 Starting upload process...` - начало загрузки
   - `[UPLOAD] Making API request to /api/storage/upload-dataset` - запрос отправлен
   - `[UPLOAD] API response:` - ответ получен

### Вариант 2: Через тестовый скрипт
```bash
# Установить зависимости (если нужно)
npm install form-data

# Запустить тест
node test-upload-debug.js
```

## 📊 Что искать в логах:

### Фронтенд логи (Console):
```
[UPLOAD] 📁 File selected: {name: "example-dataset.jsonl", size: 1234, ...}
[UPLOAD] 🎯 Upload Dataset button clicked!
[UPLOAD] 🚀 Starting upload process...
[UPLOAD] Making API request to /api/storage/upload-dataset
[UPLOAD] API response: {status: 200, ok: true, ...}
[UPLOAD] Upload successful: {rootHash: "0x...", dataSize: 15, ...}
```

### Серверные логи (Terminal):
```
[UPLOAD-API] 🚀 Starting dataset upload...
[UPLOAD-API] ✅ Environment variables validated
[UPLOAD-API] 📋 Request data: {hasFile: true, fileName: "example-dataset.jsonl", ...}
[UPLOAD-API] ✅ Upload successful: {success: true, rootHash: "0x...", ...}
```

### Account API логи:
```
[ACCOUNT-API] 🏦 Getting account info...
[ACCOUNT-API] ✅ Environment validation passed
[ACCOUNT-API] ✅ Broker initialized
[ACCOUNT-API] 📊 Calling broker.ledger.getLedger()...
[ACCOUNT-API] 📊 Raw ledger response: {...}
[ACCOUNT-API] 📊 Ledger balance (format 1): 0.074999...
[ACCOUNT-API] ✅ Returning account info: {balance: "0.074999...", needsTopUp: false, exists: true}
```

## 🔍 Диагностика проблем:

### Проблема: Кнопка не реагирует на клик
**Признаки:** Нет лога `[UPLOAD] 🎯 Upload Dataset button clicked!`
**Решение:** Проверить:
- Файл выбран?
- Кнопка не disabled?
- Нет JavaScript ошибок в Console?

### Проблема: Клик есть, но запрос не отправляется
**Признаки:** Есть лог клика, но нет `[UPLOAD] Making API request`
**Решение:** Проверить:
- Валидацию файла
- Блокировку по размеру/формату
- Ошибки в функции uploadDataset

### Проблема: Запрос отправляется, но падает с ошибкой
**Признаки:** Есть лог запроса, но статус не 200
**Решение:** Проверить:
- ENV переменные (OG_STORAGE_PRIVATE_KEY)
- Сетевое соединение с 0G Storage
- Логи сервера в Terminal

### Проблема: Баланс показывает 0.00000
**Признаки:** В Account Status всегда 0.00000 OG
**Решение:** Проверить:
- Логи `[ACCOUNT-API]` в Terminal
- ENV переменные (OG_COMPUTE_PRIVATE_KEY)
- Существование Ledger аккаунта

## 🛠️ Быстрые исправления:

### Если Upload не работает:
1. Проверить `.env.local` файл
2. Перезапустить dev сервер
3. Очистить кеш браузера (Ctrl+Shift+R)
4. Попробовать в режиме инкогнито

### Если баланс не отображается:
1. Создать Ledger аккаунт через API или CLI
2. Проверить приватный ключ в ENV
3. Убедиться что сеть Galileo Testnet V3

## 📞 Следующие шаги:

После включения DEBUG режима и тестирования:

1. **Если все работает** - отключить DEBUG флаги в production
2. **Если есть проблемы** - собрать логи и отправить для анализа
3. **Для production** - добавить мониторинг и алерты

## 🎉 Ожидаемый результат:

После исправлений должно работать:
- ✅ Кнопка Upload Dataset отправляет сетевой запрос
- ✅ Файл успешно загружается в 0G Storage
- ✅ Отображается корректный Ledger баланс
- ✅ Нет белой вспышки при загрузке страницы
- ✅ Детальные логи для диагностики

---
**Создано:** 30 июля 2025  
**Статус:** Готово к тестированию