import { NETWORK } from "./config.js";
import {
  startWalletDiscovery,
  getInjectedWallets,
  getInjectedByRdns,
  getLegacyInjectedWallet,
  getWalletConnectProvider,
  isWalletConnectConfigured,
  isMobile,
  MOBILE_WALLET_APPS,
  WALLET_CATALOG,
  WALLETCONNECT_ICON,
  catalogMatches,
  currentPageUrl,
} from "./wallets.js";
import { openModal, closeModal } from "./fx.js";

const ACCOUNT_KEY = "patchcourt.account";
const WALLET_ID_KEY = "patchcourt.walletId"; // rdns, "walletconnect", or "legacy-injected"
const DISCONNECTED_KEY = "patchcourt.disconnected";

startWalletDiscovery();

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

// Contract addresses come back from GenLayer possibly in a different case
// than what a wallet hands the frontend. Every "is this mine?" comparison
// in the app must go through this helper, not `===`.
export function sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export function getSavedAccount() {
  return localStorage.getItem(ACCOUNT_KEY) || "";
}

function saveAccount(address) {
  if (address) localStorage.setItem(ACCOUNT_KEY, address);
  else localStorage.removeItem(ACCOUNT_KEY);
}

function saveWalletId(id) {
  if (id) localStorage.setItem(WALLET_ID_KEY, id);
  else localStorage.removeItem(WALLET_ID_KEY);
}

function getSavedWalletId() {
  return localStorage.getItem(WALLET_ID_KEY) || "";
}

function sameChain(chainId) {
  if (chainId == null) return false;
  const asHex = Number.parseInt(String(chainId), 16);
  const asDec = Number(chainId);
  return asHex === NETWORK.chainId || asDec === NETWORK.chainId;
}

// --- active session ---------------------------------------------------
// Everything below used to assume `window.ethereum`. It now holds whichever
// EIP-1193 provider the person picked (a specific extension's own provider,
// or the WalletConnect session provider), so every wallet in the list is a
// real, independent connection -- not just whichever extension grabbed the
// global first.
let activeProvider = null;
let activeWalletName = "";

export function getActiveProvider() {
  // After a refresh the picked EIP-6963 provider may not have been
  // reattached yet. Falling back to window.ethereum keeps writes working
  // the same way the last working build did, instead of throwing
  // "No wallet connected" while the header still shows an address.
  return activeProvider || (typeof window !== "undefined" ? window.ethereum : null);
}

export function getActiveWalletName() {
  return activeWalletName;
}

function bindProviderEvents(provider) {
  if (!provider?.on || provider.__patchcourtBound) return;
  provider.__patchcourtBound = true;
  provider.on("accountsChanged", (accounts) => {
    if (provider !== activeProvider) return;
    const address = accounts?.[0] || "";
    saveAccount(address);
    window.dispatchEvent(new CustomEvent("patchcourt:accountsChanged", { detail: address }));
    if (!address) disconnectWallet();
  });
  provider.on("chainChanged", () => {
    if (provider !== activeProvider) return;
    networkChecked = false;
  });
  provider.on("disconnect", () => {
    if (provider !== activeProvider) return;
    disconnectWallet();
  });
}

let networkChecked = false;

export async function ensureStudioNetwork(provider = activeProvider) {
  if (!provider) throw new Error("No wallet connected.");
  if (networkChecked) return;
  const current = await provider.request({ method: "eth_chainId" });
  if (sameChain(current)) {
    networkChecked = true;
    return;
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: NETWORK.chainIdHex }],
    });
    networkChecked = true;
    return;
  } catch (error) {
    const code = error?.code ?? error?.data?.originalError?.code;
    if (code !== 4902 && code !== -32603) throw error;
  }
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: NETWORK.chainIdHex,
        chainName: NETWORK.name,
        nativeCurrency: NETWORK.currency,
        rpcUrls: [NETWORK.rpc],
        blockExplorerUrls: [NETWORK.explorer],
      },
    ],
  });
  networkChecked = true;
}

export function isDisconnected() {
  return localStorage.getItem(DISCONNECTED_KEY) === "1";
}

export function disconnectWallet() {
  const provider = activeProvider;
  activeProvider = null;
  activeWalletName = "";
  networkChecked = false;
  saveAccount("");
  saveWalletId("");
  localStorage.setItem(DISCONNECTED_KEY, "1");
  window.dispatchEvent(new CustomEvent("patchcourt:walletDisconnected"));
  // Also fire this: pages like the dashboard don't listen for
  // "walletDisconnected" directly, only for "accountsChanged" (via
  // onAccountsChanged). Without this, clicking Disconnect updates the
  // header button but leaves the previous wallet's data sitting on screen
  // until the next poll or a manual refresh.
  window.dispatchEvent(new CustomEvent("patchcourt:accountsChanged", { detail: "" }));
  if (provider?.disconnect) {
    try {
      provider.disconnect();
    } catch {
      /* ignore */
    }
  }
}

