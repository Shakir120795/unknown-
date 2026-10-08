import { proofHash, staticPrefixWords } from './pow.js';

const SHADER = /* wgsl */ `
const K = array<u32,64>(
0x428a2f98u,0x71374491u,0xb5c0fbcfu,0xe9b5dba5u,0x3956c25bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u);

@group(0) @binding(0) var<storage,read> p: array<u32,29>;
@group(0) @binding(1) var<storage,read_write> out: array<atomic<u32>,11>;

fn rotr(x:u32,n:u32)->u32 { return (x>>n)|(x<<(32u-n)); }
fn Ch(x:u32,y:u32,z:u32)->u32 { return (x&y)^(~x&z); }
fn Maj(x:u32,y:u32,z:u32)->u32 { return (x&y)^(x&z)^(y&z); }
fn S0(x:u32)->u32 { return rotr(x,2u)^rotr(x,13u)^rotr(x,22u); }
fn S1(x:u32)->u32 { return rotr(x,6u)^rotr(x,11u)^rotr(x,25u); }
fn G0(x:u32)->u32 { return rotr(x,7u)^rotr(x,18u)^(x>>3u); }
fn G1(x:u32)->u32 { return rotr(x,17u)^rotr(x,19u)^(x>>10u); }

fn meets(w:array<u32,8>, bits:u32)->bool {
  let full = bits / 32u;
  let rem = bits % 32u;
  for(var i:u32=0u;i<full;i++){ if(w[i]!=0u){return false;} }
  if(rem>0u){ let mask:u32 = 0xffffffffu << (32u-rem); if((w[full]&mask)!=0u){return false;} }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let idx = gid.x;
  let lo = p[26u] + idx;
  let carry = select(0u, 1u, lo < p.baseLo);
  let hi = p[27u] + carry;

  // SHA-256 block 0 (first 64 bytes of the fixed 112-byte preimage).
  var w1 = array<u32,64>();
  for(var i:u32=0u;i<16u;i++){ w1[i]=p[i]; }
  for(var i:u32=16u;i<64u;i++){ w1[i]=G1(w1[i-2u])+w1[i-7u]+G0(w1[i-15u])+w1[i-16u]; }

  var A:u32=0x6a09e667u; var B:u32=0xbb67ae85u; var C:u32=0x3c6ef372u; var D:u32=0xa54ff53au;
  var E:u32=0x510e527fu; var F:u32=0x9b05688cu; var G:u32=0x1f83d9abu; var H:u32=0x5be0cd19u;
  for(var r:u32=0u;r<64u;r++){
    let t1=H+S1(E)+Ch(E,F,G)+K[r]+w1[r];
    let t2=S0(A)+Maj(A,B,C);
    H=G; G=F; F=E; E=D+t1; D=C; C=B; B=A; A=t1+t2;
  }
  let sA=A+0x6a09e667u; let sB=B+0xbb67ae85u; let sC=C+0x3c6ef372u; let sD=D+0xa54ff53au;
  let sE=E+0x510e527fu; let sF=F+0x9b05688cu; let sG=G+0x1f83d9abu; let sH=H+0x5be0cd19u;

  // SHA-256 block 1 (remaining 48-byte prefix + 8-byte nonce + padding + length).
  var w2 = array<u32,64>();
  for(var i:u32=0u;i<10u;i++){ w2[i]=p.prefix[16u+i]; }
  w2[10u]=hi;
  w2[11u]=lo;
  w2[12u]=0x80000000u;
  w2[13u]=0u; w2[14u]=0u; w2[15u]=896u;
  for(var i:u32=16u;i<64u;i++){ w2[i]=G1(w2[i-2u])+w2[i-7u]+G0(w2[i-15u])+w2[i-16u]; }

  A=sA; B=sB; C=sC; D=sD; E=sE; F=sF; G=sG; H=sH;
  for(var r:u32=0u;r<64u;r++){
    let t1=H+S1(E)+Ch(E,F,G)+K[r]+w2[r];
    let t2=S0(A)+Maj(A,B,C);
    H=G; G=F; F=E; E=D+t1; D=C; C=B; B=A; A=t1+t2;
  }

  let digest=array<u32,8>(A+sA,B+sB,C+sC,D+sD,E+sE,F+sF,G+sG,H+sH);
  if(meets(digest,p[28u])){
    let old = atomicMin(&out[0], idx);
    if(idx <= old){
      atomicStore(&out[1], lo); atomicStore(&out[2], hi);
      atomicStore(&out[3], digest[0]); atomicStore(&out[4],digest[1]);
      atomicStore(&out[5],digest[2]); atomicStore(&out[6],digest[3]);
      atomicStore(&out[7],digest[4]); atomicStore(&out[8],digest[5]);
      atomicStore(&out[9],digest[6]); atomicStore(&out[10],digest[7]);
    }
  }
}
`

