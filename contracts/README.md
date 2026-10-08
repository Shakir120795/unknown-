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
- fixed hidden and revealed metadata base URIs
- permissionless reveal after sellout
- on-chain artwork provenance hash

## Proof

The browser CPU miner, browser WebGPU miner and Node miner all build the same fixed 112-byte preimage. The contract recomputes SHA-256 and requires the digest to satisfy the current phase's leading-zero-bit target.

## Deployment inputs

Set the real project values in the deployment environment:

- IMD token address
- IMD decimals
- treasury address
- hidden metadata CID
- revealed metadata CID
- artwork provenance hash

Use `scripts/deploy.mjs` after the contract tests pass.
