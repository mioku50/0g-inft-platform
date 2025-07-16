require('dotenv').config({ path: '.env.local' });

console.log('=== Environment Test ===');
console.log('Storage Key exists:', !!process.env.OG_STORAGE_PRIVATE_KEY);
console.log('Storage Key length:', process.env.OG_STORAGE_PRIVATE_KEY?.length);
console.log('Compute Key exists:', !!process.env.OG_COMPUTE_PRIVATE_KEY);
console.log('All OG_ variables:', Object.keys(process.env).filter(k => k.startsWith('OG_')));
