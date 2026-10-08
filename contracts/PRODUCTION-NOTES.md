# UNKNOWN Contract — Production Notes

`UnknownMining.sol` is the launch contract for the 1,111 NFT PoW collection.

### Launch properties
- OpenZeppelin ERC-721
- 1,111 sequential token IDs
- IMD payment directly to the fixed treasury
- on-chain SHA-256 proof verification
- no backend
- no mint signer
- no EIP-712 authorization
- six fixed price phases
- six strictly increasing PoW difficulty phases
- recent Ethereum blockhash challenge
- stale challenge rejection after 32 blocks
- non-reentrant mint
- permissionless reveal after sellout
- collection provenance hash committed at deployment

The phase configuration is fixed in the constructor and there are no owner setters for price, difficulty, treasury or metadata URIs.

Owner control is limited to emergency pause/unpause. Operationally, use a secure owner wallet or multisig.
