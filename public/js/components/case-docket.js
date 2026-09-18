import { fetchAllBountyRows } from "../genlayer-client.js";
import { getContractAddress } from "../config.js";
import { statusClass, escapeHtml, pageLoader } from "../ui.js";

const EXAMPLE = {
  id: "refund-0417",
  repo_url: "acme/checkout-service",
  issue_description: "Partial refunds return the full order total instead of total minus already-paid.",
  verdict: "APPROVED",
  status: "settled",
};

function renderDocket(root, { id, repo_url, issue_description, verdict, status, live }) {
  root.innerHTML = `
    <div class="docket-header">
      <span>${live ? "Live from chain" : "Example walkthrough"}</span>
      <span class="docket-case-id mono">${escapeHtml(id)}</span>
    </div>
    <div class="docket-repo mono">${escapeHtml(repo_url)}</div>
    <div class="docket-issue">${escapeHtml(issue_description)}</div>
    <div class="docket-status"><span class="${statusClass(status)}">${escapeHtml(status)}</span></div>
    <div class="docket-log" id="docketLog"></div>
    <div class="docket-note" id="docketNote">Independent validators compared the diff against the acceptance criteria before this verdict was written on-chain.</div>
    <div class="stamp" id="docketStamp">${escapeHtml(verdict)}</div>
  `;
  const log = root.querySelector("#docketLog");
  const stamp = root.querySelector("#docketStamp");
  const note = root.querySelector("#docketNote");
  const lines = ["Bounty posted, reward escrowed", "Claimed by a worker", "Patch submitted on-chain", "Validators reached consensus"];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(timer);
      stamp.classList.add(verdict.toLowerCase() === "approved" ? "approved" : verdict.toLowerCase() === "rejected" ? "rejected" : "partial");
      stamp.classList.add("show");
      note.classList.add("show");
      return;
    }
    const span = document.createElement("span");
    span.textContent = lines[i];
    span.className = "done";
    log.appendChild(span);
    i += 1;
  }, 650);
}

export async function mountHeroDocket(root) {
  const address = getContractAddress();
  if (address) {
    try {
      pageLoader(root, "Loading live case\u2026");
      const rows = await fetchAllBountyRows();
      for (const row of rows) {
        if (row?.bounty?.verdict) {
          renderDocket(root, { id: row.id, ...row.bounty, live: true });
          return;
        }
      }
    } catch {
      /* fall through to example */
    }
  }
  renderDocket(root, { ...EXAMPLE, live: false });
}
