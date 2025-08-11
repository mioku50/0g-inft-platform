const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const allowed = 'lib/compute/clientBroker.ts';
const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n');

const exts = /(\.(ts|tsx|js|jsx|cjs|mjs)$)/;
const errors = [];

for (const file of files) {
  if (!exts.test(file)) continue;
  if (file.startsWith('lib/0g-')) continue;
  if (file.startsWith('scripts/')) continue;
  if (file === 'check-broker-methods.js') continue;
  if (file === 'next.config.js') continue;
  if (file === allowed) continue;

  const content = readFileSync(path.join(root, file), 'utf8');
  if (content.includes('@0glabs/0g-serving-broker/')) {
    errors.push(`${file}: disallowed subpath import`);
    continue;
  }
  if (content.includes('@0glabs/0g-serving-broker')) {
    errors.push(`${file}: direct SDK import`);
  }
}

if (errors.length) {
  console.error('Forbidden SDK imports found:\n' + errors.join('\n'));
  process.exit(1);
}

console.log('No forbidden SDK imports found.');
