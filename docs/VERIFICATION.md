# Verification Status

Automated checks completed in the build environment:

- collection integrity: PASS (1,111 images + 1,111 metadata)
- provenance hash recomputation: PASS
- hidden metadata generation: PASS
- Node proof vector: PASS
- browser SHA-256 implementation parity: PASS
- GPU two-block SHA-256 reference parity: PASS (32 vectors)
- static production checks: PASS

Hardhat/Solidity compilation and the full EVM test suite could not be executed in the build environment because the npm registry was unreachable and the required packages were not preinstalled. Before mainnet deployment, run:

`npm install`

`npm run contract:compile`

`npm run contract:test`

A clean result is a launch gate in addition to the collection checks above.
