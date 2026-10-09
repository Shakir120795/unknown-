const SOURCE_KEY = 'unknown-wallet-source';
const DISCONNECTED_KEY = 'unknown-wallet-app-disconnected';
let walletConnectProvider = null;

const CONFIG = () => window.UNKNOWN_CONFIG || {};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function providerLabel(provider, fallback='Browser wallet') {
  if (provider?.isMetaMask) return 'MetaMask';
  if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider?.isBraveWallet) return 'Brave Wallet';
  if (provider?.isRabby) return 'Rabby Wallet';
  if (provider?.isTrust) return 'Trust Wallet';
  return fallback;
}

export async function discoverInjectedWallets() {
  const found = [];
  const seen = new Set();

  const add = (provider, name, key) => {
    if (!provider?.request || seen.has(provider)) return;
    seen.add(provider);
    found.push({ type:'injected', provider, name, key });
  };

  const onAnnounce = event => {
    const detail = event.detail;
    if (!detail?.provider?.request) return;
    const name = detail.info?.name || 'Browser wallet';
    const stable = detail.info?.rdns || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    add(detail.provider, name, 'injected:' + stable);
  };

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await wait(250);
  window.removeEventListener('eip6963:announceProvider', onAnnounce);

  const injected = window.ethereum;
  if (Array.isArray(injected?.providers)) {
    injected.providers.forEach(p => {
      const name = providerLabel(p);
      const key = 'injected:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      add(p, name, key);
    });
  }
  if (injected?.request) add(injected, providerLabel(injected), 'injected:default');

  return found;
}

function showWalletPicker(wallets) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'wallet-picker-overlay';
    overlay.setAttribute('role', 'presentation');

    const dialog = document.createElement('section');
    dialog.className = 'wallet-picker';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'wallet-picker-title');

    const heading = document.createElement('h2');
    heading.id = 'wallet-picker-title';
    heading.textContent = 'Connect a wallet';
    const intro = document.createElement('p');
    intro.textContent = 'Choose your preferred wallet. Mobile users can connect through WalletConnect.';
    const list = document.createElement('div');
    list.className = 'wallet-picker-options';

    const finish = choice => {
      overlay.remove();
      resolve(choice);
    };

    for (const wallet of wallets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wallet-choice';
      button.textContent = wallet.name;
      button.addEventListener('click', () => finish(wallet));
      list.append(button);
    }

    const wc = document.createElement('button');
    wc.type = 'button';
    wc.className = 'wallet-choice wallet-choice-featured';
    wc.textContent = 'WalletConnect · Mobile / QR';
    wc.addEventListener('click', () => finish({ type:'walletconnect', name:'WalletConnect' }));
    list.append(wc);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'wallet-picker-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => finish(null));

    overlay.addEventListener('click', event => {
      if (event.target === overlay) finish(null);
    });
    dialog.append(heading, intro, list, cancel);
    overlay.append(dialog);
    document.body.append(overlay);
    cancel.focus();
  });
}

async function makeWalletConnectProvider() {
  if (walletConnectProvider) return walletConnectProvider;

  const cfg = CONFIG();
  const projectId = cfg.walletConnectProjectId || localStorage.getItem('unknown-walletconnect-project-id');
  if (!projectId) {
    throw new Error('Mobile WalletConnect setup is pending: add a Reown Project ID to apps/web/config.js.');
  }

  // Load WalletConnect only when the user chooses it; injected wallet users don't need this download.
  const module = await import(/* @vite-ignore */ 'https://esm.sh/@walletconnect/ethereum-provider@2.26.0?bundle');
  const EthereumProvider = module.EthereumProvider || module.default?.EthereumProvider || module.default;
  if (!EthereumProvider?.init) throw new Error('WalletConnect provider could not be loaded. Please try again.');

  walletConnectProvider = await EthereumProvider.init({
    projectId,
    optionalChains: [1],
    showQrModal: true,
    methods: [
      'eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4',
      'eth_call', 'eth_estimateGas', 'eth_getBalance', 'eth_getTransactionCount',
      'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_chainId', 'wallet_switchEthereumChain'
    ],
    events: ['chainChanged', 'accountsChanged'],
    rpcMap: { 1: cfg.rpcUrl || 'https://ethereum-rpc.publicnode.com' },
    metadata: {
      name: 'UNKNOWN',
      description: 'UNKNOWN — proof-of-work NFT collection',
      url: window.location.origin,
      icons: []
    }
  });
  return walletConnectProvider;
}

export async function chooseWalletProvider() {
  const wallets = await discoverInjectedWallets();
  const choice = await showWalletPicker(wallets);
  if (!choice) throw new Error('Wallet connection cancelled.');

  localStorage.removeItem(DISCONNECTED_KEY);
  if (choice.type === 'injected') {
    await choice.provider.request({ method:'eth_requestAccounts' });
    localStorage.setItem(SOURCE_KEY, choice.key);
    return choice.provider;
  }

  const provider = await makeWalletConnectProvider();
  await provider.connect();
  const accounts = await provider.request({ method:'eth_accounts' });
  if (!accounts?.length) throw new Error('WalletConnect completed without an account. Please try again.');
  localStorage.setItem(SOURCE_KEY, 'walletconnect');
  return provider;
}

export async function restoreWalletProvider() {
  if (localStorage.getItem(DISCONNECTED_KEY) === '1') return null;
  const source = localStorage.getItem(SOURCE_KEY);

  try {
    if (source === 'walletconnect') {
      const provider = await makeWalletConnectProvider();
      const accounts = await provider.request({ method:'eth_accounts' });
      return accounts?.length ? provider : null;
    }

    const wallets = await discoverInjectedWallets();
    let selected = source ? wallets.find(item => item.key === source) : null;
    if (!selected && !source) selected = wallets.find(item => item.key === 'injected:default') || wallets[0];
    if (selected) {
      const accounts = await selected.provider.request({ method:'eth_accounts' });
      if (accounts?.length) {
        localStorage.setItem(SOURCE_KEY, selected.key);
        return selected.provider;
      }
    }
  } catch (error) {
    console.warn('WALLET_RESTORE_ERROR', error);
  }
  return null;
}

export async function disconnectWalletApp() {
  localStorage.setItem(DISCONNECTED_KEY, '1');
  const source = localStorage.getItem(SOURCE_KEY);
  if (source === 'walletconnect' && walletConnectProvider) {
    try { await walletConnectProvider.disconnect(); } catch (error) { console.warn('WALLET_DISCONNECT_ERROR', error); }
  }
}

export function clearWalletDisconnectFlag() {
  localStorage.removeItem(DISCONNECTED_KEY);
}

export function currentWalletSource() {
  return localStorage.getItem(SOURCE_KEY) || '';
}
