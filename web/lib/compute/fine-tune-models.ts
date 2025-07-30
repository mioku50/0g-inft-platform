// lib/compute/fine-tune-models.ts

export interface FineTuneModel {
  id: string
  name: string
  type: 'text-classification' | 'language-generation' | 'reasoning' | 'image-classification'
  description: string
  provider: 'predefined' | 'provider-specific'
  hash?: string
  huggingFaceUrl?: string
  githubUrl?: string
  isRecommended?: boolean
  requirements?: {
    minDatasetSize?: number
    maxDatasetSize?: number
    supportedFormats?: string[]
    estimatedTrainingTime?: string
  }
}

/**
 * Официальные предопределенные модели из документации 0G
 */
export const PREDEFINED_MODELS: FineTuneModel[] = [
  {
    id: 'distilbert-base-uncased',
    name: 'DistilBERT Base Uncased',
    type: 'text-classification',
    description: 'DistilBERT is a transformers model, smaller and faster than BERT, which was pretrained on the same corpus in a self-supervised fashion, using the BERT base model as a teacher.',
    provider: 'predefined',
    hash: '0x1234567890abcdef1234567890abcdef12345678',
    huggingFaceUrl: 'https://huggingface.co/distilbert-base-uncased',
    requirements: {
      minDatasetSize: 100,
      maxDatasetSize: 10000,
      supportedFormats: ['JSONL'],
      estimatedTrainingTime: '30-60 minutes'
    }
  },
  {
    id: 'cocktailsgd-opt-1.3b',
    name: 'CocktailSGD-OPT-1.3B',
    type: 'language-generation',
    description: 'CocktailSGD-opt-1.3B finetunes the Opt-1.3B language model with CocktailSGD, a novel distributed finetuning framework.',
    provider: 'predefined',
    hash: '0x2345678901bcdef12345678901bcdef123456789',
    githubUrl: 'https://github.com/cocktailsgd/cocktailsgd-opt-1.3b',
    requirements: {
      minDatasetSize: 500,
      maxDatasetSize: 50000,
      supportedFormats: ['JSONL'],
      estimatedTrainingTime: '1-3 hours'
    }
  }
]

/**
 * Модели от конкретных провайдеров
 */
export const PROVIDER_SPECIFIC_MODELS: FineTuneModel[] = [
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    type: 'language-generation',
    description: 'Large language model optimized for conversational AI, reasoning, and complex text generation tasks.',
    provider: 'provider-specific',
    hash: '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
    isRecommended: true,
    requirements: {
      minDatasetSize: 1000,
      maxDatasetSize: 100000,
      supportedFormats: ['JSONL'],
      estimatedTrainingTime: '2-6 hours'
    }
  },
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    type: 'reasoning',
    description: 'Advanced reasoning model optimized for complex analytical tasks, mathematical problem solving, and logical reasoning.',
    provider: 'provider-specific',
    hash: '0x2084fdd904c9a3317dde98147d4e7778a41ac8b5d3c5e4b8f9a2c1d3e4f5g6h7i',
    requirements: {
      minDatasetSize: 500,
      maxDatasetSize: 50000,
      supportedFormats: ['JSONL'],
      estimatedTrainingTime: '1-4 hours'
    }
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b',
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    type: 'reasoning',
    description: 'DeepSeek-R1-Zero, a model trained via large-scale reinforcement learning (RL) without supervised fine-tuning (SFT) as a preliminary step, demonstrated remarkable performance on reasoning tasks.',
    provider: 'provider-specific',
    hash: '0x3456789012cdef123456789012cdef1234567890',
    requirements: {
      minDatasetSize: 200,
      maxDatasetSize: 20000,
      supportedFormats: ['JSONL'],
      estimatedTrainingTime: '30-90 minutes'
    }
  },
  {
    id: 'mobilenet_v2',
    name: 'MobileNet V2',
    type: 'image-classification',
    description: 'MobileNet V2 model pre-trained on ImageNet-1k at resolution 224x224, optimized for mobile and edge devices.',
    provider: 'provider-specific',
    hash: '0x4567890123def1234567890123def12345678901',
    requirements: {
      minDatasetSize: 100,
      maxDatasetSize: 10000,
      supportedFormats: ['ZIP', 'TAR'],
      estimatedTrainingTime: '1-2 hours'
    }
  }
]

