# Test Patch Court

End-to-end walkthrough of a live PatchCourt test: a buyer posts a bounty, a worker submits a weak GitHub pull request, GenLayer rejects it on-chain, the worker updates the same PR, a second bounty is judged and approved.

This document records what actually happened in the test, not a generic product overview.

---

## 1. What PatchCourt is doing in this test

PatchCourt is a bounty board for GitHub work.

1. A **buyer** posts a bounty against a public repository, with a reward and written acceptance criteria.
2. A **worker** claims the bounty and submits a patch as a GitHub pull request.
3. The buyer can ask **GenLayer** to judge the PR against the criteria on-chain (`Judge with wallet`), or settle manually (`Approve & settle` / `Reject`).
4. The verdict is written back onto the submission. An explorer link is shown when the judgment is on-chain.

Two accounts and two wallets were used so buyer and worker never shared a session.

| Role | GitHub | Site wallet (short) |
| --- | --- | --- |
| Buyer | `akashalamin10` | `0x8f4f...4d48` |
| Worker / fixer | `AKASH281221` | `0xa671...ce37` |

Test repository:

https://github.com/akashalamin10/patchcourt-test

---

## 2. Infrastructure that had to be in place first

The live site already had Firebase auth and Firestore. The GenLayer path also needed a Cloudflare Worker plus a contract address in frontend config.

### 2.1 Cloudflare Worker

Dashboard: [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → worker name `patchcourt-trigger`.

Worker code came from the project zip file:

`free-pipeline/cloudflare-worker.js`

Runtime variables / secrets:

| Name | Type | Value used |
| --- | --- | --- |
| `GITHUB_TOKEN` | Secret | GitHub personal access token (never pasted into the public site) |
| `GITHUB_OWNER` | Text | GitHub owner used by the pipeline |
| `GITHUB_REPO` | Text | repo name the pipeline is allowed to talk to |

Public worker URL:

```
https://patchcourt-trigger.akash-alamin-cse.workers.dev
```

### 2.2 Frontend config

File: `public/js/config/pipeline-config.js`

```js
export const WORKER_URL = "https://patchcourt-trigger.akash-alamin-cse.workers.dev";
export const GENLAYER_CONTRACT_ADDRESS = "0xF91574fbC770c28F9331c03C5C83D4C172b9b630";
```

Important:

- `GENLAYER_CONTRACT_ADDRESS` must be the raw 20-byte hex address only.
- Do **not** put an explorer URL in that field.
- Putting `https://explorer-studio.genlayer.com/address/0xF91574fbC770c28F9331c03C5C83D4C172b9b630` into the address field made viem throw:

```
Address "https://explorer-studio.genlayer.com/address/0x..." is invalid.
- Address must be a hex value of 20 bytes (40 hex characters).
- Address must match its checksum counterpart.
Version: viem@2.56.3
```

After the field held only `0xF91574fbC770c28F9331c03C5C83D4C172b9b630`, on-chain judging worked.

---

## 3. Prepare the GitHub repo and a real pull request

The bounty repo started empty. An empty repository cannot be forked cleanly, and a worker on a second GitHub account cannot open a PR into it until there is at least one commit on `main`.

### 3.1 Buyer creates the repo baseline

Account: `akashalamin10`

1. Open https://github.com/akashalamin10/patchcourt-test
2. **Add file → Create new file**
3. Name it `README.md`
4. Contents:

```markdown
# patchcourt-test
Test repo for PatchCourt bounty.
```

5. Commit directly to `main`.

The repo is no longer empty.

### 3.2 Worker forks and opens a PR into the buyer repo

Account: `AKASH281221` (separate browser / incognito).

1. Open https://github.com/akashalamin10/patchcourt-test
2. **Fork** → **Create fork**
3. On the fork, edit `README.md` and add a single weak line:

```text
Fixer patch: added run instructions.
```

4. Commit with **Create a new branch and start a pull request** (branch used: `AKASH281221-patch-1`).
5. Do **not** stop at a PR that only targets the fork.

A first PR was accidentally opened as:

https://github.com/AKASH281221/patchcourt-test/pull/1

That PR stays inside the worker fork. PatchCourt needs a PR whose base is the bounty repo.

Correct compare URL:

https://github.com/akashalamin10/patchcourt-test/compare/main...AKASH281221:patchcourt-test:AKASH281221-patch-1

From that page: **Create pull request**.

Correct PR, used for both rounds:

https://github.com/akashalamin10/patchcourt-test/pull/1

```
AKASH281221:AKASH281221-patch-1  →  akashalamin10:main
```

Leave this PR **open**. Do not merge it. The judge reads the open PR diff.

---

## 4. Round 1 — buyer posts a bounty the first patch cannot satisfy

### 4.1 What the buyer asked for

Browser A, buyer account.

Dashboard → **Post a bounty**.

| Field | Value |
| --- | --- |
| Case | `#GYGP` |
| Repo | https://github.com/akashalamin10/patchcourt-test |
| Description | Add a README section that explains how to run the project |
| Reward | $25 |
| Deadline | 2 hours |
| Acceptance criteria | README must include install steps and a run command |

After publish, buyer dashboard showed `#GYGP` as **Under review** once a patch existed. Before that it was an open bounty waiting for a claim.

### 4.2 Worker claims and submits the weak PR

Browser B / incognito, worker account.

1. Open the live site and sign in as the worker.
2. Open bounty `#GYGP` from the board.
3. **Claim**.
4. Go to **My submissions** (or the bounty submit form).
5. Fill:

| Field | Value |
| --- | --- |
| Branch or commit link | `https://github.com/akashalamin10/patchcourt-test/pull/1` |
| Explanation | Added a line to README with run instructions to match the bounty criteria. |

6. **Submit patch**.

Worker table after submit:

| Case | Result | When |
| --- | --- | --- |
| `#GYGP` | pending | just now |

The claim slot on that bounty is consumed. The form then shows **Claimed bounty: No claimed bounties yet**. The worker cannot submit a second patch on `#GYGP` without a new claim.

### 4.3 Buyer opens the case

At first, bounty detail flashed **No patches submitted for this bounty yet** even though the worker table already had a pending row and the dashboard said **Under review**. A hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) and re-opening `#GYGP` loaded the submission.

