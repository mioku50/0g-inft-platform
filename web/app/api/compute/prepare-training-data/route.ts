// app/api/compute/prepare-training-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client-server'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

interface TrainingExample {
  systemPrompt: string
  userInput: string
  expectedOutput: string
}

/**
 * POST /api/compute/prepare-training-data - Подготовка данных для fine-tuning
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId, trainingData } = body

    if (!agentId || !trainingData || !Array.isArray(trainingData)) {
      return NextResponse.json(
        { error: 'Missing agentId or trainingData array' },
        { status: 400 }
      )
    }

    if (trainingData.length < 3) {
      return NextResponse.json(
        { error: 'Minimum 3 training examples required' },
        { status: 400 }
      )
    }

    console.log(`Preparing training data for agent ${agentId}:`, {
      exampleCount: trainingData.length
    })

    // Преобразование в формат, совместимый с Hugging Face datasets
    const formattedData = trainingData.map((example: TrainingExample, index: number) => ({
      text: `${example.systemPrompt}\n\nUser: ${example.userInput}\nAssistant: ${example.expectedOutput}`,
      label: 0, // Для classification tasks
      id: index
    }))

    // Разделение на train/validation (80/20)
    const shuffled = formattedData.sort(() => 0.5 - Math.random())
    const splitIndex = Math.floor(shuffled.length * 0.8)
    const trainData = shuffled.slice(0, splitIndex)
    const validationData = shuffled.slice(splitIndex)

    // Создание структуры данных для datasets library
    const datasetStructure = {
      train: trainData,
      validation: validationData.length > 0 ? validationData : trainData.slice(0, 1), // Минимум 1 пример для валидации
      metadata: {
        agentId,
        createdAt: new Date().toISOString(),
        totalExamples: trainingData.length,
        trainExamples: trainData.length,
        validationExamples: validationData.length || 1,
        format: 'huggingface_datasets',
        task: 'text_generation'
      }
    }

    // Сохранение во временный файл
    const tempDir = path.join(process.cwd(), 'tmp')
    await fs.mkdir(tempDir, { recursive: true })
    
    const fileName = `training_data_${agentId}_${Date.now()}.json`
    const filePath = path.join(tempDir, fileName)
    
    await fs.writeFile(filePath, JSON.stringify(datasetStructure, null, 2), 'utf-8')

    // Загрузка в 0G Storage
    const fileBuffer = await fs.readFile(filePath)
    const uploadResult = await uploadToStorage(fileBuffer, fileName)

    // Очистка временного файла
    await fs.unlink(filePath).catch(() => {})

    console.log('Training data uploaded:', {
      rootHash: uploadResult.rootHash,
      size: uploadResult.size,
      recordCount: trainingData.length
    })

    return NextResponse.json({
      success: true,
      rootHash: uploadResult.rootHash,
      fileName,
      recordCount: trainingData.length,
      trainRecords: trainData.length,
      validationRecords: validationData.length || 1,
      size: uploadResult.size,
      segments: uploadResult.segments
    })

  } catch (error: any) {
    console.error('Error preparing training data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to prepare training data',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}