function finalizeConnection(provider, name, walletId, address) {
  activeProvider = provider;
  activeWalletName = name;
  localStorage.removeItem(DISCONNECTED_KEY);
  saveAccount(address);
  saveWalletId(walletId);
  // Fire this ourselves rather than relying on the provider's own
  // "accountsChanged" event: wallets like MetaMask only emit that when the
  // authorized account actually changes from their point of view. If the
  // user disconnected inside PatchCourt (our own local flag) and then
  // reconnects the same already-authorized account, nothing changes on the
  // wallet's side, so it stays silent -- and pages listening for this event
  // (like the dashboard) would otherwise never know a connection completed.
  window.dispatchEvent(new CustomEvent("patchcourt:accountsChanged", { detail: address }));
}

// IMPORTANT ORDER: request accounts (the actual "turn the wallet on" step)
// BEFORE trying to switch/add the network. Doing it the other way around
// -- as this used to -- makes some wallets (Rabby, Trust, some mobile
// in-app browsers) reject the chain-switch call outright because the site
// has no authorized account yet. That threw before the account was ever
// saved, so the click looked like it did nothing and the person had to
// mash "Connect wallet" repeatedly to get anywhere.
async function activate(entry) {
  const { provider, name, walletId } = entry;
  bindProviderEvents(provider);
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = accounts?.[0];
  if (!address) throw new Error("Wallet returned no account.");
  // A fresh connection might be on a different chain than the last one --
  // never skip the check based on a previous wallet's result.
  networkChecked = false;
  try {
    await ensureStudioNetwork(provider);
  } catch (error) {
    // The wallet DID turn on and grant an account -- that's the connection.
    // Save it so the person isn't dropped back to square one; they can
    // retry the network switch (or do it manually) without re-picking a
    // wallet from scratch.
    finalizeConnection(provider, name, walletId, address);
    throw new Error(
      `Wallet connected, but couldn't switch to ${NETWORK.name} automatically (${error.message || error}). Please switch networks manually in your wallet.`
    );
  }
  finalizeConnection(provider, name, walletId, address);
  return address;
}

function combinedInjectedList() {
  const list = [...getInjectedWallets()];
  const legacy = getLegacyInjectedWallet();
  if (legacy) list.push(legacy);
  return list.map((w) => ({ walletId: w.info.rdns, name: w.info.name, icon: w.info.icon, provider: w.provider }));
}

// --- connect flow: always shows every real wallet option, icon + name -
let connectInFlight = null;

export async function connectWallet() {
  if (connectInFlight) return connectInFlight;
  connectInFlight = (async () => {
    const injectedList = combinedInjectedList();
    const options = injectedList.map((w) => ({
      walletId: w.walletId,
      name: w.name,
      icon: w.icon,
      kind: "injected",
      async run() {
        return activate(w);
      },
    }));

    const runWalletConnect = async () => {
      const provider = await getWalletConnectProvider();
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("Wallet returned no account.");
      return activate({ provider, name: "WalletConnect", walletId: "walletconnect" });
    };

    if (isWalletConnectConfigured()) {
      options.push({
        walletId: "walletconnect",
        name: "WalletConnect",
        icon: WALLETCONNECT_ICON,
        kind: "walletconnect",
        run: runWalletConnect,
      });
    }

    // Names already represented as a real, connectable option above -- the
    // catalog below must never duplicate one of these as a second, dead entry.
    const represented = new Set(options.map((o) => o.name));

    if (isMobile() && !injectedList.length) {
      // On mobile with nothing injected, offer to jump into a wallet app's
      // own browser alongside WalletConnect, rather than a dead-end list.
      // These three links are verified against each wallet's own docs.
      for (const app of MOBILE_WALLET_APPS) {
        options.push({
          walletId: `app-${app.id}`,
          name: `${app.name} (open app)`,
          icon: app.icon,
          kind: "deeplink",
          async run() {
            location.href = app.open(currentPageUrl());
            throw new Error(`Opening ${app.name}\u2026 if nothing happens, install the app first.`);
          },
        });
        represented.add(app.name);
      }
    }

    options.push({ divider: "More wallets" });

    // The rest of the catalog: shown by real name and a brand-colored icon
    // even when not installed, so the list always reads as a full wallet
    // picker rather than "whatever happens to be present." Nothing here ever
    // navigates to a guessed URL -- either WalletConnect's own verified flow
    // handles the connection, or the person is told to install it themselves,
    // since a wrong guess at an install link is worse than no link at all.
    for (const entry of WALLET_CATALOG) {
      if (represented.has(entry.name)) continue;
      if ([...represented].some((name) => catalogMatches(entry, name))) continue;
      options.push({
        walletId: `catalog-${entry.id}`,
        name: entry.name,
        icon: entry.icon,
        kind: "catalog",
        async run() {
          if (isWalletConnectConfigured()) return runWalletConnect();
          throw new Error(`${entry.name} isn't detected in this browser. Search "${entry.name}" to install it, then reload this page.`);
        },
      });
    }

    return await pickWallet(options);
  })();
  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

function pickWallet(options) {
  // Always show the picker, even for a single detected wallet -- so every
  // connect attempt shows that wallet's real icon and name before it's used,
  // rather than silently auto-connecting to whichever one happened to exist.
  return new Promise((resolve, reject) => {
    const listHtml = options
      .map((opt, i) =>
        opt.divider
          ? `<div class="wallet-option-divider">${opt.divider}</div>`
          : `
      <button type="button" class="wallet-option" data-idx="${i}">
        <img src="${opt.icon}" alt="" width="28" height="28">
        <span>${opt.name}</span>
      </button>`
      )
      .join("");
    openModal({
      kicker: "CONNECT WALLET",
      title: "Choose a wallet",
      body: "Every wallet detected in this browser, plus any remote option this deployment has enabled.",
      extraHtml: `<div class="wallet-option-list">${listHtml}</div>`,
      confirmLabel: "",
      cancelLabel: "Cancel",
      onConfirm: null,
    });
    const container = document.getElementById("modalExtra");
    let settled = false;
    container?.querySelectorAll(".wallet-option").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (settled) return;
        const opt = options[Number(btn.dataset.idx)];
        btn.disabled = true;
        btn.classList.add("is-connecting");
        try {
          const address = await opt.run();
          settled = true;
          closeModal();
          resolve(address);
        } catch (error) {
          settled = true;
          closeModal();
          reject(error);
        }
      });
    });
    const overlay = document.getElementById("modal-overlay");
    const onClose = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Wallet connection cancelled."));
    };
    overlay?.querySelector("[data-modal-close]")?.addEventListener("click", onClose, { once: true });
    document.getElementById("modalActions")?.querySelector("button")?.addEventListener("click", onClose, { once: true });
  });
}

