import { BrowserProvider, Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { buildPowInput, proofHash, validDifficulty } from './pow.js';
import { hasWebGPU, mineGpu } from './gpu-miner.js';
import { chooseWalletProvider, restoreWalletProvider, disconnectWalletApp } from '../wallet-connect.js';

const CONFIG = window.UNKNOWN_CONFIG || { chainId: 1, nftAddress: '', imdAddress: '', imdDecimals: 18, explorer: 'https://etherscan.io', rpcUrl: 'https://ethereum-rpc.publicnode.com' };
const NFT_ADDRESS = String(CONFIG.nftAddress || '').toLowerCase();
const IMD_ADDRESS = String(CONFIG.imdAddress || '').toLowerCase();
const WALLET_DISCONNECTED_KEY = 'unknown-wallet-app-disconnected';

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
let provider, rawWalletProvider, boundWalletProvider, readProvider, signer, wallet, nft, imd, work, controller;

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
  localStorage.removeItem(WALLET_DISCONNECTED_KEY);
  $('connect').textContent = 'DISCONNECT WALLET';
  $('connect').disabled = false;
}

function setDisconnectedUi(markLocallyDisconnected = false) {
  if (markLocallyDisconnected) localStorage.setItem(WALLET_DISCONNECTED_KEY, '1');
  wallet = null;
  signer = null;
  nft = null;
  imd = null;
  $('wallet').textContent = 'Not connected';
  $('connect').textContent = 'CONNECT WALLET';
  $('connect').disabled = false;
  $('mineCpu').disabled = true;
  $('mineGpu').disabled = true;
  $('balance').textContent = '—';
  setStatus('Connect your wallet to begin.');
}

async function connect(requestAccounts = true) {
  if (requestAccounts) {
    rawWalletProvider = await chooseWalletProvider();
  } else {
    rawWalletProvider = await restoreWalletProvider();
    if (!rawWalletProvider) {
      setDisconnectedUi(false);
      return;
    }
  }

  provider = new BrowserProvider(rawWalletProvider);
  if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);

  const accounts = await provider.send('eth_accounts', []);
  const address = accounts?.[0];
  if (!address) throw new Error('No wallet account is connected to this site.');

  const chainHex = await provider.send('eth_chainId', []);
  const chainId = Number.parseInt(chainHex, 16);
  setConnectedUi(address);

  if (chainId !== CONFIG.chainId) {
    if (requestAccounts) {
      try {
        await rawWalletProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CONFIG.chainId.toString(16) }]
        });
        provider = new BrowserProvider(rawWalletProvider);
        const switchedHex = await provider.send('eth_chainId', []);
        const switchedId = Number.parseInt(switchedHex, 16);
        if (switchedId !== CONFIG.chainId) throw new Error('Ethereum Mainnet switch did not complete.');
      } catch (e) {
        if (e?.code === 4001) throw new Error('Network switch cancelled in wallet.');
        throw new Error('Please switch your selected wallet to Ethereum Mainnet (chain 1).');
      }
    } else {
      setStatus('Wrong network. Switch to Ethereum Mainnet (chain ' + CONFIG.chainId + ').', 'err');
      $('mineCpu').disabled = true;
      $('mineGpu').disabled = true;
      return;
    }
  }

  signer = await provider.getSigner();
  nft = new Contract(NFT_ADDRESS, NFT_ABI, signer);
  imd = new Contract(IMD_ADDRESS, ERC20_ABI, signer);
  $('mineCpu').disabled = false;
  $('mineGpu').textContent = (await hasWebGPU()) ? '⚡ MINE WITH GPU' : '⚡ GPU / CPU AUTO';
  $('mineGpu').disabled = false;
  await refreshWalletBalance();
  bindSelectedWalletEvents(rawWalletProvider);

  try {
    await refresh();
    setStatus('Wallet connected. Ready to mine.', 'ok');
  } catch (e) {
    console.error('CHAIN_REFRESH_ERROR', e);
    setStatus('Wallet connected, but chain data could not be loaded: ' + (e.shortMessage || e.message || 'unknown error'), 'err');
  }
}

