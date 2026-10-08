import assert from 'node:assert/strict';
import { proofHash, validDifficulty } from '../packages/mining/crypto.mjs';

const args = {
  chainId: 11155111,
  contractAddress: '0x0000000000000000000000000000000000000001',
  roundId: 1,
  challenge: 'abcd',
  wallet: '0x0000000000000000000000000000000000000002',
  nonce: 0
};

const h = proofHash(args);
assert.equal(typeof h, 'string');
assert.equal(h.length, 64);
assert.equal(validDifficulty(h, 0), true);
assert.notEqual(
  proofHash({...args, wallet:'0x0000000000000000000000000000000000000003'}),
  h
);

console.log('security smoke tests passed');
