export function isValidRootHash(hash: string): boolean {
  if (!hash) return false
  
  // Проверяем что это не URL
  if (hash.includes('http://') || hash.includes('https://')) {
    return false
  }
  
  // Проверяем формат хэша (должен начинаться с 0x и содержать 64 hex символа)
  const hashRegex = /^0x[a-fA-F0-9]{64}$/
  return hashRegex.test(hash)
}

export function extractHashFromUrl(input: string): string {
  if (!input) return input
  
  // Если это URL, извлекаем последнюю часть
  if (input.includes('http://') || input.includes('https://')) {
    const parts = input.split('/')
    return parts[parts.length - 1]
  }
  
  return input
}

export function sanitizeMetadataHash(hash: string): string {
  // Извлекаем хэш если это URL
  let cleanHash = extractHashFromUrl(hash)
  
  // Проверяем валидность
  if (!isValidRootHash(cleanHash)) {
    console.warn('Invalid metadata hash:', cleanHash)
    return '0x' // Возвращаем пустой валидный хэш
  }
  
  return cleanHash
}