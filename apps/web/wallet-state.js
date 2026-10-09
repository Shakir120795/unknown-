import { chooseWalletProvider, restoreWalletProvider, disconnectWalletApp } from './wallet-connect.js';

const WALLET_DISCONNECTED_KEY = 'unknown-wallet-app-disconnected';
const connectButtons = [...document.querySelectorAll('.nav-wallet')].filter(button => button.id !== 'connect');
let activeProvider = null;
let boundProvider = null;

function renderWallet(address) {
  for (const button of connectButtons) {
    button.textContent = address ? 'DISCONNECT WALLET' : 'CONNECT WALLET';
    button.classList.toggle('wallet-connected', !!address);
    button.setAttribute('aria-label', address ? 'Disconnect wallet from UNKNOWN' : 'Connect wallet');
  }
}

async function readActiveAddress(provider) {
  if (!provider?.request) return '';
  try {
    const accounts = await provider.request({ method:'eth_accounts' });
    return accounts?.[0] || '';
  } catch {
    return '';
  }
}

function bindProvider(provider) {
  if (!provider?.on || boundProvider === provider) return;
  boundProvider = provider;
  provider.on('accountsChanged', accounts => {
    renderWallet(localStorage.getItem(WALLET_DISCONNECTED_KEY) === '1' ? '' : (accounts?.[0] || ''));
  });
  provider.on('disconnect', () => {
    disconnectWalletApp().finally(() => {
      activeProvider = null;
      renderWallet('');
    });
  });
}

async function syncWallet() {
  try {
    activeProvider = await restoreWalletProvider();
    if (activeProvider) {
      bindProvider(activeProvider);
      renderWallet(await readActiveAddress(activeProvider));
    } else {
      renderWallet('');
    }
  } catch (e) {
    console.warn('WALLET_RESTORE_ERROR', e);
    renderWallet('');
  }
}

async function connectWallet() {
  try {
    activeProvider = await chooseWalletProvider();
    bindProvider(activeProvider);
    renderWallet(await readActiveAddress(activeProvider));
  } catch (e) {
    console.warn('WALLET_CONNECT_ERROR', e);
    if (e?.message && e.message !== 'Wallet connection cancelled.') {
      window.alert(e.message);
    }
  }
}

for (const button of connectButtons) {
  button.addEventListener('click', async event => {
    event.preventDefault();
    const connected = button.classList.contains('wallet-connected');
    if (connected) {
      await disconnectWalletApp();
      activeProvider = null;
      renderWallet('');
      return;
    }
    await connectWallet();
  });
}

syncWallet();
