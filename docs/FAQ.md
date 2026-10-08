# UNKNOWN — FAQ

### Is there a backend?
No. Mining, proof verification and minting are on-chain/client-side.

### CPU or GPU?
Both. CPU uses a dedicated Web Worker. Compatible browsers can use WebGPU for GPU mining.

### How does difficulty increase?
Each phase has a fixed leading-zero-bit target. The six launch defaults are 16, 18, 20, 22, 24 and 26 bits.

### What happens after sellout?
`reveal()` can be called by anyone. The contract switches metadata from the hidden base URI to the revealed base URI.

### Is the artwork in the repository?
Yes. The public collection package contains 1,111 images, 1,111 HD display images and 1,111 source metadata files. The private shuffle map is intentionally excluded from the production package.
