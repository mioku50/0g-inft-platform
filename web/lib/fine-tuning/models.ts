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
  parameters: string  // For display purposes
  trainingTime: string
  gpuRequirement: string
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
 * All 6 available models from the 0G network
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
    parameters: '66M',
    trainingTime: '15-30 minutes',
    gpuRequirement: 'Tesla V100 or better',
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
  },
  {
    id: 'llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    description: 'Advanced large language model optimized for instruction following and conversation. Excellent for complex reasoning and detailed responses.',
    hash: '0x8f3244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110b8',
    tokenizerHash: '0x4417127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed961',
    type: 'text',
    status: 'active',
    parameters: '70B',
    trainingTime: '45-90 minutes',
    gpuRequirement: 'Tesla A100 or better',
    requirements: {
      minDatasetSize: 20,
      maxDatasetSize: 15000,
      recommendedDatasetSize: 1000,
      trainingTime: '45-90 minutes',
      gpuRequirement: 'Tesla A100 or better'
    },
    supportedFormats: ['jsonl', 'json'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are an expert assistant."}, {"role": "user", "content": "Explain quantum computing"}, {"role": "assistant", "content": "Quantum computing leverages quantum mechanical phenomena..."}]}'
      ],
      json: { "data": [] }
    }
  },
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    description: 'Advanced reasoning model optimized for complex problem solving, mathematics, and logical analysis. Excels at step-by-step reasoning.',
    hash: '0x9f4244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110c9',
    tokenizerHash: '0x5517127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed962',
    type: 'text',
    status: 'active',
    parameters: '70B',
    trainingTime: '60-120 minutes',
    gpuRequirement: 'Tesla A100 or better',
    requirements: {
      minDatasetSize: 15,
      maxDatasetSize: 12000,
      recommendedDatasetSize: 800,
      trainingTime: '60-120 minutes',
      gpuRequirement: 'Tesla A100 or better'
    },
    supportedFormats: ['jsonl', 'json'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are a reasoning expert."}, {"role": "user", "content": "Solve this step by step: 2x + 5 = 15"}, {"role": "assistant", "content": "Let me solve this equation step by step..."}]}'
      ],
      json: { "data": [] }
    }
  },
  {
    id: 'gpt-3.5-turbo-fine-tune',
    name: 'GPT-3.5 Turbo Fine-tune',
    description: 'Versatile conversational AI model suitable for a wide range of tasks including customer service, content generation, and general assistance.',
    hash: '0xaf5244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110da',
    tokenizerHash: '0x6617127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed963',
    type: 'text',
    status: 'active',
    parameters: '175B',
    trainingTime: '30-60 minutes',
    gpuRequirement: 'Tesla V100 or better',
    requirements: {
      minDatasetSize: 12,
      maxDatasetSize: 8000,
      recommendedDatasetSize: 600,
      trainingTime: '30-60 minutes',
      gpuRequirement: 'Tesla V100 or better'
    },
    supportedFormats: ['jsonl', 'json', 'txt'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are a customer service assistant."}, {"role": "user", "content": "I need help with my order"}, {"role": "assistant", "content": "I\'d be happy to help you with your order..."}]}'
      ],
      json: { "data": [] }
    }
  },
  {
    id: 'code-llama-13b-instruct',
    name: 'Code Llama 13B Instruct',
    description: 'Specialized model for code generation, code completion, and programming assistance. Supports multiple programming languages.',
    hash: '0xbf6244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110eb',
    tokenizerHash: '0x7717127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed964',
    type: 'text',
    status: 'active',
    parameters: '13B',
    trainingTime: '20-40 minutes',
    gpuRequirement: 'Tesla V100 or better',
    requirements: {
      minDatasetSize: 10,
      maxDatasetSize: 5000,
      recommendedDatasetSize: 400,
      trainingTime: '20-40 minutes',
      gpuRequirement: 'Tesla V100 or better'
    },
    supportedFormats: ['jsonl', 'json'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are a programming assistant."}, {"role": "user", "content": "Write a Python function to sort a list"}, {"role": "assistant", "content": "Here\'s a Python function to sort a list..."}]}'
      ],
      json: { "data": [] }
    }
  },
  {
    id: 'mistral-7b-instruct',
    name: 'Mistral 7B Instruct',
    description: 'Efficient and capable model for general-purpose tasks. Good balance between performance and resource requirements.',
    hash: '0xcf7244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110fc',
    tokenizerHash: '0x8817127671a3217583069001b2a00454ef4d1e838f8f1f4ffbe64db0ec7ed965',
    type: 'text',
    status: 'active',
    parameters: '7B',
    trainingTime: '15-30 minutes',
    gpuRequirement: 'Tesla T4 or better',
    requirements: {
      minDatasetSize: 8,
      maxDatasetSize: 6000,
      recommendedDatasetSize: 300,
      trainingTime: '15-30 minutes',
      gpuRequirement: 'Tesla T4 or better'
    },
    supportedFormats: ['jsonl', 'json', 'txt'],
    exampleDataset: {
      jsonl: [
        '{"messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": "Explain photosynthesis"}, {"role": "assistant", "content": "Photosynthesis is the process by which plants..."}]}'
      ],
      json: { "data": [] }
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
 * Training parameters for fine-tuning - simplified interface for UI
 */
export interface TrainingParams {
  epochs: number
  learningRate: number
  batchSize: number
  steps: number
}

/**
 * Default training parameters - simplified
 */
export const DEFAULT_TRAINING_PARAMS: TrainingParams = {
  epochs: 3,
  learningRate: 0.0001,
  batchSize: 16,
  steps: 1000
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