function bindSelectedWalletEvents(selectedProvider) {
  if (!selectedProvider?.on || boundWalletProvider === selectedProvider) return;
  boundWalletProvider = selectedProvider;
  selectedProvider.on('accountsChanged', accounts => {
    if (!accounts?.length) {
      disconnectWalletApp().finally(() => setDisconnectedUi(true));
    } else if (localStorage.getItem(WALLET_DISCONNECTED_KEY) !== '1') {
      connect(false).catch(e => setStatus(e.message || 'Wallet reconnect failed.', 'err'));
    }
  });
  selectedProvider.on('chainChanged', () => {
    if (localStorage.getItem(WALLET_DISCONNECTED_KEY) === '1') return;
    provider = new BrowserProvider(selectedProvider);
    setStatus('Network changed. Reconnecting…');
    connect(false).catch(e => setStatus(e.message || 'Network reconnect failed.', 'err'));
  });
  selectedProvider.on('disconnect', () => {
    disconnectWalletApp().finally(() => setDisconnectedUi(true));
  });
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

function isMobileMiningDevice() {
  const touchNarrow = Number(navigator.maxTouchPoints || 0) > 1 &&
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 900px)').matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || touchNarrow;
}

function getCpuWorkerCount() {
  const cores = Number(navigator.hardwareConcurrency || 2);
  const memory = Number(navigator.deviceMemory || 0);
  if (isMobileMiningDevice()) {
    // Limit phones to 1–2 workers to reduce thermal throttling and battery drain.
    if (memory > 0 && memory <= 4) return 1;
    return Math.max(1, Math.min(2, cores - 1));
  }
  return Math.max(1, Math.min(8, cores - 1));
}

async function mineCpuWorkers(args, work, controller, startedAt) {
  return await new Promise((resolve, reject) => {
    const count = getCpuWorkerCount();
    const workers = [];
    let totalHashes = 0n;
    let settled = false;
    const prefix = Array.from(buildPowInput({...args, nonce:0}));
    const stopAll = () => {
      for (const w of workers) w.terminate();
      controller.signal.removeEventListener('abort', stop);
    };
    const stop = () => {
      if (!settled) {
        settled = true;
        stopAll();
        reject(new Error('MINING_ABORTED'));
      }
    };
    controller.signal.addEventListener('abort', stop, {once:true});
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('./cpu-miner-worker.js', import.meta.url), {type:'module'});
      workers.push(worker);
      worker.onmessage = e => {
        if (e.data.type === 'progress') {
          totalHashes += BigInt(e.data.hashes) - BigInt(worker._lastHashes || 0);
          worker._lastHashes = e.data.hashes;
          const elapsedSec = Math.max(0.001, (performance.now() - startedAt) / 1000);
          setStatus(`${isMobileMiningDevice() ? 'Mobile CPU mining' : 'CPU mining'} · ${count} workers · ${formatCompact(totalHashes)} · ${formatCompact(Number(totalHashes) / elapsedSec)}/s`);
        }
        if (e.data.type === 'solution' && !settled) {
          settled = true;
          stopAll();
          resolve(e.data);
        }
      };
      worker.onerror = e => {
        if (!settled) {
          settled = true;
          stopAll();
          reject(e.error || new Error('CPU_WORKER_ERROR'));
        }
      };
      worker.postMessage({
        type:'start',
        prefixBytes:prefix,
        startNonce:String(i),
        step:String(count),
        difficultyBits:work.difficultyBits,
        seedBlock:work.seedBlock.toString(),
        challenge:work.challenge,
        tokenId:work.tokenId.toString()
      });
    }
  });
}

