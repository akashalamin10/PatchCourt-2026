import { watchAuth, getUserProfile, logOut } from "../modules/auth.js";
import { watchOpenBounties, createBounty, claimBounty } from "../modules/bounty.js";
import { formatReward } from "../utils/formatters.js";
import { openModal, closeModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { mountWalletChip } from "../components/wallet-widget.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const logoutBtn = document.getElementById("logoutBtn");
const postBountyBtn = document.getElementById("postBountyBtn");
const bountyGrid = document.getElementById("bountyGrid");

let currentUid = null;
let currentRole = "buyer";

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

function bountyCard(entry) {
  const isMine = entry.buyerId === currentUid;
  const actionButton =
    currentRole === "worker" && entry.status === "open"
      ? `<button class="btn-secondary claim-btn" data-id="${entry.id}">Claim</button>`
      : isMine
      ? `<a href="/pages/bounty-detail.html?id=${entry.id}" class="btn-secondary" style="padding:6px 14px;font-size:0.82rem;">View</a>`
      : `<span class="badge badge-open">Open</span>`;

  return `
    <div class="bounty-card">
      <span class="reward-tag">${formatReward(entry.reward)}</span>
      <h3>${entry.repoUrl || "Untitled repo"}</h3>
      <p>${(entry.issueDescription || "").slice(0, 110)}</p>
      <div class="card-footer">
        <span class="stat-label">${entry.deadline || "No deadline"}</span>
        ${actionButton}
      </div>
    </div>
  `;
}

function renderBounties(list) {
  if (list.length === 0) {
    bountyGrid.innerHTML = `<div class="empty-state">No open bounties right now.</div>`;
    return;
  }
  bountyGrid.innerHTML = list.map(bountyCard).join("");

  bountyGrid.querySelectorAll(".claim-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Claiming…";
      try {
        await claimBounty(button.dataset.id, currentUid);
        showToast("Bounty claimed. Head to My submissions to send a patch.", "success");
      } catch (error) {
        showToast("Could not claim this bounty.", "error");
        button.disabled = false;
        button.textContent = "Claim";
      }
    });
  });
}

function postBountyForm() {
  return `
    <h2>Post a bounty</h2>
    <form id="postBountyForm" novalidate>
      <div class="form-group">
        <label for="repoUrl">Repository</label>
        <input type="text" id="repoUrl" placeholder="owner/repo" required>
      </div>
      <div class="form-group">
        <label for="issueDescription">Issue description</label>
        <textarea id="issueDescription" rows="3" required></textarea>
      </div>
      <div class="form-group">
        <label for="reward">Reward (USD)</label>
        <input type="number" id="reward" min="1" required>
      </div>
      <div class="form-group">
        <label for="deadline">Deadline</label>
        <input type="text" id="deadline" placeholder="e.g. 3 hours, 2 days">
      </div>
      <div class="form-group">
        <label for="acceptanceCriteria">Acceptance criteria</label>
        <textarea id="acceptanceCriteria" rows="2" required></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="cancelPost">Cancel</button>
        <button type="submit" class="auth-submit" id="postSubmitBtn">Post bounty</button>
      </div>
    </form>
  `;
}

postBountyBtn.addEventListener("click", () => {
  const overlay = openModal(postBountyForm());
  overlay.querySelector("#cancelPost").addEventListener("click", closeModal);
  overlay.querySelector("#postBountyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = overlay.querySelector("#postSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";
    try {
      await createBounty(currentUid, {
        repoUrl: overlay.querySelector("#repoUrl").value.trim(),
        issueDescription: overlay.querySelector("#issueDescription").value.trim(),
        reward: Number(overlay.querySelector("#reward").value),
        deadline: overlay.querySelector("#deadline").value.trim(),
        acceptanceCriteria: overlay.querySelector("#acceptanceCriteria").value.trim()
      });
      showToast("Bounty posted.", "success");
      closeModal();
    } catch (error) {
      showToast("Could not post the bounty.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Post bounty";
    }
  });
});

watchAuth(async (user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }

  currentUid = user.uid;
  const profile = await getUserProfile(user.uid);
  currentRole = profile ? profile.role : "buyer";

  if (currentRole === "buyer") {
    postBountyBtn.style.display = "inline-flex";
  }

  watchOpenBounties(renderBounties);
});
