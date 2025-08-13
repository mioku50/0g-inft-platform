// ethers-compat.ts
// Compatibility layer for places that might need old ethers.utils patterns
// Use this module only when absolutely necessary for backward compatibility
// Import from here instead of using global alias

import * as ethers from 'ethers';

// Re-export everything from ethers
export * from 'ethers';

// Provide utils for legacy compatibility if needed
export const utils = { ...ethers };

// Make sure BrowserProvider is available
export { BrowserProvider } from 'ethers';