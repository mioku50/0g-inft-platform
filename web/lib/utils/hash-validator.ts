export function isValidRootHash(hash: string): boolean {
  if (!hash) return false
  
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

export function normalizeHash(input: string): string {
  if (!input) return ''
  let h = input.trim()

  for (const pref of ['local://', 'file://']) {
    if (h.startsWith(pref)) h = h.slice(pref.length)
  }

  // Если это turbo-URL — взять хвост после последнего слэша
  if (h.startsWith('http')) {
    try {
      const u = new URL(h)
      const last = u.pathname.split('/').filter(Boolean).pop()
      if (last) h = last
    } catch {/* ignore */}
  }

  // базовая валидация 0x + 64 hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(h)) return ''
  return h.toLowerCase()
}

export function sanitizeMetadataHash(hash: string): string {
  // Use the new normalizeHash function for consistency
  const cleanHash = normalizeHash(hash)
  
  if (!cleanHash) {
    console.warn('Invalid metadata hash:', hash)
    return '0x' // Возвращаем пустой валидный хэш
  }
  
  return cleanHash
}