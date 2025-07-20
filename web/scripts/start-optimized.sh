#!/bin/bash

echo "🚀 Starting 0G INFT Platform with optimizations..."

# Очистка кеша
echo "Clearing cache..."
rm -rf .next/cache
rm -rf node_modules/.cache

# Установка переменных окружения
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"

# Сборка проекта
echo "Building project..."
npm run build

# Запуск
echo "Starting server..."
npm start