export const GPU_SHADER = SHADER;

const BATCH = 65536;

export async function hasWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

function u64Parts(n) {
  n = BigInt(n); return [Number(n & 0xffffffffn), Number((n >> 32n) & 0xffffffffn)];
}

function hashFromWords(out) {
  return Array.from(out.slice(3,11), x => x.toString(16).padStart(8,'0')).join('');
}

export async function mineGpu({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, difficultyBits, startNonce='0', onProgress, signal }) {
  if (!(await hasWebGPU())) throw new Error('WEBGPU_UNAVAILABLE');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WEBGPU_ADAPTER_UNAVAILABLE');
  const device = await adapter.requestDevice();
  const prefix = staticPrefixWords({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce: 0 });
  const module = device.createShaderModule({ code: SHADER });
  const pipeline = await device.createComputePipelineAsync({ layout:'auto', compute:{module, entryPoint:'main'} });
  const bindGroupLayout = pipeline.getBindGroupLayout(0);
  let nonce = BigInt(startNonce);
  const started = performance.now();
  let batches = 0;

  try {
    while (!signal?.aborted) {
      const [lo, hi] = u64Parts(nonce);
      const params = new Uint32Array(29);
      params.set(prefix, 0); params[26]=lo; params[27]=hi; params[28]=Number(difficultyBits);
      const paramBuffer = device.createBuffer({size: params.byteLength, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
      const outputBuffer = device.createBuffer({size: 11*4, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
      device.queue.writeBuffer(paramBuffer, 0, params);
      const clear = new Uint32Array(11); clear[0]=0xffffffff;
      device.queue.writeBuffer(outputBuffer, 0, clear);
      const readBuffer = device.createBuffer({size:11*4, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      const bind = device.createBindGroup({layout:bindGroupLayout, entries:[
        {binding:0, resource:{buffer:paramBuffer}}, {binding:1, resource:{buffer:outputBuffer}}
      ]});
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0,bind); pass.dispatchWorkgroups(Math.ceil(BATCH/64)); pass.end();
      encoder.copyBufferToBuffer(outputBuffer,0,readBuffer,0,11*4);
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      const result = new Uint32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap(); paramBuffer.destroy(); outputBuffer.destroy(); readBuffer.destroy();
      batches++;
      onProgress?.({ hashes: BigInt(batches*BATCH).toString(), nonce: nonce.toString(), elapsedMs: Math.round(performance.now()-started) });
      if (result[0] !== 0xffffffff) {
        const winningNonce = nonce + BigInt(result[0]);
        // The winner index is atomic; the digest slots are intentionally ignored because
        // multiple winning invocations can race when writing non-atomic digest words.
        // Recompute the winning digest with the reference implementation for exact parity.
        const winningHash = proofHash({ chainId, contractAddress, challenge, seedBlock, tokenId, wallet, nonce: winningNonce });
        return { nonce: winningNonce.toString(), hash: winningHash, hashes: BigInt(batches*BATCH).toString(), elapsedMs: Math.round(performance.now()-started) };
      }
      nonce += BigInt(BATCH);
    }
    throw new Error('MINING_ABORTED');
  } finally {
    device.destroy();
  }
}
