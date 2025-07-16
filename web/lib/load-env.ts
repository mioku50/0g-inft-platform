// lib/load-env.ts
// Простая загрузка переменных без dotenv для избежания ошибок TTY

export function loadEnv() {
  // В Next.js переменные из .env уже должны быть загружены
  // Проверяем их наличие
  const required = ['OG_STORAGE_PRIVATE_KEY', 'OG_COMPUTE_PRIVATE_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing)
    console.error('Available OG_ variables:', Object.keys(process.env).filter(k => k.startsWith('OG_')))
  } else {
    console.log('Environment variables loaded successfully')
  }
  
  return {
    loaded: missing.length === 0,
    missing
  }
}

// Загружаем при импорте только на сервере
if (typeof window === 'undefined') {
  loadEnv()
}