// lib/constants.ts

// Существующие константы (оставляем как есть)
export const NATIVE_SYMBOL = 'OG'
export const CHAIN_ID = 16601

// Новые константы для Fine-tuning
export const FINE_TUNING_CONSTANTS = {
  // Официальный провайдер Fine-tuning 0G
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  
  // Контракт Fine-tuning Serving
  CONTRACT_ADDRESS: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  
  // Минимальные балансы
  MIN_BALANCE: '0.001', // OG
  RECOMMENDED_BALANCE: '0.01', // OG
  
  // Модели и их хеши
  MODELS: {
    'llama-3.3-70b': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
    'deepseek-r1-70b': '0x2084fdd904c9a3317dde98147d4e7778a40e076b5b0eb469f7a8f27ae5b13e7f'
  },
  
  // Статусы задач
  TASK_STATUS: {
    INIT: 'Init',
    SETTING_UP: 'SettingUp',
    TRAINING: 'Training',
    TRAINED: 'Trained',
    DELIVERING: 'Delivering',
    DELIVERED: 'Delivered',
    FINISHED: 'Finished',
    FAILED: 'Failed'
  },
  
  // Параметры по умолчанию
  DEFAULT_PARAMS: {
    STEPS: 500,
    LEARNING_RATE: 0.00005,
    BATCH_SIZE: 4,
    EPOCHS: 5
  },
  
  // Время ожидания
  TIMEOUTS: {
    POLL_INTERVAL: 10000, // 10 секунд
    MAX_TRAINING_TIME: 7200000, // 2 часа
    TASK_TIMEOUT: 3600000 // 1 час
  }
} as const

// Экспорт отдельных констант для удобства
export const FINE_TUNE_PROVIDER = FINE_TUNING_CONSTANTS.PROVIDER_ADDRESS
export const FINE_TUNING_CONTRACT = FINE_TUNING_CONSTANTS.CONTRACT_ADDRESS
export const MODEL_HASHES = FINE_TUNING_CONSTANTS.MODELS
export const TASK_STATUSES = FINE_TUNING_CONSTANTS.TASK_STATUS

// 0G Network endpoints
export const ENDPOINTS = {
  RPC: 'https://evmrpc-testnet.0g.ai',
  STORAGE: 'https://indexer-storage-testnet-turbo.0g.ai',
  SERVING: 'https://serving-testnet.0g.ai'
} as const

// Contract addresses (из вашего .env)
export const CONTRACTS = {
  INFT: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS || '0x500AF12C3Fd7aF1665DC85Eff9844054709dF380',
  MARKETPLACE: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS || '0x0386aECf929D5e1157649584869fa6DDdcAB8B00',
  AI_EXECUTOR: process.env.NEXT_PUBLIC_AI_EXECUTOR_ADDRESS || '0x8A7607043ee30bEF94Cc566586230366432de875',
  FINE_TUNING: process.env.NEXT_PUBLIC_FINE_TUNING_CONTRACT_ADDRESS || FINE_TUNING_CONSTANTS.CONTRACT_ADDRESS
} as const