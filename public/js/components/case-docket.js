const cases = [
  {
    id: "CASE #0417",
    repo: "payments-service · failing test suite",
    issue: "Integration test for refund calculation fails on partial refunds.",
    log: ["Target test now passes", "Diff modifies the test assertion, not the logic"],
    verdict: "rejected",
    note: "Rejected — the assertion was weakened, the underlying bug is untouched."
  },
  {
    id: "CASE #0418",
    repo: "auth-gateway · linked issue #212",
    issue: "Session tokens fail to expire after password reset.",
    log: ["Target test now passes", "Diff addresses the token invalidation logic"],
    verdict: "approved",
    note: "Approved — the fix matches the explanation and no regressions were found."
  },
  {
    id: "CASE #0419",
    repo: "billing-core · flaky test",
    issue: "Currency rounding drifts by a cent on repeated conversions.",
    log: ["Target test now passes", "One unrelated regression introduced elsewhere"],
    verdict: "partial",
    note: "Partial — genuine fix, minor regression. Worker receives 70%, buyer refunded 30%."
  }
];

const verdictLabel = {
  approved: "APPROVED",
  rejected: "REJECTED",
  partial: "PARTIAL"
};

export function startDocket() {
  const caseId = document.getElementById("docketCaseId");
  const repo = document.getElementById("docketRepo");
  const issue = document.getElementById("docketIssue");
  const status = document.getElementById("docketStatus");
  const spinner = document.getElementById("docketSpinner");
  const log = document.getElementById("docketLog");
  const note = document.getElementById("docketNote");
  const stamp = document.getElementById("docketStamp");

  if (!caseId) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;

  function renderCase(data) {
    caseId.textContent = data.id;
    repo.textContent = data.repo;
    issue.textContent = data.issue;
    log.innerHTML = "";
    note.textContent = "";
    note.classList.remove("show");
    stamp.classList.remove("show", "approved", "rejected", "partial");
    stamp.textContent = "";
    spinner.style.display = "block";
    status.textContent = "Validators reading the diff…";
  }

  function revealLog(data, step) {
    if (step >= data.log.length) {
      settle(data);
      return;
    }
    const line = document.createElement("span");
    line.className = "done";
    line.textContent = data.log[step];
    log.appendChild(line);
    setTimeout(() => revealLog(data, step + 1), reduceMotion ? 10 : 700);
  }

  function settle(data) {
    spinner.style.display = "none";
    status.textContent = "Consensus reached";
    stamp.textContent = verdictLabel[data.verdict];
    stamp.classList.add("show", data.verdict);
    note.textContent = data.note;
    note.classList.add("show");
  }

  function cycle() {
    const data = cases[index % cases.length];
    renderCase(data);
    setTimeout(() => revealLog(data, 0), reduceMotion ? 10 : 900);
    index += 1;
  }

  cycle();
  setInterval(cycle, reduceMotion ? 4000 : 7000);
}
