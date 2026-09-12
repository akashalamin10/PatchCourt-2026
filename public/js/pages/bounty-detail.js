import { watchAuth, logOut } from "../modules/auth.js";
import { getBounty, statusBadgeClass, statusLabel } from "../modules/bounty.js";
import { watchSubmissionsByBounty, approveSubmission, rejectSubmission, recordDirectVerdict } from "../modules/submission.js";
import { formatReward, shortId } from "../utils/formatters.js";
import { showToast } from "../components/toast.js";
import { mountWalletChip } from "../components/wallet-widget.js";
import { onWalletChange, GENLAYER_EXPLORER_URL } from "../modules/wallet.js";
import { judgeWithWallet, isDirectJudgingConfigured } from "../modules/direct-judge.js";
import { spinnerMarkup } from "../components/spinner.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const logoutBtn = document.getElementById("logoutBtn");
const bountyRepo = document.getElementById("bountyRepo");
const bountyStatusBadge = document.getElementById("bountyStatusBadge");
const bountyIssue = document.getElementById("bountyIssue");
const bountyReward = document.getElementById("bountyReward");
const bountyDeadline = document.getElementById("bountyDeadline");
const bountyCriteria = document.getElementById("bountyCriteria");
const submissionsList = document.getElementById("submissionsList");

const params = new URLSearchParams(window.location.search);
const bountyId = params.get("id");

let currentUid = null;
let currentBounty = null;
let walletAddress = null;

onWalletChange((state) => {
  walletAddress = state.connected ? state.address : null;
  rerenderSubmissions();
});

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

function verdictBadge(entry) {
  if (entry.verdict === "approved") return `<span class="badge badge-settled">Approved</span>`;
  if (entry.verdict === "rejected") return `<span class="badge badge-rejected">Rejected</span>`;
  return `<span class="badge badge-review">${entry.testResult || "pending"}</span>`;
}

function explorerLine(entry) {
  if (!entry.genlayerTxHash) return "";
  const url = `${GENLAYER_EXPLORER_URL}/tx/${entry.genlayerTxHash}`;
  return `<p class="stat-label" style="margin-top:8px;">
    Judged on-chain (${entry.genlayerVerdict || ""}) &middot;
    <a class="explorer-link" href="${url}" target="_blank" rel="noopener">View on GenLayer Explorer &rarr;</a>
  </p>`;
}

function submissionCard(entry, isBuyer) {
  const stillOpen = currentBounty && ["claimed", "under_review"].includes(currentBounty.status);
  const showManual = isBuyer && stillOpen;
  const showDirectJudge = isBuyer && stillOpen && isDirectJudgingConfigured() && walletAddress;

  return `
    <div class="docket" style="margin-bottom:16px;">
      <div class="docket-header">
        <span class="docket-case-id">Submission ${shortId(entry.id)}</span>
        ${verdictBadge(entry)}
      </div>
      <div class="docket-body">
        <div class="docket-repo"><a href="${entry.branchLink}" target="_blank" rel="noopener">${entry.branchLink || "No link provided"}</a></div>
        <p class="docket-issue">${entry.explanation || "No explanation provided."}</p>
        ${explorerLine(entry)}
      </div>
      ${showDirectJudge ? `
        <div class="modal-actions">
          <button type="button" class="auth-submit judge-wallet-btn" data-id="${entry.id}" style="width:auto;padding:10px 20px;">
            &#9889; Judge with wallet (GenLayer)
          </button>
        </div>
      ` : ""}
      ${showManual ? `
        <div class="modal-actions">
          <button type="button" class="btn-secondary reject-btn" data-id="${entry.id}">Reject</button>
          <button type="button" class="auth-submit approve-btn" data-id="${entry.id}" style="width:auto;padding:10px 20px;">Approve &amp; settle</button>
        </div>
      ` : ""}
    </div>
  `;
}

let lastSubmissions = [];

function rerenderSubmissions() {
  if (!currentBounty) return;
  if (lastSubmissions.length === 0) {
    submissionsList.innerHTML = `<div class="empty-state">No patches submitted for this bounty yet.</div>`;
    return;
  }
  const isBuyer = currentBounty.buyerId === currentUid;
  submissionsList.innerHTML = lastSubmissions.map((entry) => submissionCard(entry, isBuyer)).join("");
  wireActions(isBuyer);
}

function wireActions(isBuyer) {
  submissionsList.querySelectorAll(".judge-wallet-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.innerHTML = `${spinnerMarkup("sm")} <span>Waiting for wallet signature...</span>`;
      try {
        const { verdict, txHash } = await judgeWithWallet({
          address: walletAddress,
          bountyId,
          issueDescription: currentBounty.issueDescription,
          acceptanceCriteria: currentBounty.acceptanceCriteria,
          branchLink: button.closest(".docket").querySelector(".docket-repo a").getAttribute("href"),
          explanation: button.closest(".docket").querySelector(".docket-issue").textContent
        });
        await recordDirectVerdict(button.dataset.id, bountyId, verdict, txHash);
        showToast(`GenLayer verdict: ${verdict}`, verdict === "REJECTED" ? "info" : "success");
      } catch (error) {
        showToast(error.message || "Direct judging failed.", "error");
        button.disabled = false;
        button.textContent = "\u26A1 Judge with wallet (GenLayer)";
      }
    });
  });

  if (!isBuyer) return;
  submissionsList.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await approveSubmission(button.dataset.id, bountyId);
        showToast("Submission approved. Bounty marked as settled.", "success");
      } catch (error) {
        showToast("Could not approve this submission.", "error");
        button.disabled = false;
      }
    });
  });
  submissionsList.querySelectorAll(".reject-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await rejectSubmission(button.dataset.id, bountyId);
        showToast("Submission rejected.", "info");
      } catch (error) {
        showToast("Could not reject this submission.", "error");
        button.disabled = false;
      }
    });
  });
}

function renderBounty(bounty) {
  currentBounty = bounty;
  bountyRepo.textContent = bounty.repoUrl || "Untitled repo";
  bountyStatusBadge.className = `badge ${statusBadgeClass[bounty.status] || "badge-open"}`;
  bountyStatusBadge.textContent = statusLabel[bounty.status] || bounty.status;
  bountyIssue.textContent = bounty.issueDescription || "";
  bountyReward.textContent = formatReward(bounty.reward);
  bountyDeadline.textContent = bounty.deadline || "No deadline";
  bountyCriteria.textContent = bounty.acceptanceCriteria || "-";
}

watchAuth(async (user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }
  if (!bountyId) {
    submissionsList.innerHTML = `<div class="empty-state">No bounty selected.</div>`;
    return;
  }

  currentUid = user.uid;

  const bounty = await getBounty(bountyId);
  if (!bounty) {
    bountyRepo.textContent = "Bounty not found";
    return;
  }
  renderBounty(bounty);

  watchSubmissionsByBounty(bountyId, (list) => {
    lastSubmissions = list;
    rerenderSubmissions();
  });
});
