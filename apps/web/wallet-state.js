const connectButtons = [...document.querySelectorAll('.nav-wallet')];

function shortWallet(address) {
  return address ? address.slice(0, 6) + '…' + address.slice(-4) : 'CONNECT WALLET';
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
    renderWallet(accounts?.[0] || '');
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
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    renderWallet(accounts?.[0] || '');
  } catch (e) {
    console.warn('WALLET_CONNECT_ERROR', e);
  }
}

for (const button of connectButtons) {
  if (button.id === 'connect') continue;
  button.addEventListener('click', e => {
    if (button.tagName === 'A' && button.getAttribute('href') === './mint.html' && window.ethereum?.request) {
      e.preventDefault();
      connectWallet();
    } else if (button.tagName === 'BUTTON') {
      connectWallet();
    }
  });
}

if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', accounts => renderWallet(accounts?.[0] || ''));
}
syncWallet();
