import { watchAuth, getUserProfile, logOut } from "../modules/auth.js";
import { watchBuyerBounties, watchWorkerBounties, statusBadgeClass, statusLabel } from "../modules/bounty.js";
import { shortId, formatReward, formatPercent } from "../utils/formatters.js";
import { mountWalletChip } from "../components/wallet-widget.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const roleBadge = document.getElementById("roleBadge");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const statGrid = document.getElementById("statGrid");
const tablePanelTitle = document.getElementById("tablePanelTitle");
const primaryActionBtn = document.getElementById("primaryActionBtn");
const bountyTable = document.getElementById("bountyTable");
const bountyTableBody = document.getElementById("bountyTableBody");
const repFixRate = document.getElementById("repFixRate");
const repDisputeRate = document.getElementById("repDisputeRate");
const repTurnaround = document.getElementById("repTurnaround");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

function statCard(value, label) {
  return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function renderStats(role, bounties) {
  if (role === "buyer") {
    const open = bounties.filter((entry) => entry.status === "open").length;
    const claimed = bounties.filter((entry) => entry.status === "claimed").length;
    const settled = bounties.filter((entry) => entry.status === "settled").length;
    const rejected = bounties.filter((entry) => entry.status === "rejected").length;
    statGrid.innerHTML =
      statCard(open, "Open bounties") +
      statCard(claimed, "Being worked on") +
      statCard(settled, "Settled") +
      statCard(rejected, "Disputed");
  } else {
    const claimed = bounties.length;
    const settled = bounties.filter((entry) => entry.status === "settled").length;
    const pending = bounties.filter((entry) => entry.status === "claimed").length;
    statGrid.innerHTML =
      statCard(claimed, "Claimed") +
      statCard(pending, "In progress") +
      statCard(settled, "Settled") +
      statCard("—", "Genuine-fix rate");
  }
}

function renderTable(bounties, role) {
  const existingEmpty = document.getElementById("emptyState");
  if (existingEmpty) existingEmpty.remove();

  if (bounties.length === 0) {
    bountyTable.style.display = "none";
    const emptyWrap = document.createElement("div");
    emptyWrap.className = "empty-state";
    emptyWrap.id = "emptyState";
    emptyWrap.innerHTML =
      role === "buyer"
        ? "No bounties posted yet.<br><a href='/pages/bounty-board.html' class='btn-primary'>Post your first bounty</a>"
        : "No bounties claimed yet.<br><a href='/pages/bounty-board.html' class='btn-primary'>Browse open bounties</a>";
    bountyTable.parentElement.appendChild(emptyWrap);
    return;
  }

  bountyTable.style.display = "table";
  bountyTableBody.innerHTML = bounties
    .slice(0, 8)
    .map(
      (entry) => `
        <tr class="clickable-row" data-id="${entry.id}">
          <td class="mono">${shortId(entry.id)}</td>
          <td>${entry.repoUrl || "—"}</td>
          <td>${formatReward(entry.reward)}</td>
          <td><span class="badge ${statusBadgeClass[entry.status] || "badge-open"}">${statusLabel[entry.status] || entry.status}</span></td>
        </tr>
      `
    )
    .join("");

  bountyTableBody.querySelectorAll(".clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = `/pages/bounty-detail.html?id=${row.dataset.id}`;
    });
  });
}

watchAuth(async (user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }

  const profile = await getUserProfile(user.uid);
  const role = profile ? profile.role : "buyer";
  const name = (profile && profile.name) || user.displayName || user.email || "there";

  userName.textContent = name;
  userAvatar.textContent = name.charAt(0).toUpperCase();
  roleBadge.textContent = role === "buyer" ? "Buyer" : "Worker";
  tablePanelTitle.textContent = role === "buyer" ? "Your bounties" : "Your claims";
  primaryActionBtn.textContent = role === "buyer" ? "Post a bounty" : "Browse bounties";
  primaryActionBtn.href = "/pages/bounty-board.html";

  if (profile && profile.reputation) {
    repFixRate.textContent = formatPercent(profile.reputation.genuineFixRate);
    repDisputeRate.textContent = formatPercent(profile.reputation.disputeRate);
    repTurnaround.textContent = profile.reputation.avgTurnaround ? `${profile.reputation.avgTurnaround}h` : "—";
  }

  const watcher = role === "buyer" ? watchBuyerBounties : watchWorkerBounties;
  watcher(user.uid, (bounties) => {
    renderStats(role, bounties);
    renderTable(bounties, role);
  });
});
