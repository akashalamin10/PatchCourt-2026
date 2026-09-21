# PatchCourt

**Code-fix bounties, judged by consensus — not by whoever wrote the test.**

Built for the GenLayer Agent Tank hackathon. Runs on **Studio Next** (Consensus v0.6 RC, chain `61997`).

**Confirmed working deployment:** `0x40DA7abd05aAd504Ca9D2Ae95b33C1E1c318e67e` — [view on the Studio Next explorer](https://explorer-studio-next.genlayer.com/address/0x40DA7abd05aAd504Ca9D2Ae95b33C1E1c318e67e).https://explorer-studio-dev.genlayer.com/address/0x01d1F9DB4C241722DAC9Af73568ffDCa52598B75, https://explorer-studio-dev.genlayer.com/address/0x58b9AFB531F332AF9bF6Cb54f22369538617BE85,https://explorer-studio-dev.genlayer.com/address/0xABd6764Fcfe6be0014457D44984E4E82eDbfF865 5/5 transactions FINALIZED/SUCCESS: deploy, `post_bounty`, `claim_bounty`, `submit_patch`, and `submit_verdict` reaching `APPROVED` through independent validator consensus. This address is baked into the app as the default, so opening it points straight at a verified, working contract.

A buyer posts a real code issue with acceptance criteria and locks a reward into on-chain escrow. A worker claims the case and submits a diff, an explanation, and a test log — all stored on-chain. Then independent GenLayer validators read the actual diff against the acceptance criteria and reach consensus on one verdict: `APPROVED`, `PARTIAL`, or `REJECTED`. That verdict decides the payout split.

## Why this needs decentralized judgment

A CI pipeline can tell you a test went from red to green. It cannot tell you whether the change that made it green touched the real bug, or just weakened the assertion around it.

That distinction is a judgment call, and neither party can be trusted with it alone:

- The **buyer** has an incentive to reject a valid fix to avoid paying.
- The **worker** has an incentive to approve a patch that only games the test.

PatchCourt puts that judgment outside both parties. Every validator runs the same prompt against the same diff independently, and the contract only accepts a verdict they agree on (`gl.eq_principle.prompt_comparative`).

On top of that, submitted diffs are screened for the classic test-gaming tells — loosened assertions, skipped tests, hardcoded returns — and validators are handed that screening result as an explicit checklist to verify against the diff, rather than as an automatic rejection.

## Architecture

| Layer | What runs there |
|---|---|
| Wallet | Buyer and worker sign every action themselves: post, claim, submit, judge, withdraw |
| `PatchCourt` contract | Studio Next, chain 61997. Holds escrow, case state, and the verdict prompt |
| GenLayer validators | Run the verdict prompt independently; consensus required before state changes |
| Settlement | Verdict sets the payout split in bps; both sides withdraw their own share |

There is no backend, no database, and no server-side key. The frontend is static files that talk to the chain through the user's wallet. Nothing is simulated client-side — if the contract address isn't set, the landing page says so and shows a clearly-labeled example instead of faking live data.

## Page routes (do not drop `.html` unless Firebase is deployed)

All real files live under `public/pages/*.html`. The header always links to the `.html` path so local `python -m http.server` works.

| Page | Canonical URL (always works) | Also works after `firebase deploy` |
|---|---|---|
| Dashboard | `/pages/dashboard.html` | `/pages/dashboard`, `/dashboard` |
| Board | `/pages/bounty-board.html` | `/pages/bounty-board`, `/board` |
| Post | `/pages/post-bounty.html` | `/pages/post-bounty`, `/post` |
| Case | `/pages/bounty-detail.html?id=...` | `/pages/bounty-detail?id=...` |
| Submit | `/pages/submit-patch.html?id=...` | `/pages/submit-patch?id=...` |
| Setup | `/pages/setup.html` | `/pages/setup`, `/setup` |
| Verify | `/pages/verify.html` | `/pages/verify`, `/verify` |

`/pages/dashboard` 404'd before because `firebase.json` had no `cleanUrls`. That is now on. Redeploy hosting for the short path to work.

Local clean-URL server:

```bash
python3 scripts/serve.py
```

## Contract surface

```
post_bounty(bounty_id, repo_url, issue_description, reward, acceptance_criteria)  payable
claim_bounty(bounty_id)
submit_patch(bounty_id, diff_text, explanation, test_log)
submit_verdict(bounty_id)          -> validator consensus decides the verdict
withdraw()                         -> pays out settled credit

get_bounty(bounty_id) / list_bounty_ids() / get_credit(address) / get_owner()   [views]
```

Payout splits (single source of truth, `SETTLEMENT_BPS` in the contract):

| Verdict | Worker | Buyer refund |
|---|---|---|
| `APPROVED` | 100% | 0% |
| `PARTIAL` | 70% | 30% |
| `REJECTED` | 0% | 100% |

## Running it

```bash
cd public
python3 -m http.server 8080    # or any static file server
```

Then open `http://localhost:8080`, go to **Setup**, and paste your deployed contract address.

See [DEPLOY.md](DEPLOY.md) for the deploy-and-verify sequence — including two things you should test on-chain before recording a demo.

## Tests

The contract's settlement math and gaming screen are mirrored in `contracts/escrow_logic.py` so they can be unit-tested without the GenLayer runtime:

```bash
cd contracts && python -m pytest tests/ -q
```

`tests/test_no_drift.py` fails if those mirrored constants ever diverge from the contract, or if the `Depends` line reverts to a floating `:latest` tag — both of which were real bugs in an earlier version of this project.

## Against the hackathon review criteria

| Criterion | Where it's met |
|---|---|
| Calls a real GenLayer contract | Every action is a wallet-signed write to `patch_court_contract.py` on Studio Next. No mock mode |
| Why decentralized judgment matters | See above — a green test isn't a fixed bug, and neither party can be trusted to make that call |
| Meaningful state, meaningful validator check | Full case lifecycle persists on-chain (escrow, diff, verdict, credit). Validators judge the actual diff against the acceptance criteria, not just whether tests pass |
| Repo builds and works | Static frontend, no build step. Contract syntax-checked, 11 logic tests passing |
| Beyond the boilerplate | Own contract, own escrow/settlement model, own anti-test-gaming screen, 8-page frontend, drift-guard tests |
| Someone can verify the result | The **How to verify** page walks a reviewer through checking a real verdict on the explorer, including how to reproduce a rejection |

## Known limits, stated honestly

- `withdraw()` uses `emit_transfer` via a ghost-contract interface — the documented pattern for paying an EOA from an Intelligent Contract. Confirm it moves real value on your deployment before relying on it (DEPLOY.md step 5).
- The `Depends` hash pins the py-genlayer runtime. If Studio Next rejects it, replace it with the hash your CLI reports — do not fall back to `:latest`.
- Fee estimation is wired into every write (`attachFees` in `genlayer-client.js`) but skips silently if the SDK build doesn't expose an estimator. Check the first `submit_verdict` doesn't revert on fees.
- The app is not using `@genlayer/transaction-kit` — it calls `genlayer-js@2.0.0-rc.1` directly, because the frontend is deliberately framework-free static files and the kit ships React/Vue adapters. Same network, same SDK version line.
