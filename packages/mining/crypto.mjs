import crypto from 'node:crypto';

const DOMAIN_BYTES = Buffer.from('UNKNOWN-MININGV2', 'ascii');

function hexBytes(value) {
  const hex = String(value).replace(/^0x/i, '');
  if (hex.length % 2 !== 0) throw new Error('HEX_MUST_BE_EVEN');
  return Buffer.from(hex, 'hex');
}

function addressBytes(address) {
  const bytes = hexBytes(address);
  if (bytes.length !== 20) throw new Error('INVALID_ADDRESS');
  return bytes;
}

function uintBytes(value, width) {
  const n = BigInt(value);
  if (n < 0n || n >= (1n << BigInt(width * 8))) throw new Error(`UINT${width * 8}_OVERFLOW`);
  const out = Buffer.alloc(width);
  let x = n;
  for (let i = width - 1; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function buildPowInput({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce }) {
  const challengeBytes = hexBytes(challenge);
  if (DOMAIN_BYTES.length !== 16) throw new Error('INVALID_DOMAIN');
  if (challengeBytes.length !== 32) throw new Error('INVALID_CHALLENGE');
  return Buffer.concat([
    DOMAIN_BYTES,
    uintBytes(chainId, 4),
    addressBytes(contractAddress),
    challengeBytes,
    uintBytes(seedBlock, 6),
    uintBytes(tokenId, 6),
    addressBytes(wallet),
    uintBytes(nonce, 8)
  ]);
}

export function proofHash(args) {
  const input = buildPowInput(args);
  if (input.length !== 112) throw new Error(`INVALID_POW_INPUT_LENGTH:${input.length}`);
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function validDifficulty(hash, difficultyBits) {
  const bits = Number(difficultyBits);
  if (!Number.isInteger(bits) || bits < 0 || bits > 256) return false;
  const value = BigInt(`0x${String(hash).replace(/^0x/i, '')}`);
  return value <= ((1n << 256n) - 1n >> BigInt(bits));
}
