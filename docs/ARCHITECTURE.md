# PatchCourt — Architecture

## Layers

| Layer | Responsibility | Where |
|---|---|---|
| Application | Auth, bounty board UI, repository integration | `public/` (Firebase Hosting) |
| Verification | Sandboxed test run producing pass/fail/partial | `functions/src/testRunner/` |
| Trust | AI-judged verdict on ambiguous or disputed cases | `contracts/patch_court_contract.py` (GenLayer) |
| Settlement | Escrow release, refund, or partial split | `contracts/escrow_logic.py` + bounty status |
| Reputation | On-chain-style track record per user | `functions/src/reputation/` + `users/{uid}.reputation` |

## Data flow

1. Buyer posts a bounty (`bounties` collection, status `open`).
2. Worker claims it (`status: claimed`, `claimedBy` set).
3. Worker submits a patch (`submissions` collection). This flips the bounty to `under_review`.
4. A Firestore trigger (`functions/index.js: onSubmissionCreated`) runs the sandboxed test suite.
5. If the result is a clean pass, the bounty auto-settles as `APPROVED`.
6. If it's ambiguous (failing, partial, or disputed), the Cloud Function calls the GenLayer contract's `submit_verdict` method, which uses the Equivalence Principle across validators to decide `APPROVED / REJECTED / PARTIAL`.
7. The bounty and submission update with the verdict; the worker's reputation updates in the same flow.

## Collections

- `users/{uid}`: name, email, role, reputation
- `bounties/{id}`: repoUrl, issueDescription, reward, deadline, acceptanceCriteria, buyerId, status, claimedBy, verdict
- `submissions/{id}`: bountyId, workerId, branchLink, explanation, testResult, verdict
- `disputes/{id}`: bountyId, raisedBy, reason, notes, status
