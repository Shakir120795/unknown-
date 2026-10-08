# UNKNOWN — Security Notes

- No backend secrets are required for minting.
- No mint signer exists in the production contract.
- The treasury and collection metadata bases are fixed at deployment.
- Phase prices and PoW difficulty are fixed at deployment.
- `mint()` uses a non-reentrant guard and SafeERC20 transfer.
- PoW is SHA-256 and verified on-chain.
- Proofs are bound to chain ID, contract address, blockhash challenge, seed block, token ID, minter and nonce.
- A seed block is valid for at most 32 blocks.
- Only the current next token can be minted, so stale proofs cannot mint later token IDs.
- Reveal is permissionless but gated by the full 1,111 supply being minted.
- The private shuffle map must remain offline until the intended reveal.

An external audit is not assumed by the repository. Test and deployment verification are still required before mainnet use.
