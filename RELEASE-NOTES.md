# UNKNOWN Production Package

This package is the public launch build for the UNKNOWN 1,111 NFT collection.

## Included
- On-chain, backend-free SHA-256 proof-of-work minting.
- CPU miner with parallel browser workers.
- WebGPU GPU miner path.
- Six mint phases with increasing proof difficulty.
- EIP-712/backend/signer layer removed from the launch path.
- 1,111 source images, 1,111 HD images, and 1,111 source metadata files.
- Hidden placeholder metadata for the unrevealed state.
- Permissionless reveal after all 1,111 NFTs are minted.
- Deployment, verification, mining, and launch documentation.
- Local proof vectors, GPU reference parity checks, static checks, and collection integrity checks.

## Collection integrity
- Source assets: exactly 1,111.
- HD assets: exactly 1,111.
- Metadata files: exactly 1,111.
- Provenance hash: `0x3f46305502ca893461bdc3a6cf5bb7f7e715f16ce838a1ff29a055b7209432aa`.
- Private shuffle secret is excluded from this package.

## Environment limitation
The repository has been checked with Node syntax checks and the collection/PoW/GPU/static validation scripts. Hardhat compilation and EVM contract tests were prepared but could not be executed in this environment because npm package installation was blocked by external registry DNS/network availability. Run `npm install`, then `npm test` in a network-enabled environment before deployment.

## Private reveal kit
The private reveal kit is distributed separately. Never publish or deploy the shuffle secret as part of the public web/API bundle.