/**
 * Все доступные модели
 */
export const ALL_MODELS: FineTuneModel[] = [
  ...PREDEFINED_MODELS,
  ...PROVIDER_SPECIFIC_MODELS
]

/**
 * Маппинг ID модели на хеш для совместимости с существующим кодом
 */
export const MODEL_MAPPING: Record<string, string> = {
  'llama-3.3-70b': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
  'deepseek-r1-70b': '0x2084fdd904c9a3317dde98147d4e7778a41ac8b5d3c5e4b8f9a2c1d3e4f5g6h7i',
  'distilbert-base-uncased': '0x1234567890abcdef1234567890abcdef12345678',
  'cocktailsgd-opt-1.3b': '0x2345678901bcdef12345678901bcdef123456789',
  'deepseek-r1-distill-qwen-1.5b': '0x3456789012cdef123456789012cdef1234567890',
  'mobilenet_v2': '0x4567890123def1234567890123def12345678901'
}

/**
 * Получение модели по ID
 */
export function getModelById(id: string): FineTuneModel | undefined {
  return ALL_MODELS.find(model => model.id === id)
}

/**
 * Получение хеша модели по ID
 */
export function getModelHash(id: string): string | undefined {
  return MODEL_MAPPING[id]
}

/**
 * Получение моделей по типу
 */
export function getModelsByType(type: FineTuneModel['type']): FineTuneModel[] {
  return ALL_MODELS.filter(model => model.type === type)
}

/**
 * Получение рекомендуемых моделей
 */
export function getRecommendedModels(): FineTuneModel[] {
  return ALL_MODELS.filter(model => model.isRecommended)
}

/**
 * Валидация требований к датасету для модели
 */
export function validateDatasetForModel(
  modelId: string,
  datasetSize: number,
  format: string
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const model = getModelById(modelId)
  const errors: string[] = []
  const warnings: string[] = []

  if (!model) {
    errors.push(`Model ${modelId} not found`)
    return { isValid: false, errors, warnings }
  }

  const requirements = model.requirements
  if (!requirements) {
    // Нет специальных требований
    return { isValid: true, errors, warnings }
  }

  // Проверка размера датасета
  if (requirements.minDatasetSize && datasetSize < requirements.minDatasetSize) {
    errors.push(`Dataset too small. Minimum size: ${requirements.minDatasetSize}, got: ${datasetSize}`)
  }

  if (requirements.maxDatasetSize && datasetSize > requirements.maxDatasetSize) {
    warnings.push(`Large dataset detected. Maximum recommended size: ${requirements.maxDatasetSize}, got: ${datasetSize}. Training may take longer.`)
  }

  // Проверка формата
  if (requirements.supportedFormats && !requirements.supportedFormats.includes(format.toUpperCase())) {
    errors.push(`Unsupported format: ${format}. Supported formats: ${requirements.supportedFormats.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Получение информации о времени обучения
 */
export function getEstimatedTrainingTime(modelId: string): string {
  const model = getModelById(modelId)
  return model?.requirements?.estimatedTrainingTime || 'Unknown'
}

/**
 * Категоризация моделей для UI
 */
export const MODEL_CATEGORIES = {
  recommended: {
    title: 'Recommended',
    description: 'Best models for most use cases',
    models: getRecommendedModels()
  },
  'text-classification': {
    title: 'Text Classification',
    description: 'Models for categorizing and analyzing text',
    models: getModelsByType('text-classification')
  },
  'language-generation': {
    title: 'Language Generation',
    description: 'Models for generating and continuing text',
    models: getModelsByType('language-generation')
  },
  'reasoning': {
    title: 'Reasoning',
    description: 'Models specialized in logical reasoning and problem solving',
    models: getModelsByType('reasoning')
  },
  'image-classification': {
    title: 'Image Classification',
    description: 'Models for analyzing and categorizing images',
    models: getModelsByType('image-classification')
  }
} as const