async function start(kind) {
  if (!nft || !wallet) return;
  controller?.abort();
  const activeController = new AbortController();
  controller = activeController;
  const signal = activeController.signal;
  const miningStartedAt = performance.now();

  $('mineCpu').disabled = true;
  $('mineGpu').disabled = true;
  $('stop').disabled = false;

  try {
    // Keep all setup calls inside the try block. Mobile RPCs can fail intermittently;
    // the UI must recover and re-enable the controls instead of getting stuck.
    await refresh();
    if (signal.aborted) throw new Error('MINING_ABORTED');
    if (!readProvider) readProvider = new JsonRpcProvider(CONFIG.rpcUrl);
    const readNft = new Contract(NFT_ADDRESS, NFT_ABI, readProvider);

    const latestNumber = await readProvider.getBlockNumber();
    if (latestNumber < 1) throw new Error('CHAIN_NOT_READY');
    const seedBlock = latestNumber - 1;
    const seed = await readProvider.getBlock(seedBlock);
    if (!seed?.hash) throw new Error('SEED_BLOCK_UNAVAILABLE');

    const minted = await readNft.totalMinted();
    if (Number(minted) >= 1111) {
      setStatus('Sold out.');
      return;
    }
    const phase = await readNft.currentPhase();
    const [price, difficulty] = await Promise.all([
      readNft.phasePrice(phase),
      readNft.phaseDifficultyBits(phase)
    ]);

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
    setStatus(`${kind.toUpperCase()} mining NFT ${work.tokenId}…`);

    const args = {
      chainId: CONFIG.chainId,
      contractAddress: NFT_ADDRESS,
      challenge: work.challenge,
      seedBlock: work.seedBlock,
      tokenId: work.tokenId,
      wallet,
      difficultyBits: work.difficultyBits
    };

    let result;
    if (kind === 'gpu') {
      let gpuResult = null;
      if (await hasWebGPU()) {
        try {
          gpuResult = await mineGpu({
            ...args,
            signal,
            onProgress: p => setStatus(`GPU mining · ${formatCompact(p.hashes)} · ${formatCompact(Number(p.hashes) / Math.max(0.001, (performance.now() - miningStartedAt) / 1000))}/s`)
          });
        } catch (gpuError) {
          if (signal.aborted || gpuError?.message === 'MINING_ABORTED') throw gpuError;
          console.warn('GPU_MINING_FALLBACK', gpuError);
          setStatus('GPU is unavailable on this device/browser. Falling back to CPU mining…');
        }
      } else {
        setStatus(isMobileMiningDevice()
          ? 'WebGPU is not supported by this mobile browser. Using mobile-safe CPU mining…'
          : 'WebGPU is not available. Using CPU mining…');
      }

      if (gpuResult) {
        const gpuCandidateHash = proofHash({ ...args, nonce: gpuResult.nonce });
        if (validDifficulty(gpuCandidateHash, work.difficultyBits)) {
          result = gpuResult;
        } else {
          console.warn('GPU candidate failed local proof verification; using CPU fallback.');
          setStatus('GPU proof did not pass verification. Restarting with CPU mining…', 'err');
        }
      }

      // This is also the automatic mobile fallback on browsers without WebGPU.
      if (!result) result = await mineCpuWorkers(args, work, activeController, miningStartedAt);
    } else {
      result = await mineCpuWorkers(args, work, activeController, miningStartedAt);
    }

    if (signal.aborted) throw new Error('MINING_ABORTED');

    const recomputedHash = proofHash({ ...args, nonce: result.nonce });
    if (!validDifficulty(recomputedHash, work.difficultyBits)) throw new Error('PROOF_INVALID');

    setStatus('Valid proof found. Confirming on-chain…', 'ok');
    const onchainOk = await readNft.isValidProof(wallet, work.tokenId, work.seedBlock, result.nonce);
    if (!onchainOk) throw new Error('PROOF_REJECTED_ONCHAIN');

    setStatus('Proof accepted by contract. Preparing IMD payment…', 'ok');
    const readImd = new Contract(IMD_ADDRESS, ERC20_ABI, readProvider);
    const balance = await readImd.balanceOf(wallet);
    if (balance < work.price) {
      throw new Error(`Insufficient IMD balance. Need ${formatUnits(work.price, CONFIG.imdDecimals)} IMD.`);
    }

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
    if (signal.aborted || e?.message === 'MINING_ABORTED') {
      setStatus('Mining stopped.');
    } else {
      console.error('MINING_ERROR', e);
      const reason = e?.shortMessage || e?.reason || e?.info?.error?.message || e?.message || 'Mining failed.';
      setStatus(reason, 'err');
    }
  } finally {
    if (controller === activeController) {
      $('mineCpu').disabled = !wallet;
      $('mineGpu').disabled = !wallet;
      $('stop').disabled = true;
    }
  }
}

$('connect').onclick = async () => {
  if (wallet) {
    controller?.abort();
    await disconnectWalletApp();
    setDisconnectedUi(true);
    setStatus('Wallet disconnected from UNKNOWN.');
    return;
  }
  connect(true).catch(e => setStatus(e.message || 'Wallet connection failed.', 'err'));
};
$('mineCpu').onclick = () => start('cpu');
$('mineGpu').onclick = () => start('gpu');
$('stop').onclick = () => { controller?.abort(); $('stop').disabled=true; };

// Wallet events are bound after the selected provider connects.

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

// Wallet IMD balance refreshes automatically while connected.

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
  try {
    const restoredProvider = await restoreWalletProvider();
    if (restoredProvider) await connect(false);
    else setDisconnectedUi(false);
  } catch (e) {
    console.warn('WALLET_RESTORE_ERROR', e);
  }
  window.setInterval(() => {
    refresh().catch(e => console.warn('LIVE_REFRESH_ERROR', e));
    refreshWalletBalance().catch(e => console.warn('IMD_BALANCE_REFRESH_ERROR', e));
  }, 12000);
})();
