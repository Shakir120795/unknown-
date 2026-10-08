# UNKNOWN — Production Contract

`UnknownMining.sol` is the backend-free PoW ERC-721 launch contract.

It uses:
- OpenZeppelin ERC-721
- Ownable + emergency pause
- ReentrancyGuard
- SafeERC20
- SHA-256 PoW verified on-chain
- exact 1,111 sequential token IDs
- six fixed price phases
- six strictly increasing difficulty phases
- one immutable metadata base URI
- unique artwork draw without replacement at mint time
- immediate per-token reveal
- on-chain artwork provenance hash

## Mint + reveal

Every successful PoW mint:
1. pays the current IMD phase price directly to the fixed treasury;
2. mints the next sequential token ID;
3. draws one unused artwork ID from the 1..1111 artwork pool;
4. stores `artIdOf[tokenId]` permanently on-chain;
5. makes `tokenURI(tokenId)` point immediately to the assigned artwork metadata.

There is no global reveal transaction and no backend mapping service.

## Proof

The browser CPU miner, browser WebGPU miner and Node miner all build the same fixed 112-byte preimage. The contract recomputes SHA-256 and requires the digest to satisfy the current phase's leading-zero-bit target.

## Deployment inputs

Set the real project values in the deployment environment:

- IMD token address
- IMD decimals
- treasury address
- metadata CID
- artwork provenance hash

Use `scripts/build-reveal.mjs` to build metadata files keyed by artwork ID, pin those files and the artwork images, then use `scripts/deploy.mjs` after the contract tests pass.
