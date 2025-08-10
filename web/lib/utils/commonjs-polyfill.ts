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
    (window as any).module = { 
      exports: {},
      id: 'browser-polyfill',
      loaded: true,
      parent: null,
      children: [],
      paths: []
    }
  }
  
  // Add require mock - try to be smarter about what's being required
  if (typeof require === 'undefined') {
    (window as any).require = function(id: string) {
      // Handle some common require patterns
      if (id === 'crypto') {
        return window.crypto
      }
      if (id === 'buffer') {
        return { Buffer: (window as any).Buffer }
      }
      if (id === 'events') {
        return { EventEmitter: class EventEmitter {} }
      }
      if (id === 'util') {
        return {}
      }
      
      console.warn(`[CommonJS Polyfill] Attempted require("${id}") - returning empty object`)
      return {}
    }
    
    // Add require.resolve mock
    ;(window as any).require.resolve = function(id: string) {
      return id
    }
  }
}

export {}