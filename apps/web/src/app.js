import { BrowserProvider, Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { buildPowInput, proofHash, validDifficulty } from './pow.js';
import { hasWebGPU, mineGpu } from './gpu-miner.js';

const CONFIG = window.UNKNOWN_CONFIG || { chainId: 1, nftAddress: '', imdAddress: '', imdDecimals: 18, explorer: 'https://etherscan.io', rpcUrl: 'https://ethereum-rpc.publicnode.com' };
const NFT_ADDRESS = String(CONFIG.nftAddress || '').toLowerCase();
const IMD_ADDRESS = String(CONFIG.imdAddress || '').toLowerCase();

const NFT_ABI = [
  'function totalMinted() view returns(uint256)',
  'function remaining() view returns(uint256)',
  'function currentPhase() view returns(uint8)',
  'function phasePrice(uint8) view returns(uint256)',
  'function phaseDifficultyBits(uint8) view returns(uint8)',
  'function currentWork() view returns(uint256,bytes32,uint256,uint8,uint256,uint8)',
  'function isValidProof(address,uint256,uint48,uint64) view returns(bool)',
  'function mint(uint48,uint64)',
  'function artIdOf(uint256) view returns(uint256)',
  'function tokenURI(uint256) view returns(string)',
  'function provenanceHash() view returns(bytes32)'
];

const ERC20_ABI = [
  'function approve(address,uint256) returns(bool)',
  'function allowance(address,address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function balanceOf(address) view returns(uint256)'
];

const $ = id => document.getElementById(id);
let provider, readProvider, signer, wallet, nft, imd, work, controller;

function setStatus(msg, cls='') { $('status').textContent = msg; $('status').className=cls; }
function setMintStatus(msg, cls='') { $('mintStatus').textContent = msg; $('mintStatus').className=cls; }
function short(addr) { return addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : ''; }

function formatCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 H';
  if (n >= 1e15) return `${(n / 1e15).toFixed(2)} PH`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TH`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GH`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MH`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} KH`;
  return `${Math.round(n)} H`;
}

function setConnectedUi(address) {
  wallet = address;
  $('wallet').textContent = short(address);
  $('connect').textContent = 'Connected';
  $('connect').disabled = true;
}

function setDisconnectedUi() {
  wallet = null;
  signer = null;
  nft = null;
  imd = null;
  $('wallet').textContent = 'Not connected';
  $('connect').textContent = 'Connect Wallet';
  $('connect').disabled = false;
  $('mineCpu').disabled = true;
  $('mineGpu').disabled = true;
  $('balance').textContent = '—';
  setStatus('Connect your wallet to begin.');
}

async function connect(requestAccounts = true) {
  if (!window.ethereum) throw new Error('Install MetaMask or another EVM wallet.');
  if (!provider) provider = new BrowserProvider(window.ethereum);
  if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);

  const accounts = requestAccounts
    ? await provider.send('eth_requestAccounts', [])
    : await provider.send('eth_accounts', []);
  const address = accounts?.[0];
  if (!address) throw new Error('No wallet account is connected to this site.');

  const chainHex = await provider.send('eth_chainId', []);
  const chainId = Number.parseInt(chainHex, 16);
  setConnectedUi(address);

  if (chainId !== CONFIG.chainId) {
    if (requestAccounts && chainId !== CONFIG.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CONFIG.chainId.toString(16) }]
        });
        const switchedHex = await provider.send('eth_chainId', []);
        const switchedId = Number.parseInt(switchedHex, 16);
        if (switchedId !== CONFIG.chainId) {
          throw new Error('Ethereum Mainnet switch did not complete.');
        }
      } catch (e) {
        if (e?.code === 4001) throw new Error('Network switch cancelled in wallet.');
        throw new Error('Please switch MetaMask to Ethereum Mainnet (chain 1).');
      }
    } else {
      setStatus('Wrong network. Switch to Ethereum Mainnet (chain ' + CONFIG.chainId + ').', 'err');
      $('mineCpu').disabled = true;
      $('mineGpu').disabled = true;
      return;
    }
  }

  // Refresh the provider network after any MetaMask chain switch.
  await provider.send('eth_chainId', []);
  signer = await provider.getSigner();
  nft = new Contract(NFT_ADDRESS, NFT_ABI, signer);
  imd = new Contract(IMD_ADDRESS, ERC20_ABI, signer);
  $('mineCpu').disabled = false;
  $('mineGpu').disabled = !(await hasWebGPU());
  await refreshWalletBalance();

  try {
    await refresh();
    setStatus('Wallet connected. Ready to mine.', 'ok');
  } catch (e) {
    console.error('CHAIN_REFRESH_ERROR', e);
    setStatus('Wallet connected, but chain data could not be loaded: ' + (e.shortMessage || e.message || 'unknown error'), 'err');
  }
}

