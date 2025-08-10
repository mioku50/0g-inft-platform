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