// web/lib/compute/utils.ts
import { downloadFromStorage } from '@/lib/storage/client-server'

export async function calculateTokenSize(
  datasetRootHash: string, 
  model: string
): Promise<number> {
  try {
    // Загружаем датасет из 0G Storage
    const dataset = await downloadFromStorage(datasetRootHash)
    
    // Преобразуем в строку для подсчета
    let text = ''
    if (typeof dataset === 'string') {
      text = dataset
    } else if (dataset instanceof Blob) {
      text = await dataset.text()
    } else {
      text = JSON.stringify(dataset)
    }
    
    // Приблизительный подсчет токенов
    // Для более точного подсчета нужно использовать токенайзер модели
    const approximateTokens = Math.ceil(text.length / 4) // ~4 символа на токен
    
    console.log(`Dataset size: ${text.length} chars, ~${approximateTokens} tokens`)
    
    return approximateTokens
  } catch (error) {
    console.error('Error calculating token size:', error)
    // Возвращаем минимальный размер для тестирования
    return 1000
  }
}

// Функция для сохранения связи агент-задача
export async function saveTaskMapping(agentId: string, taskId: string) {
  // Сохраняем в localStorage или в базу данных
  if (typeof window !== 'undefined') {
    const mappings = JSON.parse(localStorage.getItem('agent_tasks') || '{}')
    if (!mappings[agentId]) {
      mappings[agentId] = []
    }
    mappings[agentId].push({
      taskId,
      createdAt: new Date().toISOString(),
      status: 'Init'
    })
    localStorage.setItem('agent_tasks', JSON.stringify(mappings))
  }
}

// Функция для получения задач агента
export function getAgentTasks(agentId: string) {
  if (typeof window !== 'undefined') {
    const mappings = JSON.parse(localStorage.getItem('agent_tasks') || '{}')
    return mappings[agentId] || []
  }
  return []
}