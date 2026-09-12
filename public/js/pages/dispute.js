import { watchAuth, getUserProfile, logOut } from "../modules/auth.js";
import { watchBuyerBounties, watchWorkerBounties } from "../modules/bounty.js";
import { createDispute, watchDisputesByUser, disputeStatusBadge, disputeStatusLabel, disputeReasons } from "../modules/dispute.js";
import { shortId } from "../utils/formatters.js";
import { showToast } from "../components/toast.js";
import { mountWalletChip } from "../components/wallet-widget.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const logoutBtn = document.getElementById("logoutBtn");
const disputeBounty = document.getElementById("disputeBounty");
const disputeReason = document.getElementById("disputeReason");
const disputeNotes = document.getElementById("disputeNotes");
const disputeForm = document.getElementById("disputeForm");
const disputeSubmitBtn = document.getElementById("disputeSubmitBtn");
const disputeTableBody = document.getElementById("disputeTableBody");

let currentUid = null;

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

disputeReason.innerHTML = disputeReasons.map((reason) => `<option value="${reason}">${reason}</option>`).join("");

function renderBountyOptions(list) {
  const eligible = list.filter((entry) => ["claimed", "under_review", "settled"].includes(entry.status));
  disputeBounty.innerHTML =
    eligible.length === 0
      ? `<option value="">No eligible bounties</option>`
      : eligible.map((entry) => `<option value="${entry.id}">${shortId(entry.id)} — ${entry.repoUrl || "repo"}</option>`).join("");
}

function renderDisputes(list) {
  if (list.length === 0) {
    disputeTableBody.innerHTML = `<tr><td colspan="3" class="stat-label">No disputes raised.</td></tr>`;
    return;
  }
  disputeTableBody.innerHTML = list
    .map(
      (entry) => `
        <tr>
          <td class="mono">${shortId(entry.bountyId)}</td>
          <td>${entry.reason}</td>
          <td><span class="badge ${disputeStatusBadge[entry.status] || "badge-open"}">${disputeStatusLabel[entry.status] || entry.status}</span></td>
        </tr>
      `
    )
    .join("");
}

disputeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bountyId = disputeBounty.value;
  if (!bountyId) return;

  disputeSubmitBtn.disabled = true;
  disputeSubmitBtn.textContent = "Submitting…";

  try {
    await createDispute(bountyId, currentUid, disputeReason.value, disputeNotes.value.trim());
    showToast("Dispute raised.", "success");
    disputeForm.reset();
  } catch (error) {
    showToast("Could not raise the dispute.", "error");
  } finally {
    disputeSubmitBtn.disabled = false;
    disputeSubmitBtn.textContent = "Raise dispute";
  }
});

watchAuth(async (user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }
  currentUid = user.uid;

  const profile = await getUserProfile(user.uid);
  const role = profile ? profile.role : "buyer";
  const watcher = role === "buyer" ? watchBuyerBounties : watchWorkerBounties;
  watcher(user.uid, renderBountyOptions);

  watchDisputesByUser(user.uid, renderDisputes);
});