async function refresh() {
  if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);
  const readNft = new Contract(NFT_ADDRESS, NFT_ABI, readProvider);
  const sourceNft = nft || readNft;
  if (!sourceNft) return;
  const phase = await sourceNft.currentPhase();
  const [minted, remaining, price, difficulty] = await Promise.all([
    sourceNft.totalMinted(), sourceNft.remaining(), sourceNft.phasePrice(phase), sourceNft.phaseDifficultyBits(phase)
  ]);
  const nextToken = BigInt(minted) + 1n;
  const phaseNumber = Number(phase);
  $('minted').textContent = minted.toString();
  $('remaining').textContent = remaining.toString();
  $('phase').textContent = `Phase ${phase}`;
  $('token').textContent = `#${nextToken.toString().padStart(4,'0')}`;
  $('price').textContent = `${formatUnits(price, CONFIG.imdDecimals)} IMD`;
  $('difficulty').textContent = `${difficulty} bits`;
  $('reveal').textContent = 'INSTANT';
  document.querySelectorAll('[data-phase]').forEach(el => {
    const n = Number(el.dataset.phase);
    el.classList.toggle('active', n === phaseNumber);
    el.classList.toggle('done', n < phaseNumber);
  });
  $('mintedRibbon').textContent = Number(minted) >= 1111 ? 'Collection sold out.' : `Operator #${nextToken.toString().padStart(4,'0')} is waiting.`;
  $('mintedRibbonSub').textContent = Number(minted) >= 1111 ? 'Every minted NFT was revealed at mint.' : `${Number(remaining)} NFTs remain · Phase ${phaseNumber} · ${difficulty} difficulty bits · instant reveal`;
}

