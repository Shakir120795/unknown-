# UNKNOWN — Deployment

## 1. Collection
Run:

`npm run collection:verify`

It must report 1,111 images, 1,111 metadata files and the expected provenance hash.

Build hidden metadata with:

`npm run hidden:build`

Pin `collection/hidden-metadata/` and `collection/hidden/placeholder.png` to IPFS.

Keep the private shuffle secret offline. Do not put it in Git or public hosting.

## 2. Contract configuration
Set:

- `IMD_TOKEN_ADDRESS`
- `IMD_DECIMALS`
- `TREASURY_ADDRESS`
- `HIDDEN_BASE_URI`
- `REVEALED_BASE_URI`
- `PROVENANCE_HASH`
- `PHASE_PRICES`
- `PHASE_DIFFICULTY_BITS`
- `DEPLOYER_PRIVATE_KEY`
- `RPC_URL`

`PHASE_DIFFICULTY_BITS` must be strictly increasing. The default launch schedule is `16,18,20,22,24,26` leading-zero bits.

## 3. Test deployment
Compile and run the contract tests on a connected development machine:

`npm run contract:compile`

`npm run contract:test`

Deploy Sepolia:

`npm run deploy:sepolia`

After deployment, generate the web config:

`npm run web:config`

Then serve `apps/web/` over HTTPS and test wallet connect, CPU mining, GPU mining and minting end-to-end.

## 4. Mainnet
Deploy with:

`npm run deploy:mainnet`

Generate the production web config again with `npm run web:config`, then host `apps/web/` as a static site.

The contract has no backend, no coordinator and no mint signer. The NFT mint transaction is the proof submission and payment transaction.

## 5. Reveal
Once token #1111 is minted, anyone can call `reveal()`. The contract then switches `tokenURI()` from the hidden metadata base URI to the revealed metadata base URI.

Build revealed metadata from the private mapping with:

`PRIVATE_SHUFFLE_SECRET_FILE=/path/to/shuffle-secret.json REVEAL_IMAGES_CID=<cid> npm run reveal:build`

Pin that generated directory before sellout, but do not publish the mapping/metadata association until your launch policy permits the reveal.
