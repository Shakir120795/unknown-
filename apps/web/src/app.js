import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { buildPowInput, proofHash, validDifficulty } from './pow.js';
import { hasWebGPU, mineGpu } from './gpu-miner.js';

const CONFIG = window.UNKNOWN_CONFIG || { chainId: 1, nftAddress: '', imdAddress: '', imdDecimals: 18, explorer: 'https://etherscan.io' };

const NFT_ABI = [
  'function totalMinted() view returns(uint256)',
  'function remaining() view returns(uint256)',
  'function currentPhase() view returns(uint8)',
  'function phasePrice(uint8) view returns(uint256)',
  'function phaseDifficultyBits(uint8) view returns(uint8)',
  'function currentWork() view returns(uint256,bytes32,uint256,uint8,uint256,uint8)',
  'function isValidProof(address,uint256,uint256,uint256) view returns(bool)',
  'function mint(uint256,uint256)',
  'function revealed() view returns(bool)',
  'function reveal()',
  'function provenanceHash() view returns(bytes32)'
];
const ERC20_ABI = [
  'function approve(address,uint256) returns(bool)',
  'function allowance(address,address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function balanceOf(address) view returns(uint256)'
];

const $ = id => document.getElementById(id);
let provider, signer, wallet, nft, imd, work, controller;

function setStatus(msg, cls='') { $('status').textContent = msg; $('status').className=cls; }
function setMintStatus(msg, cls='') { $('mintStatus').textContent = msg; $('mintStatus').className=cls; }
function short(addr) { return addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : ''; }

async function connect() {
  if (!window.ethereum) throw new Error('Install MetaMask or another EVM wallet.');
  provider = new BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CONFIG.chainId) throw new Error(`Wrong network. Switch to chain ${CONFIG.chainId}.`);
  signer = await provider.getSigner(); wallet = await signer.getAddress();
  nft = new Contract(CONFIG.nftAddress, NFT_ABI, signer);
  imd = new Contract(CONFIG.imdAddress, ERC20_ABI, signer);
  $('wallet').textContent = short(wallet);
  $('connect').textContent = 'Connected'; $('connect').disabled = true;
  $('mineCpu').disabled = false; $('mineGpu').disabled = !(await hasWebGPU());
  await refresh();
}

async function refresh() {
  if (!nft) return;
  const [minted, remaining, phase, price, difficulty, revealed] = await Promise.all([
    nft.totalMinted(), nft.remaining(), nft.currentPhase(), nft.phasePrice(await nft.currentPhase()),
    nft.phaseDifficultyBits(await nft.currentPhase()), nft.revealed()
  ]);
  const nextToken = BigInt(minted) + 1n;
  const phaseNumber = Number(phase);
  $('minted').textContent = minted.toString(); $('remaining').textContent = remaining.toString();
  $('phase').textContent = `Phase ${phase}`; $('token').textContent = `#${nextToken.toString().padStart(4,'0')}`;
  $('price').textContent = `${formatUnits(price, CONFIG.imdDecimals)} IMD`;
  $('difficulty').textContent = `${difficulty} bits`;
  $('reveal').textContent = revealed ? 'REVEALED' : 'HIDDEN';
  document.querySelectorAll('[data-phase]').forEach(el => {
    const n = Number(el.dataset.phase);
    el.classList.toggle('active', n === phaseNumber);
    el.classList.toggle('done', n < phaseNumber);
  });
  $('mintedRibbon').textContent = Number(minted) >= 1111 ? 'Collection sold out.' : `Operator #${nextToken.toString().padStart(4,'0')} is waiting.`;
  $('mintedRibbonSub').textContent = Number(minted) >= 1111 ? 'Reveal is permissionless on-chain.' : `${Number(remaining)} NFTs remain · Phase ${phaseNumber} · ${difficulty} difficulty bits`;
}

