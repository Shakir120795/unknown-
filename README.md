# UNKNOWN — On-Chain Proof-of-Work NFT

**Mine → Prove → Mint**

UNKNOWN is a 1,111 NFT Ethereum collection where every token is minted by a valid SHA-256 proof-of-work. The production design is intentionally backend-free.

## What is included

- 1,111 original 64×64 PNG artworks
- 1,111 640×640 display PNGs
- 1,111 trait metadata files
- hidden placeholder artwork + generated hidden metadata
- private shuffle/reveal workflow (secret intentionally excluded)
- on-chain ERC-721 contract
- on-chain IMD payment
- on-chain SHA-256 PoW verification
- CPU browser miner
- WebGPU browser miner
- Node CPU miner / verifier
- fixed six-phase pricing
- fixed six-phase increasing PoW difficulty
- permissionless reveal after the final NFT is minted

## Launch phases

| Phase | Tokens | Price | Difficulty |
|---|---:|---:|---:|
| 1 | 1–200 | 0.2 IMD | 16 bits |
| 2 | 201–400 | 0.5 IMD | 18 bits |
| 3 | 401–600 | 0.8 IMD | 20 bits |
| 4 | 601–800 | 1.1 IMD | 22 bits |
| 5 | 801–1000 | 1.5 IMD | 24 bits |
| 6 | 1001–1111 | 2.0 IMD | 26 bits |

Difficulty is leading-zero bits and is locked in the contract constructor.

## No backend

A miner reads a recent Ethereum block hash, searches nonces locally and sends `mint(seedBlock, nonce)`. The contract recomputes the hash and decides whether the proof is valid. The first valid transaction that reaches the contract mints the next sequential token.

## Local checks

`npm run collection:verify`

`npm run hidden:build`

`npm run proof:test`

`npm run static:check`

`npm run contract:compile`

`npm run contract:test`

The last two require the Solidity/Hardhat dependencies to be installed on the machine running the project.

## Deploy

Use `.env.example` as the configuration template and follow `docs/DEPLOYMENT.md`.

Never publish the private shuffle secret. Never put deployment private keys in the repository or browser bundle.
