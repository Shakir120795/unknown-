import { proofHash, validDifficulty } from './crypto.mjs';

const [seedBlock, challenge, wallet, tokenId, nonce, difficultyText, expectedHash, contractAddress, chainIdText = process.env.CHAIN_ID || '1'] = process.argv.slice(2);
if ([seedBlock, challenge, wallet, tokenId, nonce, difficultyText, expectedHash, contractAddress].some(v => v === undefined)) {
  console.error('Usage: npm run verify -- <seedBlock> <challenge> <wallet> <tokenId> <nonce> <difficultyBits> <hash> <contractAddress> [chainId]');
  process.exit(1);
}
const chainId = Number(chainIdText);
const hash = proofHash({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce });
const valid = hash.toLowerCase() === String(expectedHash).replace(/^0x/i, '').toLowerCase() && validDifficulty(hash, Number(difficultyText));
console.log(JSON.stringify({ valid, hash, expectedHash }));
process.exit(valid ? 0 : 1);
