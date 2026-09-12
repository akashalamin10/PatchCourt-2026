import { connectWallet, disconnectWallet, restoreWalletSession, onWalletChange, isWalletAvailable } from "../modules/wallet.js";
import { showToast } from "./toast.js";

function shortAddr(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function mountWalletChip(container) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "wallet-chip";
  button.innerHTML = `<span class="wallet-dot"></span><span class="wallet-chip-label">Connect Wallet</span>`;
  container.appendChild(button);

  function render(state) {
    const label = button.querySelector(".wallet-chip-label");
    if (state.connected && state.address) {
      button.classList.add("connected");
      label.textContent = shortAddr(state.address);
      button.title = "Click to disconnect";
    } else {
      button.classList.remove("connected");
      label.textContent = isWalletAvailable() ? "Connect Wallet" : "No wallet found";
      button.title = isWalletAvailable() ? "Connect a wallet" : "Install MetaMask or a similar wallet";
    }
  }

  onWalletChange(render);
  render({ connected: false, address: null });

  button.addEventListener("click", async () => {
    if (button.classList.contains("connected")) {
      disconnectWallet();
      return;
    }
    try {
      await connectWallet();
    } catch (error) {
      showToast(error.message || "Could not connect wallet.", "error");
    }
  });

  restoreWalletSession().catch(() => {});

  return { render };
}
