import { bytesToHex, sha256, wordsBE } from './sha256.js';

const DOMAIN = new TextEncoder().encode('UNKNOWN-MININGV2');

function hexBytes(value) {
  const s = String(value).replace(/^0x/i, '');
  if (s.length !== 64 || /[^0-9a-f]/i.test(s)) throw new Error('INVALID_32_BYTE_HEX');
  return Uint8Array.from(s.match(/../g), h => parseInt(h, 16));
}

function addressBytes(address) {
  const s = String(address).replace(/^0x/i, '');
  if (s.length !== 40 || /[^0-9a-f]/i.test(s)) throw new Error('INVALID_ADDRESS');
  return Uint8Array.from(s.match(/../g), h => parseInt(h, 16));
}

function uintBytes(value, width) {
  let n = BigInt(value);
  const max = 1n << BigInt(width * 8);
  if (n < 0n || n >= max) throw new Error(`UINT${width * 8}_OVERFLOW`);
  const out = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; }
  return out;
}

export function buildPowInput({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce }) {
  const chunks = [
    DOMAIN,
    uintBytes(chainId, 4),
    addressBytes(contractAddress),
    hexBytes(challenge),
    uintBytes(seedBlock, 6),
    uintBytes(tokenId, 6),
    addressBytes(wallet),
    uintBytes(nonce, 8)
  ];
  const out = new Uint8Array(112);
  let off = 0;
  for (const chunk of chunks) { out.set(chunk, off); off += chunk.length; }
  return out;
}

export function proofHash(args) { return bytesToHex(sha256(buildPowInput(args))); }
export function staticPrefixWords(args) { return wordsBE(buildPowInput({...args, nonce: 0} ).slice(0, 104)); }
export function validDifficulty(hashHex, bits) {
  const n = BigInt(`0x${String(hashHex).replace(/^0x/i, '')}`);
  return n <= (((1n << 256n) - 1n) >> BigInt(Number(bits)));
}
