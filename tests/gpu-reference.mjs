import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildPowInput, proofHash } from '../packages/mining/crypto.mjs';

const K=[
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];
const u32=x=>x>>>0;
const rotr=(x,n)=>u32((x>>>n)|(x<<(32-n)));
const Ch=(x,y,z)=>u32((x&y)^(~x&z));
const Maj=(x,y,z)=>u32((x&y)^(x&z)^(y&z));
const S0=x=>u32(rotr(x,2)^rotr(x,13)^rotr(x,22));
const S1=x=>u32(rotr(x,6)^rotr(x,11)^rotr(x,25));
const G0=x=>u32(rotr(x,7)^rotr(x,18)^(x>>>3));
const G1=x=>u32(rotr(x,17)^rotr(x,19)^(x>>>10));
function words(bytes){const w=new Uint32Array(16);for(let i=0;i<16;i++){const j=i*4;w[i]=u32((bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3]);}return w;}
function compress(block, state){
 const w=new Uint32Array(64); w.set(words(block));
 for(let i=16;i<64;i++)w[i]=u32(G1(w[i-2])+w[i-7]+G0(w[i-15])+w[i-16]);
 let [A,B,C,D,E,F,G,H]=state;
 for(let r=0;r<64;r++){const t1=u32(H+S1(E)+Ch(E,F,G)+K[r]+w[r]);const t2=u32(S0(A)+Maj(A,B,C));H=G;G=F;F=E;E=u32(D+t1);D=C;C=B;B=A;A=u32(t1+t2);}
 return [u32(state[0]+A),u32(state[1]+B),u32(state[2]+C),u32(state[3]+D),u32(state[4]+E),u32(state[5]+F),u32(state[6]+G),u32(state[7]+H)];
}
function reference(bytes){
 const padded=new Uint8Array(128); padded.set(bytes); padded[112]=0x80; // 112-byte preimage
 const bitLen=896; padded[124]=(bitLen>>>24)&255;padded[125]=(bitLen>>>16)&255;padded[126]=(bitLen>>>8)&255;padded[127]=bitLen&255;
 const iv=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const s=compress(padded.slice(0,64),iv); const f=compress(padded.slice(64,128),s);
 return Buffer.from(f.flatMap(x=>[x>>>24,x>>>16,x>>>8,x]).map(x=>x&255)).toString('hex');
}
for(let nonce=0;nonce<32;nonce++){
 const args={chainId:1,contractAddress:'0x0000000000000000000000000000000000000001',challenge:'0x'+'22'.repeat(32),seedBlock:999,tokenId:77,wallet:'0x0000000000000000000000000000000000000002',nonce};
 const b=buildPowInput(args);
 assert.equal(reference(b),proofHash(args));
 assert.equal(reference(b),crypto.createHash('sha256').update(b).digest('hex'));
}
console.log('GPU SHA-256 reference parity passed for 32 nonce vectors');
