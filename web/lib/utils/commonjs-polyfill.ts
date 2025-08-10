// CommonJS polyfill for browser environment
// This fixes issues with packages that expect CommonJS globals

if (typeof window !== 'undefined') {
  // Only run in browser
  if (typeof global === 'undefined') {
    (window as any).global = window
  }
  
  if (typeof exports === 'undefined') {
    (window as any).exports = {}
  }
  
  if (typeof module === 'undefined') {
    (window as any).module = { exports: {} }
  }
  
  // Add require mock for simple cases
  if (typeof require === 'undefined') {
    (window as any).require = function(id: string) {
      throw new Error(`require() is not supported in browser: ${id}`)
    }
  }
}

export {}