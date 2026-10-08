# UNKNOWN — Production Architecture

## Launch model
UNKNOWN is a direct on-chain proof-of-work NFT mint. There is **no backend, no database, no coordinator and no mint signer**.

A miner fetches a recent Ethereum block hash, searches nonces locally, then submits `mint(seedBlock, nonce)`. The contract recomputes the SHA-256 proof, checks the phase difficulty, transfers the phase price in IMD, and mints the next sequential token.

## Phases
| Phase | Token IDs | Price | Difficulty |
|---|---:|---:|---:|
| 1 | 1–200 | 0.2 IMD | 16 leading zero bits |
| 2 | 201–400 | 0.5 IMD | 18 leading zero bits |
| 3 | 401–600 | 0.8 IMD | 20 leading zero bits |
| 4 | 601–800 | 1.1 IMD | 22 leading zero bits |
| 5 | 801–1000 | 1.5 IMD | 24 leading zero bits |
| 6 | 1001–1111 | 2.0 IMD | 26 leading zero bits |

Difficulty is fixed in the constructor and strictly increases every phase.

## Proof layout
The exact 112-byte preimage is:

`DOMAIN(16) | chainId(uint32) | contract(address) | challenge(blockhash)(32) | seedBlock(uint48) | tokenId(uint48) | minter(address) | nonce(uint64)`

The browser CPU miner, browser WebGPU miner and Node miner all use this layout.

## Collection
- 1,111 original 64×64 RGBA PNGs
- 1,111 640×640 display PNGs
- 1,111 trait metadata files
- provenance hash committed on-chain
- private shuffle map kept offline
- hidden placeholder metadata generated for every token ID
- reveal metadata generated only from the private shuffle map

The final token metadata is not revealed until all 1,111 NFTs are minted. `reveal()` is permissionless after sell-out and cannot be called early.

## Production checklist
1. Verify the collection with `npm run collection:verify`.
2. Pin hidden metadata and placeholder image to IPFS.
3. Pin the final revealed metadata + image collection to IPFS, but keep the mapping secret offline until sell-out.
4. Set `HIDDEN_BASE_URI`, `REVEALED_BASE_URI`, `PROVENANCE_HASH`, exact IMD token address and treasury address.
5. Deploy to Sepolia and run the complete wallet → mine → mint flow.
6. Repeat on Ethereum mainnet with the final production config.
7. Build the web app with the deployed mainnet addresses.
8. Host `apps/web/dist` on a static HTTPS host (Vercel/Cloudflare Pages/etc.).
9. Keep deployer private key out of the repository and use a hardware wallet / secure signer operationally.

No contract audit is assumed in this repository. The code includes tests and deployment checks, but an audit is not part of this launch workflow.
