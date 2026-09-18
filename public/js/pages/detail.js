import { explorerTx } from "../config.js";
import { getBounty, writeContract } from "../genlayer-client.js";
import { shortAddr, getAccount, sameAddress, onAccountsChanged } from "../wallet.js";
import { pageShell, pageFooter, wireChrome, toast, statusClass, rememberBountyId, loadLocalBountyIds, withSpinner, pageLoader, escapeHtml, requireWallet, requireContract, showBusy, hideBusy } from "../ui.js";
import { flashReward, playVerdict, openModal } from "../fx.js";

function readBountyId() {
  const params = new URLSearchParams(location.search);
  const fromQuery = (params.get("id") || params.get("bounty") || "").trim();
  if (fromQuery) return fromQuery;
  const hash = (location.hash || "").replace(/^#/, "").trim();
  if (hash) return decodeURIComponent(hash);
  const saved = loadLocalBountyIds();
  if (saved.length) return saved[0];
  return "";
}

const arrivedWithId = Boolean(readBountyId());
let bountyId = readBountyId();
let currentAccount = "";

document.getElementById("app").innerHTML = `
${pageShell({ active: "board" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Case docket</h1>
      <p class="mono" id="caseId">${bountyId || "missing id"}</p>
    </div>
    <details class="panel steps" ${arrivedWithId ? "" : "open"}>
      <summary>${arrivedWithId ? "Search another case" : "Enter a case ID"}</summary>
      <div class="toolbar wrap" style="margin-top:12px">
        <input id="idInput" class="field" value="${escapeHtml(bountyId)}" placeholder="Case ID" style="min-width:220px">
        <button class="btn-secondary" id="loadBtn" type="button">Load case</button>
      </div>
    </details>
    <div id="docket" class="panel" style="margin-top:1.5rem"></div>
    <div class="stepper" id="stepper"></div>
    <div class="toolbar wrap" id="disputeRow" style="display:none">
      <button class="btn-secondary" id="disputeBtn" type="button">Raise dispute</button>
      <span class="step-note">Only available after a verdict has been written.</span>
    </div>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

function setId(next) {
  bountyId = String(next || "").trim();
  const label = document.getElementById("caseId");
  const input = document.getElementById("idInput");
  if (label) label.textContent = bountyId || "missing id";
  if (input) input.value = bountyId;
  if (bountyId) rememberBountyId(bountyId);
}

async function withWallet(fn) {
  const account = await requireWallet("You need a connected wallet to sign this transaction.");
  return fn(account);
}

function stepRow({ num, title, state, note, actionHtml }) {
  return `
    <div class="step-row step-${state}">
      <div class="step-num">${state === "done" ? "\u2713" : num}</div>
      <div class="step-body">
        <h4>${title}</h4>
        ${note ? `<div class="step-note ${num === 3 ? "step-hint" : ""}">${note}</div>` : ""}
      </div>
      <div>${actionHtml || ""}</div>
    </div>`;
}

function renderStepper(bounty) {
  const stepper = document.getElementById("stepper");
  const disputeRow = document.getElementById("disputeRow");
  const status = bounty.status || "open";
  const hasPatch = Boolean(bounty.diff_text);
  const hasVerdict = Boolean(bounty.verdict) && status !== "disputed";

  const claimState = status === "open" ? "active" : "done";
  const claimNote =
    status === "open" ? "Any wallet except the buyer can claim this case." : `Claimed by ${escapeHtml(shortAddr(bounty.worker) || "\u2014")}`;
  const claimAction = status === "open" ? `<button class="btn-primary" id="claimBtn" type="button">Claim bounty</button>` : "";

  const patchState = status === "open" ? "locked" : hasPatch ? "done" : "active";
  const isWorker = Boolean(currentAccount) && sameAddress(bounty.worker, currentAccount);
  const isFinal = status === "settled" || status === "rejected";
  // Only the assigned worker can actually submit here -- the contract
  // rejects anyone else's transaction -- and once a verdict is in, patching
  // again would only be reachable through "Raise dispute" first, not a
  // plain resubmit. Showing the button to everyone at every status just
  // invites failed transactions and makes a finished case look reopenable.
  const canAct = isWorker && !isFinal;
  const patchNote = status === "open"
    ? "Unlocks once the bounty is claimed."
    : hasPatch
      ? isFinal
        ? "Patch, explanation, and test log are stored on-chain (see below). This case already has a verdict."
        : "Patch, explanation, and test log are stored on-chain (see below)."
      : isWorker
        ? "Submit your patch below."
        : "Only the assigned worker can submit here.";
  const patchAction = canAct
    ? `<a class="btn-secondary" href="/pages/submit-patch.html?id=${encodeURIComponent(bountyId)}">${hasPatch ? "Resubmit patch" : "Submit patch"}</a>`
    : "";

  const judgeState = !hasPatch ? "locked" : hasVerdict ? "done" : "active";
  const judgeNote = !hasPatch
    ? "Unlocks once a patch is submitted."
    : hasVerdict
      ? `Verdict: ${escapeHtml(bounty.verdict)}. Independent validators decided this, not the caller.`
      : "Anyone can trigger this step. The verdict itself is decided by independent AI validators, not by whoever clicks the button.";
  const judgeAction = hasPatch && !hasVerdict ? `<button class="btn-primary" id="judgeBtn" type="button">Judge with GenLayer</button>` : "";

  stepper.innerHTML =
    stepRow({ num: 1, title: "Claim bounty", state: claimState, note: claimNote, actionHtml: claimAction }) +
    stepRow({ num: 2, title: "Submit patch", state: patchState, note: patchNote, actionHtml: patchAction }) +
    stepRow({ num: 3, title: "Judge with GenLayer", state: judgeState, note: judgeNote, actionHtml: judgeAction });

  disputeRow.style.display = status === "settled" || status === "rejected" ? "flex" : "none";

  document.getElementById("claimBtn")?.addEventListener("click", async (event) => {
    await withSpinner(event.currentTarget, async () => {
      try {
        await withWallet(async (account) => {
          toast("Confirm claim_bounty\u2026");
          const { hash } = await writeContract("claim_bounty", [bountyId], account);
          document.getElementById("txOut").innerHTML = `Claimed. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
        });
        flashReward();
        await render();
        toast("Claimed", "ok");
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  });

  document.getElementById("judgeBtn")?.addEventListener("click", async (event) => {
    await withSpinner(event.currentTarget, async () => {
      try {
        await withWallet(async (account) => {
          toast("Validators are reading the diff. Keep this tab open.");
          const { hash } = await writeContract("submit_verdict", [bountyId], account);
          document.getElementById("txOut").innerHTML = `Judged. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
        });
        const judged = await getBounty(bountyId);
        playVerdict(judged?.verdict || "APPROVED");
        await render();
        toast("Verdict written on-chain", "ok");
      } catch (error) {
        toast(error.message || String(error), "err");
      }
    });
  });
}

async function render() {
  const root = document.getElementById("docket");
  const stepper = document.getElementById("stepper");
  const disputeRow = document.getElementById("disputeRow");
  if (!bountyId) {
    root.textContent = "Enter a case ID above and click Load case.";
    stepper.innerHTML = "";
    disputeRow.style.display = "none";
    return;
  }
  pageLoader(root, "Reading on-chain record\u2026");
  showBusy("Loading case from the contract\u2026");
  let bounty;
  try {
    bounty = await getBounty(bountyId);
  } finally {
    hideBusy();
  }
  if (!bounty) {
    root.textContent = "The contract returned no record for this ID yet. Wait for consensus, or check the ID.";
    stepper.innerHTML = "";
    disputeRow.style.display = "none";
    return;
  }
  rememberBountyId(bountyId);
  root.innerHTML = `
    <div class="case-card-top">
      <span class="${statusClass(bounty.status)}">${escapeHtml(bounty.status)}</span>
      <span class="${statusClass(bounty.verdict)}">${escapeHtml(bounty.verdict || "no verdict")}</span>
    </div>
    <p><strong style="color:var(--ink)">Repo</strong><br>${escapeHtml(bounty.repo_url)}</p>
    <p><strong style="color:var(--ink)">Issue</strong><br>${escapeHtml(bounty.issue_description)}</p>
    <p><strong style="color:var(--ink)">Acceptance criteria</strong><br>${escapeHtml(bounty.acceptance_criteria)}</p>
    <p><strong style="color:var(--ink)">Reward</strong> ${escapeHtml(bounty.reward)} wei \u00b7
       worker ${bounty.worker_share_bps || 0} bps \u00b7 buyer refund ${bounty.buyer_refund_bps || 0} bps</p>
    <div class="tbar" title="Worker share"><div class="tbf" style="width:${Math.min(100, Number(bounty.worker_share_bps || 0) / 100)}%;--stat-color:var(--ruling)"></div></div>
    <p class="mono">Buyer ${escapeHtml(shortAddr(bounty.buyer) || "\u2014")} \u00b7 Worker ${escapeHtml(shortAddr(bounty.worker) || "\u2014")}</p>
    ${bounty.dispute_notes ? `<div class="alert warn">Dispute notes: ${escapeHtml(bounty.dispute_notes)}</div>` : ""}
    ${
      bounty.diff_text
        ? `
    <details open>
      <summary>Patch, explanation, and test log</summary>
      ${bounty.gaming_flag ? `<div class="alert warn" style="margin-bottom:0.75rem">Automated screening flagged a possible test-weakening pattern in this diff. Validators were told to check it closely.</div>` : ""}
      <pre>${escapeHtml(bounty.explanation)}</pre>
      <pre>${escapeHtml(bounty.diff_text)}</pre>
      <pre>${escapeHtml(bounty.test_log)}</pre>
    </details>`
        : ""
    }
  `;
  renderStepper(bounty);
}

document.getElementById("loadBtn").addEventListener("click", async () => {
  setId(document.getElementById("idInput").value);
  try {
    await render();
  } catch (error) {
    toast(error.message || String(error), "err");
  }
});

document.getElementById("disputeBtn").addEventListener("click", () => {
  const button = document.getElementById("disputeBtn");
  openModal({
    kicker: "DISPUTE",
    title: "Raise a dispute",
    body: "Explain why this verdict should be reviewed. This is written on-chain.",
    extraHtml: `<label>Notes<textarea id="disputeNotes" rows="4" placeholder="Why dispute this verdict?"></textarea></label>`,
    confirmLabel: "Submit dispute",
    onConfirm: async () => {
      const notes = (document.getElementById("disputeNotes")?.value || "").trim() || "Disagree with verdict";
      await withSpinner(button, async () => {
        try {
          await withWallet(async (account) => {
            const { hash } = await writeContract("raise_dispute", [bountyId, notes], account);
            document.getElementById("txOut").innerHTML = `Disputed. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
          });
          await render();
        } catch (error) {
          toast(error.message || String(error), "err");
        }
      });
    },
  });
});

currentAccount = await getAccount();
onAccountsChanged(async () => {
  currentAccount = await getAccount();
  if (!bountyId) return;
  try {
    await render();
  } catch {
    /* ignore -- initial load below already surfaces load errors */
  }
});

try {
  await render();
} catch (error) {
  document.getElementById("docket").textContent = error.message || String(error);
  toast(error.message || String(error), "err");
}
