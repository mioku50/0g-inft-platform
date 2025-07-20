// web/lib/utils/metadata-sanitizer.ts

export function sanitizeSystemPrompt(prompt: string | undefined): string {
  if (!prompt) return ''
  
  // Если промпт содержит JSON, пытаемся извлечь полезную информацию
  if (prompt.includes('{') && prompt.includes('}')) {
    try {
      // Извлекаем текст до JSON
      const beforeJson = prompt.split('{')[0].trim()
      
      // Пытаемся распарсить JSON часть
      const jsonMatch = prompt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[0])
          
          // Извлекаем полезные данные из JSON
          let extractedInfo = beforeJson
          
          if (jsonData.instructions && typeof jsonData.instructions === 'string') {
            extractedInfo += '\n\n' + jsonData.instructions
          }
          
          if (jsonData.traits && Array.isArray(jsonData.traits)) {
            extractedInfo += '\n\nKey traits: ' + jsonData.traits.join(', ')
          }
          
          return extractedInfo.trim()
        } catch {
          // Если JSON невалидный, просто возвращаем текст до JSON
          return beforeJson
        }
      }
      
      return beforeJson
    } catch {
      // Если не удалось обработать, удаляем JSON символы
      return prompt
        .replace(/[{}\[\]]/g, '')
        .replace(/["']/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }
  
  // Если нет JSON, возвращаем как есть
  return prompt.trim()
}

export function sanitizeMetadata(metadata: any): any {
  if (!metadata) return null
  
  return {
    ...metadata,
    systemPrompt: sanitizeSystemPrompt(metadata.systemPrompt),
    // Убеждаемся что другие поля тоже чистые
    name: metadata.name?.toString().trim() || 'Unknown Agent',
    description: metadata.description?.toString().trim() || 'AI Assistant',
    model: metadata.model || 'llama-3.3-70b',
    personality: metadata.personality || 'friendly'
  }
}