Buyer then saw:

- Submission `#A0TH`
- Status: pending
- PR link: https://github.com/akashalamin10/patchcourt-test/pull/1
- Buttons: **Judge with wallet (GenLayer)**, **Reject**, **Approve & settle**

### 4.4 GenLayer rejects the first patch

Buyer clicked **⚡ Judge with wallet (GenLayer)** and confirmed the wallet transaction.

On-chain result for `#A0TH`:

```
Submission #A0TH  Rejected
Judged on-chain (REJECTED) · View on GenLayer Explorer →
```

Why this reject is correct:

- Criteria required **install steps** and a **run command**.
- The PR only added: `Fixer patch: added run instructions.`
- There was no `npm install`, no `npm start`, and no real “How to run” section.

Explorer link the UI produced:

https://genlayer-explorer.vercel.app/tx/0x480849af32a4199b44e351a069de7a530b626b8c7f466c5c5729b36e6c5d20e5

That host is an older explorer frontend baked into the app. The transaction hash is the proof:

```
0x480849af32a4199b44e351a069de7a530b626b8c7f466c5c5729b36e6c5d20e5
```

Same hash on the current Studio explorer:

https://explorer-studio.genlayer.com/tx/0x480849af32a4199b44e351a069de7a530b626b8c7f466c5c5729b36e6c5d20e5

Do not click **Approve & settle** after an on-chain reject. The chain verdict already stands.

Round 1 board result:

| Case | Reward | Status |
| --- | --- | --- |
| `#GYGP` | $25 | Rejected |

---

## 5. Why the worker could not just resubmit on the same bounty

After reject:

