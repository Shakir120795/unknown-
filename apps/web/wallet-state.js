const connectButtons = [...document.querySelectorAll('.nav-wallet')];
const WALLET_DISCONNECTED_KEY = 'unknown-wallet-app-disconnected';

function shortWallet(address) {
  return address ? 'DISCONNECT WALLET' : 'CONNECT WALLET';
}

function renderWallet(address) {
  for (const button of connectButtons) {
    if (button.tagName === 'BUTTON') button.textContent = shortWallet(address);
    else button.textContent = shortWallet(address);
    button.classList.toggle('wallet-connected', !!address);
  }
}

async function syncWallet() {
  if (!window.ethereum?.request) return;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    renderWallet(localStorage.getItem(WALLET_DISCONNECTED_KEY) === '1' ? '' : (accounts?.[0] || ''));
  } catch {
    renderWallet('');
  }
}

async function connectWallet() {
  if (!window.ethereum?.request) {
    window.location.href = './mint.html';
    return;
  }
  try {
    localStorage.removeItem(WALLET_DISCONNECTED_KEY);
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    renderWallet(accounts?.[0] || '');
  } catch (e) {
    console.warn('WALLET_CONNECT_ERROR', e);
  }
}

for (const button of connectButtons) {
  if (button.id === 'connect') continue;
  button.addEventListener('click', e => {
    if (window.ethereum?.request && localStorage.getItem(WALLET_DISCONNECTED_KEY) !== '1' && button.classList.contains('wallet-connected')) {
      e.preventDefault();
      localStorage.setItem(WALLET_DISCONNECTED_KEY, '1');
      renderWallet('');
      return;
    }
    if (button.tagName === 'A' && button.getAttribute('href') === './mint.html' && window.ethereum?.request) {
      e.preventDefault();
      connectWallet();
    } else if (button.tagName === 'BUTTON') {
      connectWallet();
    }
  });
}

if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', accounts => renderWallet(localStorage.getItem(WALLET_DISCONNECTED_KEY) === '1' ? '' : (accounts?.[0] || '')));
}
syncWallet();