async function start(kind) {
  if (!nft || !wallet) return;
  controller?.abort(); controller = new AbortController();
  await refresh();
  if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);
  const readNft = new Contract(NFT_ADDRESS, NFT_ABI, readProvider);

  // Mirror the contract's currentWork() exactly without relying on an eth_call that can
  // return empty revert data on some public RPCs: seedBlock = latestBlock - 1.
  const latestNumber = await readProvider.getBlockNumber();
  if (latestNumber < 1) throw new Error('CHAIN_NOT_READY');
  const seedBlock = latestNumber - 1;
  const seed = await readProvider.getBlock(seedBlock);
  if (!seed?.hash) throw new Error('SEED_BLOCK_UNAVAILABLE');

  const minted = await readNft.totalMinted();
  const phase = await readNft.currentPhase();
  const [price, difficulty] = await Promise.all([
    readNft.phasePrice(phase),
    readNft.phaseDifficultyBits(phase)
  ]);
  if (Number(minted) >= 1111) return setStatus('Sold out.');

  const expectedTokenId = BigInt(minted) + 1n;
  work = {
    seedBlock: BigInt(seedBlock),
    challenge: seed.hash,
    tokenId: expectedTokenId,
    phase,
    price,
    difficultyBits: Number(difficulty)
  };
  $('work').textContent = `Seed block ${work.seedBlock} · ${work.difficultyBits} bits`;
  $('mineCpu').disabled = true; $('mineGpu').disabled = true; $('stop').disabled = false;
  const miningStartedAt = performance.now();
  setStatus(`${kind.toUpperCase()} mining NFT ${work.tokenId}…`);

  try {
    let result;
    const args = { chainId: CONFIG.chainId, contractAddress: NFT_ADDRESS, challenge: work.challenge,
      seedBlock: work.seedBlock, tokenId: work.tokenId, wallet, difficultyBits: work.difficultyBits };
    if (kind === 'gpu') {
      result = await mineGpu({...args, signal:controller.signal, onProgress:p => setStatus(`GPU mining · ${formatCompact(p.hashes)} · ${formatCompact(Number(p.hashes) / Math.max(0.001, (performance.now() - miningStartedAt) / 1000))}/s`)});
    } else {
      result = await new Promise((resolve,reject)=>{
        const count = Math.max(1, Math.min(8, Number(navigator.hardwareConcurrency || 4) - 1));
        const workers = []; let totalHashes = 0n; let settled = false;
        const prefix = Array.from(buildPowInput({...args, nonce:0}));
        const stopAll=()=>{ for(const w of workers) w.terminate(); };
        const stop=()=>{ if(!settled){ settled=true; stopAll(); reject(new Error('MINING_ABORTED')); } };
        controller.signal.addEventListener('abort', stop, {once:true});
        for(let i=0;i<count;i++){
          const worker = new Worker(new URL('./cpu-miner-worker.js', import.meta.url), {type:'module'}); workers.push(worker);
          worker.onmessage=e=>{
            if(e.data.type==='progress'){ totalHashes += BigInt(e.data.hashes)-BigInt(worker._lastHashes||0); worker._lastHashes=e.data.hashes; const elapsedSec = Math.max(0.001, (performance.now() - miningStartedAt) / 1000);
              setStatus(`CPU mining · ${count} workers · ${formatCompact(totalHashes)} · ${formatCompact(Number(totalHashes) / elapsedSec)}/s`); }
            if(e.data.type==='solution' && !settled){ settled=true; stopAll(); resolve(e.data); }
          };
          worker.onerror=e=>{ if(!settled){ settled=true; stopAll(); reject(e.error||new Error('CPU_WORKER_ERROR')); } };
          worker.postMessage({type:'start', prefixBytes:prefix, startNonce:String(i), step:String(count), difficultyBits:work.difficultyBits,
            seedBlock:work.seedBlock.toString(), challenge:work.challenge, tokenId:work.tokenId.toString()});
        }
      });
    }
    if (controller.signal.aborted) throw new Error('MINING_ABORTED');

    // The smart contract is the final authority. Recompute locally for diagnostics,
    // then verify the candidate nonce directly with the deployed contract before payment.
    // Recompute the candidate from the canonical proof input. The nonce is the
    // only value the GPU/CPU miner needs to return; its displayed digest is not
    // trusted because GPU work can race across lanes.
    const recomputedHash = proofHash({...args, nonce: result.nonce});
    const localValid = validDifficulty(recomputedHash, work.difficultyBits);
    if (!localValid) throw new Error('PROOF_INVALID');

    setStatus('Valid proof found. Confirming on-chain…', 'ok');

    const onchainOk = await readNft.isValidProof(wallet, work.tokenId, work.seedBlock, result.nonce);
    if (!onchainOk) throw new Error('PROOF_REJECTED_ONCHAIN');

    setStatus('Proof accepted by contract. Preparing IMD payment…', 'ok');

    const readImd = new Contract(IMD_ADDRESS, ERC20_ABI, readProvider);
    const balance = await readImd.balanceOf(wallet);
    if (balance < work.price) throw new Error(`Insufficient IMD balance. Need ${formatUnits(work.price, CONFIG.imdDecimals)} IMD.`);

    const allowance = await imd.allowance(wallet, NFT_ADDRESS);
    if (allowance < work.price) {
      setMintStatus(`Approve ${formatUnits(work.price, CONFIG.imdDecimals)} IMD in your wallet…`);
      const approveTx = await imd.approve(CONFIG.nftAddress, work.price);
      await approveTx.wait();
    }

    const tx = await nft.mint(work.seedBlock, result.nonce);
    setMintStatus(`Mint transaction sent: ${tx.hash}`, 'ok');
    await tx.wait();

    const artId = await nft.artIdOf(work.tokenId);
    setMintStatus(`SUCCESS — UNKNOWN #${work.tokenId} minted · ART #${artId} revealed.`, 'ok');
    setStatus(`Winner confirmed on-chain. Token #${work.tokenId} · Art #${artId}.`, 'ok');
    window.open(`${CONFIG.explorer}/tx/${tx.hash}`, '_blank', 'noopener');
    window.open(`https://opensea.io/assets/ethereum/${CONFIG.nftAddress}/${work.tokenId}`, '_blank', 'noopener');
    await refresh();
  } catch (e) {
    if (controller.signal.aborted) setStatus('Mining stopped.');
    else {
      console.error('MINING_ERROR', e);
      const reason = e?.shortMessage || e?.reason || e?.info?.error?.message || e?.message || 'Mining failed.';
      setStatus(reason, 'err');
    }
  } finally {
    $('mineCpu').disabled = false; $('mineGpu').disabled = !(await hasWebGPU()); $('stop').disabled = true;
  }
}