async function start(kind) {
  if (!nft || !wallet) return;
  controller?.abort(); controller = new AbortController();
  await refresh();
  if (Number((await nft.totalMinted())) >= 1111) return setStatus('Sold out.');
  const latest = await provider.getBlock('latest');
  work = {
    seedBlock: BigInt(latest.number),
    challenge: latest.hash,
    tokenId: (await nft.totalMinted()) + 1n,
    phase: await nft.currentPhase(),
    price: await nft.phasePrice(await nft.currentPhase()),
    difficultyBits: Number(await nft.phaseDifficultyBits(await nft.currentPhase()))
  };
  $('work').textContent = `Seed block ${work.seedBlock} · ${work.difficultyBits} bits`;
  $('mineCpu').disabled = true; $('mineGpu').disabled = true; $('stop').disabled = false;
  setStatus(`${kind.toUpperCase()} mining NFT ${work.tokenId}…`);

  try {
    let result;
    const args = { chainId: CONFIG.chainId, contractAddress: CONFIG.nftAddress, challenge: work.challenge,
      seedBlock: work.seedBlock, tokenId: work.tokenId, wallet, difficultyBits: work.difficultyBits };
    if (kind === 'gpu') {
      result = await mineGpu({...args, signal:controller.signal, onProgress:p => setStatus(`GPU mining · ${Number(p.hashes).toLocaleString()} hashes`)});
    } else {
      result = await new Promise((resolve,reject)=>{
        const count = Math.max(1, Math.min(8, Number(navigator.hardwareConcurrency || 4) - 1));
        const workers = []; let totalHashes = 0n; let settled = false;
        const prefix = Array.from(buildPowInput({...args, nonce:0}));
        const stopAll=()=>{ for(const w of workers) w.terminate(); };
        const stop=()=>{ if(!settled){ settled=true; stopAll(); reject(new Error('MINING_ABORTED')); } };
        controller.signal.addEventListener('abort', stop, {once:true});
        for(let i=0;i<count;i++){
          const worker = new Worker('./cpu-miner-worker.js', {type:'module'}); workers.push(worker);
          worker.onmessage=e=>{
            if(e.data.type==='progress'){ totalHashes += BigInt(e.data.hashes)-BigInt(worker._lastHashes||0); worker._lastHashes=e.data.hashes; setStatus(`CPU mining · ${count} workers · ${totalHashes.toString()} hashes`); }
            if(e.data.type==='solution' && !settled){ settled=true; stopAll(); resolve(e.data); }
          };
          worker.onerror=e=>{ if(!settled){ settled=true; stopAll(); reject(e.error||new Error('CPU_WORKER_ERROR')); } };
          worker.postMessage({type:'start', prefixBytes:prefix, startNonce:String(i), step:String(count), difficultyBits:work.difficultyBits,
            seedBlock:work.seedBlock.toString(), challenge:work.challenge, tokenId:work.tokenId.toString()});
        }
      });
    }
    if (controller.signal.aborted) throw new Error('MINING_ABORTED');
    const okLocal = validDifficulty(result.hash, work.difficultyBits) &&
      result.hash === proofHash({...args, nonce:result.nonce});
    if (!okLocal) throw new Error('LOCAL_PROOF_MISMATCH');
    setStatus(`Valid proof found. Submitting on-chain…`, 'ok');
    const onchainOk = await nft.isValidProof(wallet, work.tokenId, work.seedBlock, result.nonce);
    if (!onchainOk) throw new Error('PROOF_EXPIRED_OR_INVALID');
    const tx = await nft.mint(work.seedBlock, result.nonce);
    setMintStatus(`Mint transaction sent: ${tx.hash}`, 'ok');
    await tx.wait();
    setMintStatus(`SUCCESS — UNKNOWN #${work.tokenId} minted.`, 'ok');
    setStatus(`Winner confirmed on-chain. Token #${work.tokenId}.`, 'ok');
    window.open(`${CONFIG.explorer}/tx/${tx.hash}`, '_blank', 'noopener');
    await refresh();
  } catch (e) {
    if (controller.signal.aborted) setStatus('Mining stopped.');
    else { console.error(e); setStatus(e.shortMessage || e.message || 'Mining failed.', 'err'); }
  } finally {
    $('mineCpu').disabled = false; $('mineGpu').disabled = !(await hasWebGPU()); $('stop').disabled = true;
  }
}

$('connect').onclick = () => connect().catch(e=>setStatus(e.message,'err'));
$('mineCpu').onclick = () => start('cpu');
$('mineGpu').onclick = () => start('gpu');
$('stop').onclick = () => { controller?.abort(); $('stop').disabled=true; };

$('checkBalance').onclick = async()=>{
  if(!imd || !wallet) return;
  try { const bal=await imd.balanceOf(wallet); $('balance').textContent=`${formatUnits(bal, CONFIG.imdDecimals)} IMD`; } catch(e){ $('balance').textContent='—'; }
};

$('revealBtn').onclick = async()=>{
  if(!nft) return;
  try { setMintStatus('Checking reveal…'); if(!(await nft.revealed())) { const tx=await nft.reveal(); await tx.wait(); } setMintStatus('Collection revealed on-chain.', 'ok'); await refresh(); }
  catch(e){ setMintStatus(e.shortMessage || e.message, 'err'); }
};

(function boot(){
  $('configState').textContent = CONFIG.nftAddress && CONFIG.imdAddress ? 'Launch configuration loaded.' : 'Set VITE_CONTRACT_ADDRESS and VITE_IMD_TOKEN_ADDRESS before build.';
  $('mineGpu').disabled=true; refresh().catch(()=>{});
})();
