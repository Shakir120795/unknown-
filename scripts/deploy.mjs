import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';

const network = process.argv.includes('--mainnet') ? 'mainnet' : 'sepolia';
const chainId = network === 'mainnet' ? 1 : 11155111;
const rpc = process.env.RPC_URL;
const key = process.env.DEPLOYER_PRIVATE_KEY;
const imd = process.env.IMD_TOKEN_ADDRESS;
const treasury = process.env.TREASURY_ADDRESS;
const metadataURI = process.env.REVEALED_BASE_URI;
const provenanceHash = process.env.PROVENANCE_HASH;
const prices = (process.env.PHASE_PRICES || '0.2,0.5,0.8,1.1,1.5,2.0').split(',').map(v=>v.trim());
const diffs = (process.env.PHASE_DIFFICULTY_BITS || '16,18,20,22,24,26').split(',').map(v=>Number(v.trim()));
const decimals = Number(process.env.IMD_DECIMALS || 18);
if (!rpc||!key||!imd||!treasury||!metadataURI||!provenanceHash) {
  throw new Error('Set RPC_URL, DEPLOYER_PRIVATE_KEY, IMD_TOKEN_ADDRESS, TREASURY_ADDRESS, REVEALED_BASE_URI, PROVENANCE_HASH');
}
if (prices.length!==6||diffs.length!==6||diffs.some((n,i)=>!Number.isInteger(n)||n<=0||n>248||(i>0&&n<=diffs[i-1]))) {
  throw new Error('PHASE_DIFFICULTY_BITS must contain six strictly increasing values');
}
const provider=new ethers.JsonRpcProvider(rpc);
const actualNetwork=await provider.getNetwork();
if(Number(actualNetwork.chainId)!==chainId) throw new Error(`RPC chain mismatch: expected ${chainId}, got ${actualNetwork.chainId}`);
const imdCode=await provider.getCode(imd);
if(imdCode==='0x') throw new Error('IMD_TOKEN_ADDRESS has no contract code on the selected network');
const imdContract=new ethers.Contract(imd,['function decimals() view returns(uint8)'],provider);
const actualDecimals=Number(await imdContract.decimals());
if(actualDecimals!==decimals) throw new Error(`IMD decimals mismatch: configured ${decimals}, token reports ${actualDecimals}`);
if(!/^0x[0-9a-fA-F]{64}$/.test(provenanceHash)) throw new Error('PROVENANCE_HASH must be a 32-byte hex value');
const wallet=new ethers.Wallet(key,provider);
const artifactPath=path.resolve('artifacts/contracts/UnknownMining.sol/UnknownMining.json');
if(!fs.existsSync(artifactPath)) throw new Error('Run npm run contract:compile first');
const artifact=JSON.parse(fs.readFileSync(artifactPath,'utf8'));
const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,wallet);
const priceUnits=prices.map(v=>ethers.parseUnits(v,decimals));
console.log('Network:',network,'Chain:',chainId,'Deployer:',wallet.address);
console.log('IMD:',imd,'Treasury:',treasury);
console.log('Metadata:',metadataURI);
const nft=await factory.deploy(imd,treasury,metadataURI,provenanceHash,priceUnits,diffs);
await nft.waitForDeployment();
const address=await nft.getAddress();
console.log('UNKNOWN_CONTRACT_ADDRESS='+address);
for(let i=1;i<=6;i++) console.log(`phase${i}: ${prices[i-1]} IMD / ${diffs[i-1]} bits`);
fs.writeFileSync(path.resolve(`deployment-${network}.json`), JSON.stringify({
  network,chainId,address,imdToken:imd,treasury,metadataURI,provenanceHash,prices,decimals,difficultyBits:diffs
},null,2)+'\\n');
console.log(`Wrote deployment-${network}.json`);
console.log('Publish the address to the web config only after the deployment is verified.');