$('connect').onclick = () => connect(true).catch(e=>setStatus(e.message || 'Wallet connection failed.', 'err'));
$('mineCpu').onclick = () => start('cpu');
$('mineGpu').onclick = () => start('gpu');
$('stop').onclick = () => { controller?.abort(); $('stop').disabled=true; };

if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', accounts => {
    if (!accounts?.length) setDisconnectedUi();
    else connect(false).catch(e => setStatus(e.message || 'Wallet reconnect failed.', 'err'));
  });
  window.ethereum.on('chainChanged', () => {
    setDisconnectedUi();
    setStatus('Network changed. Reconnecting…');
    connect(false).catch(e => setStatus(e.message || 'Network reconnect failed.', 'err'));
  });
}

async function refreshWalletBalance() {
  if (!wallet) {
    $('balance').textContent = '—';
    return;
  }
  try {
    // Prefer the connected wallet provider when available. This avoids browser CORS/RPC
    // issues on public RPC endpoints and reads the exact connected account.
    if (imd) {
      const bal = await imd.balanceOf(wallet);
      $('balance').textContent = formatUnits(bal, CONFIG.imdDecimals) + ' IMD';
      return;
    }
    if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);
    const readImd = new Contract(IMD_ADDRESS, ERC20_ABI, readProvider);
    const bal = await readImd.balanceOf(wallet);
    $('balance').textContent = formatUnits(bal, CONFIG.imdDecimals) + ' IMD';
  } catch (e) {
    console.warn('IMD_BALANCE_READ_ERROR', e);
    $('balance').textContent = '—';
  }
}

$('checkBalance').onclick = async()=>{
  await refreshWalletBalance();
};

(async function boot(){
  $('configState').textContent = CONFIG.nftAddress && CONFIG.imdAddress ? 'Launch configuration loaded.' : 'Set contract and IMD token addresses before build.';
  $('mineCpu').disabled=true; $('mineGpu').disabled=true;
  try {
    readProvider = new JsonRpcProvider(CONFIG.rpcUrl);
    await refresh();
    if (!wallet) setStatus('Live chain data loaded. Connect your wallet to mine.');
  } catch (e) {
    console.warn('LIVE_CHAIN_READ_ERROR', e);
    setStatus('Live chain data unavailable. Please refresh the page.', 'err');
  }
  if (window.ethereum?.on) {
    try {
      provider = provider || new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_accounts', []);
      if (accounts?.[0]) await connect(false);
    } catch (e) {
      console.warn('WALLET_RESTORE_ERROR', e);
    }
  }
  window.setInterval(() => {
    refresh().catch(e => console.warn('LIVE_REFRESH_ERROR', e));
    refreshWalletBalance().catch(e => console.warn('IMD_BALANCE_REFRESH_ERROR', e));
  }, 12000);
})();
