import { writeContract } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberBountyId, formValue, withSpinner, requireWallet, requireContract } from "../ui.js";

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
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

document.getElementById("patchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const id = formValue(form, "bounty_id");
  const button = document.getElementById("patchSubmitBtn");
  await withSpinner(button, async () => {
    try {
      const account = await requireWallet("You need a connected wallet to submit a patch.");
      toast("Confirm submit_patch\u2026");
      const { hash } = await writeContract(
        "submit_patch",
        [id, formValue(form, "diff_text"), formValue(form, "explanation"), formValue(form, "test_log")],
        account
      );
      rememberBountyId(id);
      document.getElementById("txOut").innerHTML = `Patch stored. <a href="/pages/bounty-detail.html?id=${encodeURIComponent(id)}">Judge it</a> \u00b7 tx <code>${hash || "submitted"}</code>`;
      toast("Patch submitted", "ok");
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
