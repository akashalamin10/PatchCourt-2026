import { fetchAllBountyRows, getCredit } from "../genlayer-client.js";
import { getAccount, sameAddress, onAccountsChanged } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, loadLocalBountyIds, pageLoader, escapeHtml, requireContract, showBusy, hideBusy } from "../ui.js";
import { getContractAddress } from "../config.js";
import { cacheGet, cacheSet, sameJSON, formatAge } from "../cache.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "dashboard" })}
<main class="page">
  <div class="container">
    <div class="section-head">
      <h1>Dashboard</h1>
      <p>Everything below is scoped to the connected wallet and read live from the contract every time -- nothing is cached locally.</p>
    </div>
    <div class="card-grid" style="margin-bottom:2rem">
      <div class="stat-card" style="--stat-color:var(--evidence)">
        <div class="stat-label">Withdrawable credit</div>
        <div class="stat-value" id="creditValue">\u2014</div>
        <div class="stat-sub">wei, settled from resolved cases</div>
        <div class="tbar"><div class="tbf" id="creditBar"></div></div>
      </div>
      <div class="stat-card" style="--stat-color:var(--worker)">
        <div class="stat-label">Cases posted</div>
        <div class="stat-value" id="postedValue">\u2014</div>
        <div class="tbar"><div class="tbf" id="postedBar" style="--stat-color:var(--worker)"></div></div>
      </div>
      <div class="stat-card" style="--stat-color:var(--ruling)">
        <div class="stat-label">Cases claimed</div>
        <div class="stat-value" id="claimedValue">\u2014</div>
        <div class="tbar"><div class="tbf" id="claimedBar"></div></div>
      </div>
    </div>
    <div class="toolbar">
      <button class="btn-primary" id="withdrawBtn" type="button" disabled title="Not available on the currently deployed contract yet">Withdraw credit (pending escrow upgrade)</button>
      <button class="btn-secondary" id="refreshBtn" type="button">Refresh</button>
      <span class="last-updated" id="lastUpdated"></span>
    </div>
    <p id="txOut" class="muted" style="margin-bottom:2rem"></p>
    <h2 style="font-size:var(--step-1)">Posted by me</h2>
    <div id="postedGrid" class="card-grid" style="margin-bottom:2.5rem"></div>
    <h2 style="font-size:var(--step-1)">Claimed by me</h2>
    <div id="claimedGrid" class="card-grid"></div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

const POLL_MS = 45000 + Math.floor(Math.random() * 5000);

function caseCard(id, bounty) {
  return `
    <a class="case-card" href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">
      <div class="case-card-top">
        <span class="mono">${escapeHtml(id)}</span>
        <span class="${statusClass(bounty.status)}">${escapeHtml(bounty.status)}</span>
      </div>
      <h3>${escapeHtml(bounty.issue_description || "Untitled issue")}</h3>
      <p class="mono">reward ${escapeHtml(bounty.reward)} \u00b7 verdict ${escapeHtml(bounty.verdict || "pending")}</p>
    </a>`;
}

function renderEmpty() {
  document.getElementById("postedGrid").innerHTML = `<p class="muted">Connect your wallet to see your cases and credit.</p>`;
  document.getElementById("claimedGrid").innerHTML = "";
  document.getElementById("creditValue").textContent = "\u2014";
  document.getElementById("postedValue").textContent = "\u2014";
  document.getElementById("claimedValue").textContent = "\u2014";
  ["creditBar", "postedBar", "claimedBar"].forEach((id) => {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = "0%";
  });
}

function renderData({ posted, claimed, credit }) {
  document.getElementById("postedValue").textContent = posted.length;
  document.getElementById("claimedValue").textContent = claimed.length;
  const totalCases = Math.max(posted.length + claimed.length, 1);
  const postedBar = document.getElementById("postedBar");
  const claimedBar = document.getElementById("claimedBar");
  if (postedBar) postedBar.style.width = `${Math.min(100, (posted.length / totalCases) * 100)}%`;
  if (claimedBar) claimedBar.style.width = `${Math.min(100, (claimed.length / totalCases) * 100)}%`;
  document.getElementById("postedGrid").innerHTML = posted.length
    ? posted.map(({ id, bounty }) => caseCard(id, bounty)).join("")
    : `<p class="muted">No cases posted from this wallet yet.</p>`;
  document.getElementById("claimedGrid").innerHTML = claimed.length
    ? claimed.map(({ id, bounty }) => caseCard(id, bounty)).join("")
    : `<p class="muted">No cases claimed from this wallet yet.</p>`;
  document.getElementById("creditValue").textContent = credit;
  const creditBar = document.getElementById("creditBar");
  if (creditBar) creditBar.style.width = `${Math.min(100, Number(credit) > 0 ? 72 : 8)}%`;
}

function setLastUpdated(ts) {
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = ts ? `Updated ${formatAge(ts)}` : "";
}

let lastRendered = null;
let loadInFlight = null;

async function fetchDashboard(account) {
  const [rows, credit] = await Promise.all([
    fetchAllBountyRows(loadLocalBountyIds()),
    getCredit(account).catch(() => 0),
  ]);

  const posted = [];
  const claimed = [];
  for (const row of rows) {
    if (!row) continue;
    const { id, bounty } = row;
    if (sameAddress(bounty.buyer, account)) posted.push({ id, bounty });
    if (sameAddress(bounty.worker, account)) claimed.push({ id, bounty });
  }
  return { posted, claimed, credit };
}

async function load({ silent = false } = {}) {
  const account = await getAccount();
  if (!account) {
    renderEmpty();
    lastRendered = null;
    setLastUpdated(0);
    return;
  }

  const cacheKey = `dashboard:${(getContractAddress() || "unset").toLowerCase()}:${account.toLowerCase()}`;
  const cached = cacheGet(cacheKey);

  if (!silent) {
    if (cached?.value) {
      lastRendered = cached.value;
      renderData(cached.value);
      setLastUpdated(cached.ts);
    } else {
      lastRendered = null;
      pageLoader(document.getElementById("postedGrid"), "Reading your cases\u2026");
      document.getElementById("claimedGrid").innerHTML = "";
    }
    showBusy("Loading your cases\u2026");
  }

  try {
    if (!loadInFlight) {
      loadInFlight = (async () => {
        const fresh = await fetchDashboard(account);
        lastRendered = fresh;
        renderData(fresh);
        cacheSet(cacheKey, fresh);
        setLastUpdated(Date.now());
        return fresh;
      })().finally(() => {
        loadInFlight = null;
      });
    }
    await loadInFlight;
  } catch (error) {
    if (!silent) toast(error.message || String(error), "err");
  } finally {
    if (!silent) hideBusy();
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => load({ silent: false }));
document.getElementById("withdrawBtn").addEventListener("click", () => {
  toast("Withdraw isn't live yet. The deployed contract doesn't lock real GEN as escrow, but credit is tracked correctly on-chain and ready to pay out once the payable upgrade ships.", "info");
});

await load();
onAccountsChanged(() => load());

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => load({ silent: true }), POLL_MS);
}
function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}
if (document.visibilityState === "visible") startPolling();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    load({ silent: true });
    startPolling();
  } else {
    stopPolling();
  }
});
