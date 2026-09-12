import { watchAuth, logOut } from "../modules/auth.js";
import { watchWorkerBounties } from "../modules/bounty.js";
import { createSubmission, watchSubmissionsByWorker } from "../modules/submission.js";
import { shortId } from "../utils/formatters.js";
import { showToast } from "../components/toast.js";
import { mountWalletChip } from "../components/wallet-widget.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const logoutBtn = document.getElementById("logoutBtn");
const bountySelect = document.getElementById("bountySelect");
const submitForm = document.getElementById("submitForm");
const submitPatchBtn = document.getElementById("submitPatchBtn");
const branchLink = document.getElementById("branchLink");
const explanation = document.getElementById("explanation");
const submissionTableBody = document.getElementById("submissionTableBody");

const params = new URLSearchParams(window.location.search);
const preselectId = params.get("bounty");

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

let currentUid = null;
let claimedBounties = [];

function renderBountyOptions() {
  const eligible = claimedBounties.filter((entry) => entry.status === "claimed");
  if (eligible.length === 0) {
    bountySelect.innerHTML = `<option value="">No claimed bounties yet</option>`;
    submitPatchBtn.disabled = true;
    return;
  }
  submitPatchBtn.disabled = false;
  bountySelect.innerHTML = eligible
    .map((entry) => `<option value="${entry.id}">${shortId(entry.id)} — ${entry.repoUrl || "repo"}</option>`)
    .join("");
  if (preselectId && eligible.some((entry) => entry.id === preselectId)) {
    bountySelect.value = preselectId;
  }
}

const verdictBadgeClass = {
  approved: "badge-settled",
  rejected: "badge-rejected"
};

function renderSubmissions(list) {
  if (list.length === 0) {
    submissionTableBody.innerHTML = `<tr><td colspan="4" class="stat-label">No submissions yet.</td></tr>`;
    return;
  }
  submissionTableBody.innerHTML = list
    .map(
      (entry) => `
        <tr>
          <td class="mono"><a href="/pages/bounty-detail.html?id=${entry.bountyId}">${shortId(entry.bountyId)}</a></td>
          <td>${(entry.branchLink || "").slice(0, 30)}</td>
          <td><span class="badge ${verdictBadgeClass[entry.verdict] || "badge-review"}">${entry.verdict || entry.testResult || "pending"}</span></td>
          <td class="stat-label">just now</td>
        </tr>
      `
    )
    .join("");
}

submitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const bountyId = bountySelect.value;
  if (!bountyId) return;

  submitPatchBtn.disabled = true;
  submitPatchBtn.textContent = "Submitting…";

  try {
    await createSubmission(bountyId, currentUid, {
      branchLink: branchLink.value.trim(),
      explanation: explanation.value.trim()
    });
    showToast("Patch submitted. Automated check is running.", "success");
    submitForm.reset();
  } catch (error) {
    showToast("Could not submit the patch.", "error");
  } finally {
    submitPatchBtn.disabled = false;
    submitPatchBtn.textContent = "Submit patch";
  }
});

watchAuth((user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }
  currentUid = user.uid;

  watchWorkerBounties(user.uid, (list) => {
    claimedBounties = list;
    renderBountyOptions();
  });

  watchSubmissionsByWorker(user.uid, renderSubmissions);
});
