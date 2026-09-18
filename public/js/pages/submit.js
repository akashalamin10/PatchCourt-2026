import { explorerTx } from "../config.js";
import { getBounty, writeContract } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberBountyId, formValue, withSpinner, requireWallet, requireContract, escapeHtml } from "../ui.js";
import { sameAddress } from "../wallet.js";
import { playVerdict } from "../fx.js";

const bountyId = new URLSearchParams(location.search).get("id") || "";

document.getElementById("app").innerHTML = `
${pageShell({ active: "board" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Submit a patch</h1>
      <p>Calls <code>submit_patch</code>. The diff is stored on-chain so <code>submit_verdict</code> judges the actual evidence, not a description of it.</p>
    </div>
    <form id="patchForm" class="panel">
      <label>Case ID
        <input name="bounty_id" required value="${bountyId}">
      </label>
      <label>Explanation
        <textarea name="explanation" rows="3" required placeholder="Explain the fix"></textarea>
      </label>
      <label>Diff
        <textarea name="diff_text" rows="10" required placeholder="Paste the patch diff"></textarea>
      </label>
      <label>Test log
        <textarea name="test_log" rows="4" placeholder="Paste the test output"></textarea>
      </label>
      <button class="btn-primary" type="submit" id="patchSubmitBtn">Submit patch on-chain</button>
    </form>
    <p id="txOut" class="muted"></p>
    <div id="judgeSection"></div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

// Restore state on load/refresh: if this case already has a patch (or
// already a verdict), show the right panel instead of just the bare form.
if (bountyId) {
  restoreState(bountyId);
}

async function restoreState(id) {
  try {
    const bounty = await getBounty(id);
    if (!bounty) return;
    const hasPatch = Boolean(bounty.diff_text);
    const hasVerdict = Boolean(bounty.verdict) && bounty.status !== "disputed";
    if (hasVerdict) {
      showVerdict(id, bounty.verdict);
    } else if (hasPatch) {
      document.getElementById("txOut").innerHTML = `Patch already stored for this case. \u00b7 <a href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">Open case docket</a>`;
      renderJudgeStep(id);
    }
  } catch {
    // Non-critical: page still works with just the form if this lookup fails.
  }
}

document.getElementById("patchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = formValue(form, "bounty_id");
  const button = document.getElementById("patchSubmitBtn");
  await withSpinner(button, async () => {
    try {
      const account = await requireWallet("You need a connected wallet to submit a patch.");
      // The contract only accepts submit_patch from the assigned worker and
      // will revert anyone else's transaction -- check here first so a
      // wrong-wallet visitor gets a clear message instead of a wasted
      // signature and gas on a doomed transaction.
      const existing = await getBounty(id).catch(() => null);
      if (existing?.worker && !sameAddress(existing.worker, account)) {
        toast("Only the wallet that claimed this bounty can submit a patch for it.", "err");
        return;
      }
      if (existing && (existing.status === "settled" || existing.status === "rejected")) {
        toast("This case already has a verdict. Raise a dispute from the case docket to revise it.", "err");
        return;
      }
      toast("Confirm submit_patch\u2026");
      const { hash } = await writeContract(
        "submit_patch",
        [id, formValue(form, "diff_text"), formValue(form, "explanation"), formValue(form, "test_log")],
        account
      );
      rememberBountyId(id);
      document.getElementById("txOut").innerHTML = `Patch stored. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a> \u00b7 <a href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">Open case docket</a>`;
      toast("Patch submitted", "ok");
      renderJudgeStep(id);
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});

function showVerdict(id, verdict) {
  const section = document.getElementById("judgeSection");
  section.innerHTML = `<p class="muted">Verdict: <strong>${escapeHtml(verdict)}</strong> \u00b7 <a href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">Open case docket</a></p>`;
}

let judgeInFlight = false;

function renderJudgeStep(id) {
  const section = document.getElementById("judgeSection");
  section.innerHTML = `
    <div class="panel" style="margin-top:1.5rem">
      <h4>Judge with GenLayer</h4>
      <p class="step-note">Anyone can trigger this step. The verdict itself is decided by independent AI validators reading the diff, not by whoever clicks the button.</p>
      <button class="btn-primary" id="judgeNowBtn" type="button">Judge with GenLayer</button>
    </div>`;
  document.getElementById("judgeNowBtn").addEventListener("click", async (event) => {
    if (judgeInFlight) return;
    judgeInFlight = true;
    event.currentTarget.disabled = true;
    await withSpinner(event.currentTarget, async () => {
      try {
        // Defensive re-check: someone else may have already judged this case
        // while the button sat on screen (e.g. a stale tab left open).
        const existing = await getBounty(id);
        if (existing?.verdict && existing.status !== "disputed") {
          showVerdict(id, existing.verdict);
          toast("This case already has a verdict.", "ok");
          return;
        }
        const account = await requireWallet("You need a connected wallet to sign this transaction.");
        toast("Validators are reading the diff. Keep this tab open.");
        const { hash } = await writeContract("submit_verdict", [id], account);
        document.getElementById("txOut").innerHTML = `Judged. <a href="${explorerTx(hash)}" target="_blank" rel="noopener">View on explorer</a>`;
        const judged = await getBounty(id);
        playVerdict(judged?.verdict || "APPROVED");
        showVerdict(id, judged?.verdict || "APPROVED");
        toast("Verdict written on-chain", "ok");
      } catch (error) {
        toast(error.message || String(error), "err");
      } finally {
        judgeInFlight = false;
      }
    });
  });
}
