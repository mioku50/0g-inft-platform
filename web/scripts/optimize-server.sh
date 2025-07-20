#!/bin/bash

echo "?? Starting 0G INFT Platform with optimizations..."

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

# Запуск с PM2
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 stop 0g-inft 2>/dev/null || true
    pm2 start npm --name "0g-inft" -- start
    pm2 save
    pm2 logs 0g-inft
else
    echo "Starting directly..."
    npm start
fi