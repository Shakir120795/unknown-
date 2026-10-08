# UNKNOWN — Launch Sequence

1. Verify the 1,111-image collection.
2. Build and pin hidden metadata + placeholder image to IPFS.
3. Build the private reveal metadata from the shuffle secret and final image CID; keep the secret offline.
4. Compile the contract and run the complete EVM test suite.
5. Deploy and test on Sepolia.
6. Deploy the final contract on Ethereum mainnet.
7. Generate `apps/web/config.js` with the deployed contract and IMD addresses.
8. Host `apps/web/` on a static HTTPS host.
9. Start PoW minting.
10. After NFT #1111 is minted, call `reveal()`; anyone can call it.

Future UNKNOWN-token/staking/TGE mechanics are separate from the NFT launch contract and are not part of the current mint path.
