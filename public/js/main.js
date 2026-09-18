import { pageShell, pageFooter, wireChrome } from "./ui.js";
import { getContractAddress } from "./config.js";
import { mountHeroDocket } from "./components/case-docket.js";

const arrowIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

document.getElementById("app").innerHTML = `
${pageShell({ active: "" })}
<main>
  <section class="hero">
    <div class="container">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="section-eyebrow">GenLayer Agent Tank \u00b7 Studio Next</div>
          <h1>Code-fix bounties, judged by consensus. Not by whoever wrote the test.</h1>
          <p>Post a bounty against a real issue, escrow the reward on-chain, and let independent GenLayer validators decide whether a submitted patch actually fixes it, or just games the test suite.</p>
          <p id="contractHint">${getContractAddress() ? "Contract configured, reading live state." : "No contract set yet. Showing an example case, set one on the Setup page."}</p>
          <div class="hero-actions">
            <a class="btn-primary" href="/pages/bounty-board.html">Browse open cases</a>
            <a class="btn-secondary" href="/pages/post-bounty.html">Post a bounty</a>
          </div>
        </div>
        <div class="docket" id="heroDocket"></div>
      </div>
    </div>
  </section>

  <section id="flow">
    <div class="container">
      <div class="section-eyebrow">How a case moves</div>
      <h2>Four steps, all on-chain</h2>
      <div class="flow-grid" style="margin-top:2rem">
        <div class="flow-step"><h4>Post &amp; escrow</h4><p>The buyer posts an issue with acceptance criteria. The reward is locked into the contract in the same transaction.</p></div>
        <div class="flow-step"><h4>Claim</h4><p>A worker claims the open case. Only one worker owns a case at a time, so there's no race between competing submissions.</p></div>
        <div class="flow-step"><h4>Submit patch</h4><p>The worker submits a diff, an explanation, and a test log. All three land on-chain as the record validators will judge.</p></div>
        <div class="flow-step"><h4>Validators rule</h4><p>Independent GenLayer validators compare the diff to the acceptance criteria and reach consensus on one verdict: approved, partial, or rejected.</p></div>
      </div>
    </div>
  </section>

  <section id="why">
    <div class="container">
      <div class="section-eyebrow">Why this needs judgment, not just CI</div>
      <h2>A green test doesn't mean a fixed bug</h2>
      <p class="lede">A pipeline can tell you a test went from failing to passing. It can't tell you whether the change that made it pass touched the actual bug, or just weakened the assertion around it. That's a judgment call, and a single reviewer, or the bounty poster themselves, has every incentive to get it wrong in either direction.</p>
      <div class="why-grid">
        <div class="why-card"><h4>Resistant to test-gaming</h4><p>Submitted diffs are screened for the classic tells: loosened assertions, skipped tests, hardcoded returns. Validators are told explicitly to check for them before ruling.</p></div>
        <div class="why-card"><h4>No single point of trust</h4><p>The buyer can't unilaterally reject a valid fix to avoid paying, and the worker can't unilaterally approve their own weak patch. Consensus sits outside both.</p></div>
        <div class="why-card"><h4>Transparent by default</h4><p>The diff, the explanation, the test log, and the verdict are all public contract state, so anyone can re-read exactly what was judged and why.</p></div>
      </div>
    </div>
  </section>

  <section id="architecture">
    <div class="container">
      <div class="section-eyebrow">Under the hood</div>
      <h2>Where each piece runs</h2>
      <div class="arch-strip" style="margin-top:2rem">
        <div class="arch-node"><div class="stat-label">Wallet</div><p>Buyer and worker sign every action (posting, claiming, submitting, judging) from their own wallet.</p></div>
        <div class="arch-arrow">${arrowIcon}</div>
        <div class="arch-node"><div class="stat-label">PatchCourt contract</div><p>Runs on Studio Next (chain 61997). Holds escrow, case state, and the verdict prompt sent to validators.</p></div>
        <div class="arch-arrow">${arrowIcon}</div>
        <div class="arch-node"><div class="stat-label">GenLayer validators</div><p>Each runs the same prompt against the diff independently, and the contract only accepts a verdict every validator agrees on.</p></div>
        <div class="arch-arrow">${arrowIcon}</div>
        <div class="arch-node"><div class="stat-label">Settlement</div><p>Verdict decides the payout split. Both sides withdraw their share directly from the contract.</p></div>
      </div>
    </div>
  </section>

  <section id="cta">
    <div class="container narrow" style="text-align:left">
      <h2>Ready to see a real case?</h2>
      <p class="lede">Every case on the board was posted, claimed, patched, and judged the same way: through the wallet, on Studio Next.</p>
      <div class="hero-actions">
        <a class="btn-primary" href="/pages/bounty-board.html">Open the bounty board</a>
        <a class="btn-secondary" href="/pages/verify.html">How to verify a result</a>
      </div>
    </div>
  </section>
</main>
${pageFooter()}
`;

await wireChrome();
await mountHeroDocket(document.getElementById("heroDocket"));
