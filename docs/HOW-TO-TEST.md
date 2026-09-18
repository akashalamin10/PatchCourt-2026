# How to test PatchCourt after this fix

## A. Unit tests (no wallet)

```bash
cd contracts
python3 -m pytest tests/ -q
```

Expect 7 passed.

## B. Contract on Studio Next

1. https://studio-dev.genlayer.com
2. Deploy `contracts/patch_court_contract.py`
3. In Studio, call `post_bounty` with:
   - bounty_id: `demo-1`
   - repo_url: `https://github.com/demo/payments-service`
   - issue_description: `partial refunds are wrong`
   - reward: `12`
   - acceptance_criteria: `fix refund math, do not weaken tests`
4. Call `get_bounty("demo-1")` and confirm status `open`

## C. Frontend end-to-end

1. `cd public && python3 -m http.server 8080`
2. http://localhost:8080/pages/setup.html
3. Paste contract address → Save → Ping contract
4. Connect wallet on chain 61997
5. http://localhost:8080/pages/post-bounty.html
6. Click **Prefill gaming case** → Post on GenLayer → approve wallet
7. Open the case → Claim
8. Submit patch → **Use test-gaming diff** → submit
9. Case docket → **Judge with GenLayer**
10. Wait. Status should become `rejected`, verdict `REJECTED`, buyer refund 10000 bps
11. New bounty with **Prefill genuine case**
12. Genuine diff → Judge → `APPROVED`, worker share 10000 bps
13. Click the explorer link and match the tx

## D. What "working" looks like

- Setup ping returns an owner address
- Board lists the bounty you just posted
- Detail page shows issue / diff / verdict from `get_bounty`
- Explorer shows the write tx on chain 61997
- Gaming diff is rejected even though the test log says PASS

## E. Demo video script

Record 2–3 minutes:

1. Landing page + why GenLayer
2. Setup: address + chain 61997
3. Gaming path → REJECTED
4. Genuine path → APPROVED
5. Explorer proof

## Common failures

| Symptom | Fix |
|---|---|
| Ping fails | Wrong address, or still on Studionet 61999 |
| Wallet popup never appears | Install MetaMask/Rabby, allow the site |
| writeContract fee error | Studio faucet GEN, keep the RC SDK, retry |
| Verdict pending a long time | Consensus is doing LLM work; wait and refresh get_bounty |
| Board empty | Use the same browser that posted, or list_bounty_ids after finalization |
