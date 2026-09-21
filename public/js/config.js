// Network config for GenLayer Studio Next (Consensus v0.6 RC).
// Primary RPC and explorer confirmed against a real deployment and 5
// verified transactions (deploy, post_bounty, claim_bounty, submit_patch,
// submit_verdict -> APPROVED) on explorer-studio-next.genlayer.com.
// studioDevAlt is kept only as a fallback name some SDK builds use
// internally for the same network -- never used as the primary endpoint.
export const NETWORK = {
  name: "GenLayer Studio Next",
  connectName: "studioDevnet",
  chainId: 61997,
  chainIdHex: "0xf22d",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpc: "https://studio-next.genlayer.com/api",
  rpcFallback: "https://studio-dev.genlayer.com/api",
  explorer: "https://explorer-studio-next.genlayer.com",
  explorerFallback: "https://explorer-studio-dev.genlayer.com",
  studioUrl: "https://studio-next.genlayer.com",
};

export const SDK = {
  genlayerJs: "2.0.0-rc.1",
  transactionKit: "0.1.0-rc.2",
};

// Optional: set to a WalletConnect Cloud project ID (https://cloud.walletconnect.com)
// to enable WalletConnect as a connect option for mobile wallets that have no
// in-app browser flow. Left empty, the WalletConnect option is simply hidden
// -- nothing else in the app requires it, since MetaMask/Trust/Coinbase deep
// links already cover the common mobile path.
export const WALLETCONNECT_PROJECT_ID = (window.PATCHCOURT_WALLETCONNECT_PROJECT_ID || "").trim();

export const APP_METADATA = {
  studioChainId: NETWORK.chainId,
  wc: {
    name: "PatchCourt",
    description: "Code-fix bounties judged by GenLayer validator consensus.",
    url: typeof location !== "undefined" ? location.origin : "https://patchcourt.example",
    icons: typeof location !== "undefined" ? [`${location.origin}/assets/images/logo.png`] : [],
  },
};


const DEFAULT_CONTRACT_ADDRESS = "0x591c5abb616De598293EB1C84F923aFc886DdDCF";

const ZERO = "0x0000000000000000000000000000000000000000";
const STORAGE_KEY = "patchcourt.contractAddress";

export function getContractAddress() {
  const stored = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (stored && stored !== ZERO) return stored;
  const baked = (window.PATCHCOURT_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS || "").trim();
  if (baked && baked !== ZERO) return baked;
  return "";
}

function normAddr(value) {
  return String(value || "").trim().toLowerCase();
}

export function setContractAddress(address) {
  const value = (address || "").trim();
  const previous = normAddr(getContractAddress());
  const next = normAddr(value);

  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, value);
  }

  // Changing the Setup address must drop every locally cached board /
  // dashboard payload and remembered case ID. Those entries belong to the
  // previous contract and would otherwise paint as "this address's list".
  if (previous !== next) {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith("patchcourt.cache.") ||
          key === "patchcourt.bountyIds" ||
          key.startsWith("patchcourt.bountyIds.")
        ) {
          doomed.push(key);
        }
      }
      for (const key of doomed) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent("patchcourt:contractChanged", {
          detail: { previous, next: next || "" },
        })
      );
    } catch {
      /* ignore */
    }
  }
}

export function explorerTx(hash) {
  if (!hash) return NETWORK.explorer;
  return `${NETWORK.explorer}/tx/${hash}`;
}

export function explorerAddress(address) {
  if (!address) return NETWORK.explorer;
  return `${NETWORK.explorer}/address/${address}`;
}
