// Wallet connect for PatchCourt. Works with ANY browser wallet extension
// that follows the EIP-1193 standard (MetaMask, Rabby, OKX Wallet, Coinbase
// Wallet, Brave Wallet, etc.) — they all inject window.ethereum the same
// way, so one code path covers all of them. No extra library needed.

const DISCONNECT_FLAG = "patchcourt_wallet_disconnected";

// GenLayer Studionet
export const GENLAYER_CHAIN_ID = 61999;
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16)}`;
export const GENLAYER_EXPLORER_URL = "https://genlayer-explorer.vercel.app";
const GENLAYER_NETWORK_PARAMS = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: "GenLayer Studio Network",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: [GENLAYER_EXPLORER_URL]
};

let listenersAttached = false;
const listeners = new Set();

function notify(state) {
  listeners.forEach((fn) => fn(state));
}

export function onWalletChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function isWalletAvailable() {
  return !!getProvider();
}

export async function getConnectedAddress() {
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    return accounts[0] || null;
  } catch (error) {
    return null;
  }
}

async function switchToStudionet(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }]
    });
  } catch (error) {
    if (error && error.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [GENLAYER_NETWORK_PARAMS]
      });
    } else {
      throw error;
    }
  }
}

export async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No wallet extension found. Install MetaMask, Rabby, OKX Wallet, or similar.");
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No account was selected.");
  }

  try {
    await switchToStudionet(provider);
  } catch (error) {
    // Non-fatal: user can still be connected on the wrong network; the
    // direct-judge call will surface a clearer error if it matters.
  }

  localStorage.removeItem(DISCONNECT_FLAG);
  attachListeners();
  notify({ address: accounts[0], connected: true });
  return accounts[0];
}

export function disconnectWallet() {
  localStorage.setItem(DISCONNECT_FLAG, "true");
  notify({ address: null, connected: false });
}

function attachListeners() {
  if (listenersAttached) return;
  const provider = getProvider();
  if (!provider || !provider.on) return;
  listenersAttached = true;

  provider.on("accountsChanged", (accounts) => {
    notify({ address: accounts[0] || null, connected: accounts.length > 0 });
  });
  provider.on("chainChanged", () => {
    // A reload keeps things simple and matches wallet-provider guidance.
    window.location.reload();
  });
}

// Auto-restore a previously connected session on page load, unless the
// user explicitly disconnected.
export async function restoreWalletSession() {
  const provider = getProvider();
  if (!provider) return null;
  if (localStorage.getItem(DISCONNECT_FLAG) === "true") return null;

  const address = await getConnectedAddress();
  if (address) {
    attachListeners();
    notify({ address, connected: true });
  }
  return address;
}
