// Test if module exports work
console.log('Testing imports...');

try {
  const viem = require('./src/integration/viem/index.ts');
  console.log('Available exports:', Object.keys(viem));
  console.log('buildCreateAccountUserOp:', typeof viem.buildCreateAccountUserOp);
} catch (e) {
  console.error('Import failed:', e.message);
  console.error('Stack:', e.stack);
}