- Worker **My submissions** still lists `#GYGP` as rejected.
- **Claimed bounty** is empty.
- There is no second Claim button on that settled/rejected case.

Updating the GitHub PR **does** change the diff at the same URL. It does **not** rewrite submission `#A0TH`. That row is already judged.

So the GitHub work can be reused. The site needs a **new bounty + new claim + new submission**.

---

## 6. Round 2 — worker updates the same PR, buyer posts a new bounty

### 6.1 Update the existing PR (do not open a new one)

Account: `AKASH281221`

Edit the patch branch file:

https://github.com/AKASH281221/patchcourt-test/blob/AKASH281221-patch-1/README.md

Replace the README with something that actually matches the criteria:

```markdown
# patchcourt-test

Add a README section that explains how to run the project.

## How to run
npm install
npm start
```

Commit **directly onto** `AKASH281221-patch-1`.

Check the original PR still points at `akashalamin10:main` and that **Files changed** now includes install + run lines:

https://github.com/akashalamin10/patchcourt-test/pull/1

Same URL as round 1. New commit on the same branch.

### 6.2 Buyer posts a second bounty

Same repo, same words, new case. Example values from the live run:

| Field | Value |
| --- | --- |
| Case | `#6LGL` |
| Repo | https://github.com/akashalamin10/patchcourt-test |
| Description | Add a README section that explains how to run the project |
| Reward | $28 |
| Deadline | 5 hours |
| Acceptance criteria | README must include install steps and a run command |

### 6.3 Worker claims the new case and submits the same PR URL

| Field | Value |
| --- | --- |
| Branch or commit link | `https://github.com/akashalamin10/patchcourt-test/pull/1` |
| Explanation | Updated README with a How to run section that includes install steps (npm install) and a run command (npm start), matching the acceptance criteria. |

New submission id: `#IKVH` (pending until judged).

### 6.4 GenLayer approves the updated patch

Buyer opened the new bounty detail and clicked **⚡ Judge with wallet (GenLayer)** again.

Result:

```
Submission #IKVH  Approved
Judged on-chain (APPROVED) · View on GenLayer Explorer →
```

This time the PR body contained:

- a README section about how to run the project
- an install step: `npm install`
- a run command: `npm start`

That is what the written criteria asked for, so approval is the expected verdict.

Worker dashboard after both rounds:

| Case | Repo | Reward | Status |
| --- | --- | --- | --- |
| `#6LGL` | patchcourt-test | $28 | Settled |
| `#GYGP` | patchcourt-test | $25 | Rejected |

---

## 7. Reputation numbers after the two rounds

Worker dashboard showed:

| Stat | Value |
| --- | --- |
| Genuine-fix rate | 100% |
| Dispute rate | 0% |
| Settled | 1 |
| Claimed / in progress | as shown on the board |

`100%` does **not** mean “every submission was approved.”

`#GYGP` was rejected and is not counted as a settled fix. `#6LGL` settled, and nobody disputed it, so:

```
settled genuine work / settled work  =  1 / 1  =  100%
```

If the product used `approved / (approved + rejected)` the rate would be 50%. It does not. Rejects live in a separate bucket. Dispute rate stays `0%` until someone raises a dispute.

---

## 8. Dispute step — attempted, not completed

The written test plan said either account can open **Disputes**, raise one against the bounty, and the case should reopen on bounty-detail for a fresh verdict.

What the UI actually showed, on both accounts:

```
Your disputes: No disputes raised.
Bounty: No eligible bounties
```

Tried as:

- Buyer wallet `0x8f4f...4d48` after the reject
- Worker wallet `0xa671...ce37` after the reject
- Again after the approve / settle

The form reasons exist (`Suspected test-gaming`, `Incomplete fix`, `Unrelated regression introduced`, `Disagreement on acceptance criteria`), but the bounty dropdown never listed `#GYGP` or `#6LGL`.

So the on-chain judge path was proven. The in-app dispute reopen path was blocked by eligibility filtering in this build. That is a product/UI gap in this test, not a missed click.

