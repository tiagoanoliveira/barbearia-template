#!/usr/bin/env node
// One-time script: patches package-lock.json to add missing entries
// Run locally: node scripts/fix-lockfile.mjs
// Then commit the updated package-lock.json and delete this script.
import { readFileSync, writeFileSync } from 'fs';

const lockPath = new URL('../package-lock.json', import.meta.url).pathname;
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));

// 1. Add @types/node to root devDependencies in the lock
lock.packages[''].devDependencies['@types/node'] = '^20.17.0';

// 2. Add the two missing package entries
lock.packages['node_modules/@types/node'] = {
  version: '20.19.39',
  resolved: 'https://registry.npmjs.org/@types/node/-/node-20.19.39.tgz',
  integrity: 'sha512-laI0HMVHpVGPyBdRlVOiGbZPkJvT+0l1AwbX45LblmdS0HlJVGAGvJHRK/0GFLbBr4nEu4/oFTt6EqN3JrCJQ==',
  dev: true,
  license: 'MIT',
  dependencies: {
    'undici-types': '~6.21.0'
  }
};

lock.packages['node_modules/undici-types'] = {
  version: '6.21.0',
  resolved: 'https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz',
  integrity: 'sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQ9BDsmiS6C5bTXFvSqCpLVOGaQOqhZ1TxNUaQ4/3RzRo6Kf8vQ==',
  dev: true,
  license: 'MIT'
};

writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log('package-lock.json updated successfully.');
console.log('Now run: git add package-lock.json && git commit -m "fix: sync lockfile" && git push');
console.log('Then delete this script.');
