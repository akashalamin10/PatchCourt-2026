import { writeContract } from "../genlayer-client.js";
import { pageShell, pageFooter, wireChrome, toast, rememberBountyId, formValue, withSpinner, requireWallet, requireContract } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "post" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>Post a bounty</h1>
      <p>This calls <code>post_bounty</code> on the Studio Next contract. The reward is currently recorded as a number on-chain, it does not yet lock real GEN as escrow (that upgrade is still pending).</p>
    </div>
    <form id="postForm" class="panel">
      <label>Case ID
        <input name="bounty_id" required placeholder="Case ID">
      </label>
      <label>Repo URL
        <input name="repo_url" required placeholder="Repository URL">
      </label>
      <label>Issue description
        <textarea name="issue_description" rows="3" required placeholder="Describe the issue"></textarea>
      </label>
      <label>Acceptance criteria
        <textarea name="acceptance_criteria" rows="3" required placeholder="What must be true for this fix to count"></textarea>
      </label>
      <label>Reward, in wei (recorded on-chain, not yet locked as escrow)
        <input name="reward" type="number" min="0" required placeholder="Reward in wei">
      </label>
      <button class="btn-primary" type="submit" id="postSubmitBtn">Post on GenLayer</button>
    </form>
    <p id="txOut" class="muted"></p>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
requireContract();

document.getElementById("postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const bountyId = formValue(form, "bounty_id");
  const reward = Number(formValue(form, "reward") || 0);
  const button = document.getElementById("postSubmitBtn");
  await withSpinner(button, async () => {
    try {
      const account = await requireWallet("You need a connected wallet to post a bounty.");
      toast("Confirm post_bounty in your wallet\u2026");
      const { hash } = await writeContract(
        "post_bounty",
        [bountyId, formValue(form, "repo_url"), formValue(form, "issue_description"), reward, formValue(form, "acceptance_criteria")],
        account
      );
      rememberBountyId(bountyId);
      document.getElementById("txOut").innerHTML = `Posted. Reward recorded on-chain. Tx <code>${hash || "submitted"}</code> \u00b7 <a href="/pages/bounty-detail.html?id=${encodeURIComponent(bountyId)}">Open case</a>`;
      toast("Bounty posted", "ok");
      form.reset();
    } catch (error) {
      toast(error.message || String(error), "err");
    }
  });
});
