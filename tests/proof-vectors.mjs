import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildPowInput, proofHash, validDifficulty } from '../packages/mining/crypto.mjs';

const args={chainId:1,contractAddress:'0x0000000000000000000000000000000000000001',challenge:'0x'+'11'.repeat(32),seedBlock:12345,tokenId:1,wallet:'0x0000000000000000000000000000000000000002',nonce:0};
const input=buildPowInput(args);
assert.equal(input.length,112);
const expected='0cd200c4df042291bc7cfb8d4caf7e97792226b8386b74a309c24748951a4404';
assert.equal(crypto.createHash('sha256').update(input).digest('hex'), expected);
assert.equal(proofHash(args), expected);
assert.equal(validDifficulty('00'+ 'ff'.repeat(31), 8), true);
assert.equal(validDifficulty('01'+ '00'.repeat(31), 8), false);
let nonce=0; let hash='';
do { hash=proofHash({...args,nonce}); nonce++; } while(!validDifficulty(hash,16));
assert.ok(nonce>0 && nonce<2_000_000);
console.log(JSON.stringify({ok:true,vectorHash:expected,solutionNonce:nonce-1,solutionHash:hash},null,2));
