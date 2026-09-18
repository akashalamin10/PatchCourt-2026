import { fetchAllBountyRows } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, loadLocalBountyIds, rememberBountyId, pageLoader, escapeHtml, requireContract, showBusy, hideBusy } from "../ui.js";
import { shortAddr } from "../wallet.js";
import { getContractAddress } from "../config.js";
import { cacheGet, cacheSet, sameJSON, formatAge } from "../cache.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "board" })}
<main class="page">
  <div class="container">
    <div class="section-head">
      <h1>Bounty board</h1>
      <p>Every card here is a record read live from the PatchCourt contract on Studio Next. Open a case to claim it, submit a patch, and trigger validator judgment.</p>
    </div>
    <div class="toolbar">
      <a class="btn-primary" href="/pages/post-bounty.html">Post a bounty</a>
      <button class="btn-secondary" id="refreshBtn" type="button">Reload from chain</button>
      <span class="last-updated" id="lastUpdated"></span>
    </div>
    <div id="grid" class="bounty-table-wrap"></div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

function cacheKey() {
  return `board:${(getContractAddress() || "unset").toLowerCase()}`;
}

const POLL_MS = 45000 + Math.floor(Math.random() * 5000);

function renderCards(grid, cards) {
  if (!cards.length) {
    grid.innerHTML = `<p class="muted">No bounties yet. Post one, or set the contract address on the Setup page.</p>`;
    return;
  }
  grid.innerHTML = `
    <table class="bounty-table">
      <thead>
        <tr>
          <th>Case</th>
          <th>Status</th>
          <th>Issue</th>
          <th>Reward</th>
          <th>Verdict</th>
          <th>Worker</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${cards
          .map(
            ({ id, bounty }) => `
          <tr>
            <td class="mono">${escapeHtml(id)}</td>
            <td><span class="${statusClass(bounty.status)}">${escapeHtml(bounty.status || "unknown")}</span></td>
            <td class="cell-title">${escapeHtml(bounty.issue_description || "Untitled issue")}</td>
            <td class="mono">${escapeHtml(bounty.reward || 0)}</td>
            <td><span class="${statusClass(bounty.verdict)}">${escapeHtml(bounty.verdict || "pending")}</span></td>
            <td class="mono">${escapeHtml(shortAddr(bounty.worker) || "\u2014")}</td>
            <td><a class="btn-open" href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">Open case</a></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <div class="bounty-cards">
      ${cards
        .map(
          ({ id, bounty }) => `
        <a class="case-card" href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">
          <div class="case-card-top">
            <span class="mono">${escapeHtml(id)}</span>
            <span class="${statusClass(bounty.status)}">${escapeHtml(bounty.status || "unknown")}</span>
          </div>
          <h3>${escapeHtml(bounty.issue_description || "Untitled issue")}</h3>
          <p class="mono">reward ${escapeHtml(bounty.reward || 0)} \u00b7 ${escapeHtml(bounty.verdict || "pending")}</p>
        </a>`
        )
        .join("")}
    </div>
  `;
}

function setLastUpdated(ts) {
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = ts ? `Updated ${formatAge(ts)}` : "";
}

let lastRenderedCards = null;
let loadInFlight = null;

async function fetchCards() {
  const cards = await fetchAllBountyRows(loadLocalBountyIds());
  for (const row of cards) rememberBountyId(row.id);
  return cards;
}

async function load({ silent = false } = {}) {
  const grid = document.getElementById("grid");
  const key = cacheKey();
  const cached = cacheGet(key);
  const hasUsableCache = Array.isArray(cached?.value);

  // Never paint a previous contract's list. Cache keys are address-scoped,
  // and Setup wipes storage on change, so a hit here belongs to this address.
  if (!silent) {
    if (hasUsableCache) {
      lastRenderedCards = cached.value;
      renderCards(grid, cached.value);
      setLastUpdated(cached.ts);
    } else {
      lastRenderedCards = null;
      pageLoader(grid, "Loading every bounty on this contract\u2026");
    }
    showBusy("Loading bounty list\u2026");
  }

  try {
    if (!loadInFlight) {
      loadInFlight = (async () => {
        const cards = await fetchCards();
        lastRenderedCards = cards;
        renderCards(grid, cards);
        cacheSet(key, cards);
        setLastUpdated(Date.now());
        return cards;
      })().finally(() => {
        loadInFlight = null;
      });
    }
    await loadInFlight;
  } catch (error) {
    if (!lastRenderedCards?.length) {
      grid.innerHTML = `<p class="muted">${escapeHtml(error.message || String(error))}</p>`;
    }
    if (!silent) toast(error.message || String(error), "err");
  } finally {
    if (!silent) hideBusy();
  }
}

document.getElementById("refreshBtn").addEventListener("click", () => load({ silent: false }));
await load();

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
