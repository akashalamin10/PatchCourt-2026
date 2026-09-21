# How PatchCourt works after the Studio Next fix

```
Browser wallet (chain 61997)
        │
        ▼
public/ UI  --write-->  PatchCourt contract on Studio Next
        │                       │
        └── read get_bounty  ◄──┘
                                │
                     validators run submit_verdict
                     (Equivalence Principle)
```

On-chain methods:

- `post_bounty` — payable; buyer opens a case with issue, criteria, and reward, sending the reward as native value in the same call
- `claim_bounty` — a different address takes the case as worker (buyer cannot claim their own bounty)
- `submit_patch` — worker only; stores diff, explanation, test log
- `submit_verdict` — validators judge the stored evidence
- `withdraw` — pays out the caller's credited share
- `get_bounty` / `list_bounty_ids` / `get_credit` — public reads

Settlement is stored as basis points on the same record, then credited to each address's withdrawable balance:

- APPROVED → worker 10000 / buyer 0
- PARTIAL → 7000 / 3000
- REJECTED → 0 / 10000

That is the meaningful state reviewers asked for. The validator prompt checks the meaningful outcome: did the diff fix the bug, or only the test. There is no Firebase, no backend, and no account system — the connected wallet is the only identity, on every page including the dashboard.
