import { proofHash, validDifficulty } from './crypto.mjs';

const [seedBlock, challenge, wallet, tokenId, difficultyText, contractAddress, chainIdText = process.env.CHAIN_ID || '1'] = process.argv.slice(2);

if (!seedBlock || !challenge || !wallet || !tokenId || !difficultyText || !contractAddress) {
  console.error('Usage: npm run mine -- <seedBlock> <challenge> <wallet> <tokenId> <difficultyBits> <contractAddress> [chainId]');
  process.exit(1);
}

const chainId = Number(chainIdText);
const difficultyBits = Number(difficultyText);
let nonce = 0n;
const started = Date.now();
let hashes = 0n;

while (true) {
  const hash = proofHash({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce });
  hashes++;
  if (validDifficulty(hash, difficultyBits)) {
    console.log(JSON.stringify({
      seedBlock: String(seedBlock), challenge, wallet, tokenId: String(tokenId), nonce: String(nonce), hash,
      difficultyBits, hashes: String(hashes), elapsedMs: Date.now() - started
    }, null, 2));
    break;
  }
  nonce++;
}
