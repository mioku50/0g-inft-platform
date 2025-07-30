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
    huggingFaceUrl: 'https://huggingface.co/distilbert/distilbert-base-uncased',
    isRecommended: true
  },
  {
    id: 'cocktailsgd-opt-1.3b',
    name: 'CocktailSGD-OPT-1.3B',
    type: 'language-generation',
    description: 'CocktailSGD-opt-1.3B finetunes the Opt-1.3B language model with CocktailSGD, a novel distributed finetuning framework.',
    provider: 'predefined',
    githubUrl: 'https://github.com/cocktailsgd/CocktailSGD'
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
    description: 'State-of-the-art 70B parameter model for general AI tasks with excellent reasoning capabilities.',
    provider: 'provider-specific',
    hash: '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
    isRecommended: true
  },
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    type: 'reasoning',
    description: 'Advanced reasoning model optimized for complex problem solving and analytical tasks.',
    provider: 'provider-specific',
    hash: '0x2084fdd904c9a3317dde98147d4e7778a40e076b5b0eb469f7a8f27ae5b13e7f'
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b',
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    type: 'reasoning',
    description: 'DeepSeek-R1-Zero, a model trained via large-scale reinforcement learning (RL) without supervised fine-tuning (SFT) as a preliminary step, demonstrated remarkable performance on reasoning tasks.',
    provider: 'provider-specific'
  },
  {
    id: 'mobilenet_v2',
    name: 'MobileNet V2',
    type: 'image-classification',
    description: 'MobileNet V2 model pre-trained on ImageNet-1k at resolution 224x224, optimized for mobile and edge devices.',
    provider: 'provider-specific'
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
 * Маппинг моделей на их хеши (для совместимости)
 */
export const MODEL_HASH_MAPPING: Record<string, string> = {
  'llama-3.3-70b': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
  'deepseek-r1-70b': '0x2084fdd904c9a3317dde98147d4e7778a40e076b5b0eb469f7a8f27ae5b13e7f'
}

/**
 * Получает модель по ID
 */
export function getModelById(id: string): FineTuneModel | undefined {
  return ALL_MODELS.find(model => model.id === id)
}

/**
 * Получает модели по типу
 */
export function getModelsByType(type: FineTuneModel['type']): FineTuneModel[] {
  return ALL_MODELS.filter(model => model.type === type)
}

/**
 * Получает рекомендуемые модели
 */
export function getRecommendedModels(): FineTuneModel[] {
  return ALL_MODELS.filter(model => model.isRecommended)
}

/**
 * Получает хеш модели (если есть)
 */
export function getModelHash(modelId: string): string | undefined {
  const model = getModelById(modelId)
  return model?.hash || MODEL_HASH_MAPPING[modelId]
}

/**
 * Проверяет, поддерживается ли модель для fine-tuning
 */
export function isModelSupported(modelId: string): boolean {
  return ALL_MODELS.some(model => model.id === modelId)
}

/**
 * Получает модели, доступные для текущего провайдера
 */
export function getModelsForProvider(providerAddress: string): FineTuneModel[] {
  // В будущем можно добавить логику для определения доступных моделей по провайдеру
  // Пока возвращаем все модели с хешами (provider-specific)
  return PROVIDER_SPECIFIC_MODELS.filter(model => model.hash)
}

/**
 * Форматирует информацию о модели для UI
 */
export function formatModelForUI(model: FineTuneModel) {
  return {
    value: model.id,
    label: model.name,
    description: model.description,
    type: model.type,
    provider: model.provider,
    isRecommended: model.isRecommended,
    badge: model.isRecommended ? 'Recommended' : model.provider === 'predefined' ? 'Official' : 'Provider'
  }
}

/**
 * Получает конфигурацию по умолчанию для типа модели
 */
export function getDefaultConfigForModel(model: FineTuneModel) {
  switch (model.type) {
    case 'text-classification':
      return {
        steps: 100,
        learningRate: 0.00002,
        batchSize: 16,
        description: 'Optimized for text classification tasks'
      }
    case 'language-generation':
      return {
        steps: 500,
        learningRate: 0.00005,
        batchSize: 4,
        description: 'Optimized for text generation and conversation'
      }
    case 'reasoning':
      return {
        steps: 300,
        learningRate: 0.00003,
        batchSize: 8,
        description: 'Optimized for reasoning and problem-solving'
      }
    case 'image-classification':
      return {
        steps: 200,
        learningRate: 0.0001,
        batchSize: 32,
        description: 'Optimized for image classification tasks'
      }
    default:
      return {
        steps: 500,
        learningRate: 0.00005,
        batchSize: 4,
        description: 'General purpose configuration'
      }
  }
}