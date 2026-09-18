# PatchCourt — Architecture

## Layers

| Layer | Responsibility | Where |
|---|---|---|
| Application | Wallet dapp, bounty board, case docket, dashboard | `public/` on Studio Next, static hosting, no backend |
| Trust | AI-judged verdict on submitted patches | `contracts/patch_court_contract.py` (GenLayer, Equivalence Principle) |
| Settlement | Escrow lock, split calculation, withdrawable credit ledger | `contracts/patch_court_contract.py` + `contracts/escrow_logic.py` |
| Identity | The connected wallet address, nothing else | `public/js/wallet.js` |

## Data flow

1. Buyer posts a bounty and sends the reward as native value in the same transaction (`post_bounty`, payable). The value is locked in the contract; nothing settles until a verdict is written.
2. A different address claims it as the worker (`claim_bounty`). The buyer cannot claim their own bounty.
3. The worker submits a diff, explanation, and test log (`submit_patch`). This flips the bounty to `under_review`.
4. Anyone can trigger judgment (`submit_verdict`). GenLayer validators independently run the same prompt against the issue, acceptance criteria, explanation, test log, and diff, and reach consensus on one verdict via the Equivalence Principle.
5. `APPROVED` settles 100% to the worker, `PARTIAL` splits 70/30, `REJECTED` refunds the buyer in full. The split is credited to each address's balance — no external call happens yet.
6. Either party can call `withdraw()` at any time afterward to pull their own credited balance.
7. `raise_dispute` flags a settled/rejected case for a follow-up `submit_verdict` call; it does not re-allocate already-credited funds.

## State

Everything lives on the contract, in two JSON-encoded fields:

- `bounties_json`: `{ bounty_id: { buyer, worker, repo_url, issue_description, acceptance_criteria, reward, status, diff_text, explanation, test_log, verdict, verdict_reason, worker_share_bps, buyer_refund_bps, credited } }`
- `credits_json`: `{ address: withdrawable_amount }`

The frontend never stores bounty or credit data itself — the Dashboard page reads both directly from the contract on every visit and filters client-side by the connected address.
