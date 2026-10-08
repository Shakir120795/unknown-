import assert from 'node:assert/strict';
import fs from 'node:fs';
const required=['contracts/UnknownMining.sol','apps/web/index.html','apps/web/src/app.js','apps/web/src/pow.js','apps/web/src/sha256.js','apps/web/src/gpu-miner.js','apps/web/src/cpu-miner-worker.js'];
for(const f of required) assert.ok(fs.existsSync(f),`missing ${f}`);
assert.equal(fs.existsSync('apps/api'),false,'backend directory must not exist');
const app=fs.readFileSync('apps/web/src/app.js','utf8');
assert.equal(app.includes('/v1/'),false,'frontend must not depend on backend API');
const contract=fs.readFileSync('contracts/UnknownMining.sol','utf8');
assert.equal(contract.includes('MINT_SIGNER'),false);
assert.equal(contract.includes('EIP712'),false);
assert.ok(contract.includes('sha256('));
console.log('static production checks passed');

assert.ok(fs.existsSync('apps/web/config.example.js'));
assert.ok(fs.existsSync('scripts/deploy.mjs'));
assert.ok(fs.existsSync('scripts/build-reveal.mjs'));
console.log('deployment/reveal assets present');
