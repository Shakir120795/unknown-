import { bytesToHex, sha256 } from './sha256.js';

let running = false;
let ctx = null;

function writeNonce(message, nonce) {
  const out = message.slice();
  let n = BigInt(nonce);
  for (let i = 7; i >= 0; i--) { out[104 + i] = Number(n & 0xffn); n >>= 8n; }
  return out;
}

function meetsDifficulty(bytes, bits) {
  const full = Math.floor(bits / 8);
  const rem = bits % 8;
  for (let i = 0; i < full; i++) if (bytes[i] !== 0) return false;
  if (rem) return (bytes[full] & (0xff << (8 - rem))) === 0;
  return true;
}

self.onmessage = ({ data }) => {
  if (data.type === 'stop') { running = false; return; }
  if (data.type !== 'start') return;

  running = true;
  const base = Uint8Array.from(data.prefixBytes);
  const difficultyBits = Number(data.difficultyBits);
  let nonce = BigInt(data.startNonce || '0');
  const step = BigInt(data.step || '1');
  let hashes = 0n;
  const started = performance.now();
  ctx = data;

  while (running) {
    const digest = sha256(writeNonce(base, nonce));
    hashes++;
    if (meetsDifficulty(digest, difficultyBits)) {
      self.postMessage({
        type: 'solution', nonce: nonce.toString(), hash: bytesToHex(digest), hashes: hashes.toString(),
        elapsedMs: Math.round(performance.now() - started), seedBlock: data.seedBlock,
        challenge: data.challenge, tokenId: data.tokenId
      });
      running = false;
      return;
    }
    nonce += step;
    if ((hashes % 10000n) === 0n) {
      self.postMessage({ type: 'progress', hashes: hashes.toString(), nonce: nonce.toString(),
        elapsedMs: Math.round(performance.now() - started) });
    }
  }
};
