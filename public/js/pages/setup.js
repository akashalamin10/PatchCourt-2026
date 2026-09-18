import { NETWORK, getContractAddress, setContractAddress, explorerAddress } from "../config.js";
import { pageShell, pageFooter, wireChrome, toast, showBusy } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "setup" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Setup</h1>
      <p>PatchCourt is a frontend only. It never deploys anything for you. Deploy <code>contracts/patch_court_contract.py</code> yourself on Studio Next, then paste the address below.</p>
    </div>

    <div class="panel" style="margin-bottom:1.5rem">
      <h3 style="font-size:var(--step-0)">Network this app talks to</h3>
      <table class="mono" style="width:100%;font-size:0.82rem;border-collapse:collapse">
        <tbody>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Network</td><td>${NETWORK.name}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Chain ID</td><td>${NETWORK.chainId}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">RPC</td><td>${NETWORK.rpc}</td></tr>
          <tr><td style="padding:0.3rem 0;color:var(--ink-faint)">Explorer</td><td>${NETWORK.explorer}</td></tr>
        </tbody>
      </table>
    </div>

    <form id="addrForm" class="panel" style="margin-bottom:1.5rem">
      <label>Deployed contract address
        <input name="address" id="addrInput" placeholder="Contract address" value="${getContractAddress()}">
      </label>
      <button class="btn-primary" type="submit">Save address</button>
      <p class="muted" style="margin:0;font-size:0.8rem">Stored in this browser's local storage only. Nothing is sent anywhere. Previously working deploy: <code>0x40DA7abd05aAd504Ca9D2Ae95b33C1E1c318e67e</code></p>
    </form>

    <details class="panel steps" open>
      <summary>Deploy steps</summary>
      <ol>
        <li>Get a wallet and Studio Next GEN from the GenLayer faucet.</li>
        <li>Deploy <code>contracts/patch_court_contract.py</code> with the GenLayer CLI or Studio's UI, pointed at <code>${NETWORK.rpc}</code>.</li>
        <li>Paste the deployed address above.</li>
        <li><strong>Before relying on it:</strong> post a tiny bounty, let it settle, then run <em>Withdraw</em> on the Dashboard and confirm the balance actually moved on the explorer. The <code>emit_transfer</code> primitive used by <code>withdraw()</code> is the documented correct pattern for paying an EOA, but it has had networks where the transaction succeeds without moving value. Catch that here, not in your demo video.</li>
        <li>If <code>submit_verdict</code> reverts on a fee error, this deployment isn't gasless. You'll need to pass fee estimation into the write calls (already wired in <code>genlayer-client.js</code>'s <code>attachFees</code>, but confirm the numbers it returns look sane for your deployment).</li>
      </ol>
    </details>

    <details class="panel steps" style="margin-top:1.5rem">
      <summary>Wallet connect options</summary>
      <p class="muted">The connect button detects every wallet extension installed in the browser (MetaMask, Rabby, Coinbase Wallet, and any other EIP-6963 wallet) and lists them with their own icon and name, no setup needed. It also lists other popular wallets by name so people know they're supported, even before they're installed. On mobile with no extension, it offers to open the page inside a wallet app's own in-app browser instead.</p>
      <p class="muted" style="margin-bottom:0">To also offer WalletConnect (lets a mobile wallet connect via QR / deep link without switching browsers), set <code>window.PATCHCOURT_WALLETCONNECT_PROJECT_ID</code> to a free project ID from <a href="https://cloud.walletconnect.com" target="_blank" rel="noopener">cloud.walletconnect.com</a> before <code>config.js</code> loads (e.g. a small inline script in <code>index.html</code>). Left unset, the WalletConnect option is simply hidden.</p>
    </details>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();

document.getElementById("addrForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const address = document.getElementById("addrInput").value.trim();
  setContractAddress(address);
  toast(address ? "Address saved. Loading this contract's bounties\u2026" : "Contract address cleared", "ok");
  showBusy("Switching contract and dropping old local cache\u2026");
  setTimeout(() => location.assign("/pages/bounty-board.html"), 500);
});
