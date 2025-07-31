// lib/fine-tuning/models.ts
/**
 * Official 0G Fine-tuning models from the SDK documentation
 * Based on web/lib/0g-serving-user-broker/src.ts/sdk/fine-tuning/const.ts
 */

export interface FineTuningModel {
  id: string
  name: string
  description: string
  hash: string
  tokenizerHash: string
  type: 'text' | 'image'
  status: 'active' | 'deprecated'
  requirements: {
    minDatasetSize: number
    maxDatasetSize: number
    recommendedDatasetSize: number
    trainingTime: string
    gpuRequirement: string
  }
  supportedFormats: string[]
  exampleDataset: any
}

/**
 * Official Fine-tuning models supported by 0G Compute Network
 * Currently only distilbert-base-uncased is active
 */
export const FINE_TUNING_MODELS: FineTuningModel[] = [
  {
    id: 'distilbert-base-uncased',
    name: 'DistilBERT Base Uncased',
    description: 'DistilBERT is a transformers model, smaller and faster than BERT, which was pretrained on the same corpus in a self-supervised fashion, using the BERT base model as a teacher.',
    hash: '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
    tokenizerHash: '0x3317127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed960',
    type: 'text',
    status: 'active',
    requirements: {
      minDatasetSize: 10,
      maxDatasetSize: 10000,
      recommendedDatasetSize: 500,
      trainingTime: '15-30 minutes',
      gpuRequirement: 'Tesla V100 or better'
    },
    supportedFormats: ['jsonl', 'json', 'txt'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "What is machine learning?"}, {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence..."}]}',
        '{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Explain neural networks"}, {"role": "assistant", "content": "Neural networks are computing systems inspired by biological neural networks..."}]}'
      ],
      json: {
        "data": [
          {
            "messages": [
              {"role": "system", "content": "You are a helpful assistant."},
              {"role": "user", "content": "What is machine learning?"},
              {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence..."}
            ]
          }
        ]
      },
      txt: `System: You are a helpful assistant.
User: What is machine learning?
Assistant: Machine learning is a subset of artificial intelligence...

System: You are a helpful assistant.
User: Explain neural networks
Assistant: Neural networks are computing systems inspired by biological neural networks...`
    }
  }
]

/**
 * Official 0G Fine-tuning providers
 */
export const FINE_TUNING_PROVIDERS = [
  {
    address: '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f',
    name: 'Official 0G Provider #1',
    status: 'active',
    pricePerByte: '0.000000000000000001', // A0GI
    availability: true
  },
  {
    address: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    name: 'Official 0G Provider #2', 
    status: 'active',
    pricePerByte: '0.000000000000000001', // A0GI
    availability: true
  },
  {
    address: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
    name: 'Official 0G Provider #3',
    status: 'active', 
    pricePerByte: '0.000000000000000001', // A0GI
    availability: true
  }
]

/**
 * Task status mapping from 0G CLI documentation
 */
export const TASK_STATUS = {
  Init: 'Setting up',
  SettingUp: 'Setting up', 
  SetUp: 'Ready to train',
  Training: 'Training',
  Trained: 'Training completed',
  Delivering: 'Uploading results',
  Delivered: 'Results delivered',
  UserAcknowledged: 'User confirmed',
  Finished: 'Task completed',
  Failed: 'Task failed'
} as const

export type TaskStatus = keyof typeof TASK_STATUS

/**
 * Dataset format validation
 */
export interface DatasetValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalExamples: number
    averageLength: number
    format: string
  }
}

/**
 * Training parameters for fine-tuning
 */
export interface TrainingParams {
  num_train_epochs: number
  per_device_train_batch_size: number
  per_device_eval_batch_size: number
  warmup_steps: number
  weight_decay: number
  logging_dir: string
  logging_steps: number
  evaluation_strategy: string
  save_strategy: string
  save_steps: number
  save_total_limit: number
  eval_steps: number
  load_best_model_at_end: boolean
  metric_for_best_model: string
  greater_is_better: boolean
  report_to: string[]
}

/**
 * Default training parameters
 */
export const DEFAULT_TRAINING_PARAMS: TrainingParams = {
  num_train_epochs: 3,
  per_device_train_batch_size: 16,
  per_device_eval_batch_size: 16,
  warmup_steps: 500,
  weight_decay: 0.01,
  logging_dir: "./logs",
  logging_steps: 100,
  evaluation_strategy: "no",
  save_strategy: "epoch",
  save_steps: 1,
  save_total_limit: 1,
  eval_steps: 50,
  load_best_model_at_end: false,
  metric_for_best_model: "accuracy",
  greater_is_better: true,
  report_to: ["none"]
}

export function getModelById(modelId: string): FineTuningModel | undefined {
  return FINE_TUNING_MODELS.find(model => model.id === modelId)
}

export function getActiveModels(): FineTuningModel[] {
  return FINE_TUNING_MODELS.filter(model => model.status === 'active')
}

export function getAvailableProviders() {
  return FINE_TUNING_PROVIDERS.filter(provider => provider.availability)
}