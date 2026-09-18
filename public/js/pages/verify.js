import { NETWORK } from "../config.js";
import { pageShell, pageFooter, wireChrome } from "../ui.js";

document.getElementById("app").innerHTML = `
${pageShell({ active: "verify" })}
<main class="page">
  <div class="container narrow">
    <div class="section-head">
      <h1>How to verify a result</h1>
      <p>For anyone reviewing this submission: this checks that a real bounty was really judged by GenLayer validators, not simulated in the frontend.</p>
    </div>
    <div class="stepper">
      <div class="step-row step-done"><div class="step-num">\u2713</div><div class="step-body"><h4>Open a settled case</h4><div class="step-note">From the Bounty board, open any case whose status pill reads <code>settled</code> or <code>rejected</code>.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">\u2713</div><div class="step-body"><h4>Read the verdict against the diff</h4><div class="step-note">Expand "Patch, explanation, and test log" and compare it to the verdict pill. The diff is the exact evidence validators judged.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">\u2713</div><div class="step-body"><h4>Check the transaction on-chain</h4><div class="step-note">Every action links to <a href="${NETWORK.explorer}" target="_blank" rel="noopener">the Studio Next explorer</a>. The verdict came from an on-chain <code>submit_verdict</code> call, not a database write.</div></div><div></div></div>
      <div class="step-row step-done"><div class="step-num">\u2713</div><div class="step-body"><h4>Reproduce a rejection</h4><div class="step-note">Post a bounty, submit a patch that only weakens a test assertion (e.g. change <code>assertEqual</code> to <code>assertTrue</code>) without touching production logic, then judge it. The automated screening note and the validator verdict should both flag it.</div></div><div></div></div>
    </div>
    <div class="panel">
      <h3 style="font-size:var(--step-0)">Why decentralized judgment, specifically</h3>
      <p style="margin-bottom:0">A CI pipeline can tell you a test went from red to green. It cannot tell you whether the code that made it green actually fixes the reported bug, or just games the test. That distinction needs judgment: reading the diff against the stated issue and acceptance criteria. GenLayer's validators reach consensus on that judgment independently, the same way several reviewers would.</p>
    </div>
  </div>
</main>
${pageFooter()}
`;

await wireChrome();