If a later build lists the case, the intended demo text is:

- **Who:** buyer (natural after an approval) or worker (natural after a rejection)
- **Reason:** Disagreement on acceptance criteria
- **Notes (after reject):** README update should count as a first valid patch for this test
- **Notes (after approve):** Approving a README-only change is too weak for the stated bounty

---

## 9. Click-by-click checklist (repeat this yourself)

Use two browsers.

### A. One-time setup

- [ ] Cloudflare Worker `patchcourt-trigger` deployed with `cloudflare-worker.js`
- [ ] Secrets: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
- [ ] `WORKER_URL` and `GENLAYER_CONTRACT_ADDRESS` set in `pipeline-config.js`
- [ ] Contract address is hex only, not an explorer URL
- [ ] Buyer and worker accounts exist on the live site
- [ ] Two GitHub accounts; test repo is public and non-empty

### B. GitHub PR

- [ ] Buyer commits initial `README.md` on `main`
- [ ] Worker forks, edits on a branch, opens PR **into** `akashalamin10/patchcourt-test`
- [ ] Confirm URL shape: `https://github.com/akashalamin10/patchcourt-test/pull/N`
- [ ] Leave PR open

### C. Round 1 (expected reject)

- [ ] Buyer posts bounty with strict criteria
- [ ] Worker claims and pastes the PR URL
- [ ] Buyer hard-refreshes bounty detail until the submission row appears
- [ ] Buyer clicks **Judge with wallet** and confirms the tx
- [ ] Submission shows **Judged on-chain (REJECTED)**

### D. Round 2 (expected approve)

- [ ] Worker commits install + run commands onto the **same** PR branch
- [ ] Buyer posts a **new** bounty (old claim cannot be reused)
- [ ] Worker claims the new case and submits the **same** PR URL
- [ ] Buyer judges with wallet again
- [ ] Submission shows **Judged on-chain (APPROVED)** and the case **Settled**

### E. Optional proof

- [ ] Open the GenLayer explorer link (or paste the tx hash into explorer-studio)
- [ ] In Firebase Console → Firestore, confirm submission `verdict` and bounty `status`
- [ ] Try **Disputes**; if the dropdown is empty, record it as blocked

---

## 10. Files, IDs, and URLs from this test

| Item | Value |
| --- | --- |
| Live worker | https://patchcourt-trigger.akash-alamin-cse.workers.dev |
| GenLayer contract | `0xF91574fbC770c28F9331c03C5C83D4C172b9b630` |
| Bounty repo | https://github.com/akashalamin10/patchcourt-test |
| Worker fork | https://github.com/AKASH281221/patchcourt-test |
| Patch branch | `AKASH281221-patch-1` |
| Pull request used both times | https://github.com/akashalamin10/patchcourt-test/pull/1 |
| Round 1 bounty | `#GYGP` — $25 — Rejected |
| Round 1 submission | `#A0TH` — on-chain REJECTED |
| Round 2 bounty | `#6LGL` — $28 — Settled |
| Round 2 submission | `#IKVH` — on-chain APPROVED |
| Example reject tx hash | `0x480849af32a4199b44e351a069de7a530b626b8c7f466c5c5729b36e6c5d20e5` |

---

## 11. Short story of the test

The buyer paid for a README that taught someone how to install and run the project. The worker first pushed a one-line placeholder. GenLayer read the criteria, read the PR, and rejected the work on-chain. The worker then put real install and run commands on the same pull request. Because PatchCourt had already consumed the first claim, the buyer opened a second bounty on the same repo. The worker claimed that case, sent the same PR link, and GenLayer approved it. Settled work is `1`, rejected work is `1`, genuine-fix rate is `100%` because only settled work sits in that metric, and the in-app dispute form never offered either case as eligible.

That is the full path that was exercised: post → claim → submit PR → wallet judge → reject → update PR → new bounty → claim → submit → wallet judge → approve.
