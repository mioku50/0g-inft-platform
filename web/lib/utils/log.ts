export const DBG = (...args: any[]) => {
  if (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export const SLOG = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.log(...args)
}

// Tagged logging functions for debug mode
export const isDebugMode = () => {
  return typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_DEBUG === '1'
}

export const BROKER_LOG = (...args: any[]) => {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[BROKER]', ...args)
  }
}

export const LEDGER_LOG = (...args: any[]) => {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[LEDGER]', ...args)
  }
}

export const CHAT_LOG = (...args: any[]) => {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[CHAT]', ...args)
  }
}

export const PROXY_LOG = (...args: any[]) => {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[PROXY]', ...args)
  }
}