export async function switchAccount() {
  if (!activeProvider) throw new Error("No wallet connected.");
  await activeProvider.request({
    method: "wallet_requestPermissions",
    params: [{ eth_accounts: {} }],
  });
  const accounts = await activeProvider.request({ method: "eth_accounts" });
  const address = accounts?.[0];
  if (!address) throw new Error("No account selected.");
  localStorage.removeItem(DISCONNECTED_KEY);
  saveAccount(address);
  window.dispatchEvent(new CustomEvent("patchcourt:accountsChanged", { detail: address }));
  return address;
}

// Best-effort silent restore: if the previously used wallet is still
// injected and still authorized, reattach to it without a popup.
let restorePromise = null;
async function restoreSession() {
  if (restorePromise) return restorePromise;
  restorePromise = (async () => {
    if (isDisconnected()) return "";
    const walletId = getSavedWalletId();
    if (walletId === "walletconnect") {
      // WalletConnect keeps its own session in its storage; re-init the
      // provider (cheap if already paired) and reattach it so writes still
      // work after a page navigation, instead of just showing the address
      // with no live provider behind it.
      if (isWalletConnectConfigured()) {
        try {
          const provider = await getWalletConnectProvider();
          const accounts = provider.accounts?.length ? provider.accounts : await provider.request({ method: "eth_accounts" });
          if (accounts?.[0]) {
            bindProviderEvents(provider);
            activeProvider = provider;
            activeWalletName = "WalletConnect";
            saveAccount(accounts[0]);
            return accounts[0];
          }
        } catch {
          /* fall through to saved value */
        }
      }
      return getSavedAccount();
    }
    if (!walletId) return getSavedAccount();
    // Injected wallets can take a tick to announce after navigation.
    for (let attempt = 0; attempt < 5 && !activeProvider; attempt++) {
      const entry = getInjectedByRdns(walletId) || (walletId === "legacy-injected" ? getLegacyInjectedWallet() : null);
      if (entry) {
        try {
          bindProviderEvents(entry.provider);
          const accounts = await entry.provider.request({ method: "eth_accounts" });
          if (accounts?.[0]) {
            activeProvider = entry.provider;
            activeWalletName = entry.info.name;
            saveAccount(accounts[0]);
            return accounts[0];
          }
        } catch {
          /* ignore, fall through to saved value */
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!activeProvider && typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts?.[0]) {
          bindProviderEvents(window.ethereum);
          activeProvider = window.ethereum;
          if (!activeWalletName) activeWalletName = "Injected";
          saveAccount(accounts[0]);
          return accounts[0];
        }
      } catch {
        /* ignore */
      }
    }
    return getSavedAccount();
  })();
  return restorePromise;
}

export async function getAccount() {
  if (isDisconnected()) return "";
  if (activeProvider) {
    try {
      const accounts = await activeProvider.request({ method: "eth_accounts" });
      if (accounts?.[0]) {
        saveAccount(accounts[0]);
        return accounts[0];
      }
    } catch {
      /* ignore */
    }
  }
  return restoreSession();
}

export function onAccountsChanged(handler) {
  window.addEventListener("patchcourt:accountsChanged", (event) => handler(event.detail || ""));
}
