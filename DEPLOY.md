# Deploying and verifying PatchCourt

Target network — this is what the hackathon requires and what the app is hardcoded to:

| | |
|---|---|
| Network | GenLayer Studio Next |
| RPC | `https://studio-next.genlayer.com/api` |
| Chain ID | `61997` |
| Explorer | `https://explorer-studio-next.genlayer.com/` , 'https://explorer-studio-dev.genlayer.com/address/0x01d1F9DB4C241722DAC9Af73568ffDCa52598B75'|

---

## 1. Fund a wallet on Studio Next

Add the network to MetaMask (the app will offer to do this for you on first connect), then get Studio Next GEN from the GenLayer faucet. You need at least two accounts to demo the full flow — one buyer, one worker — because the contract blocks a buyer from claiming their own bounty.

## 2. Deploy the contract

Deploy `contracts/patch_court_contract.py` using the GenLayer CLI or Studio's UI, pointed at the RPC above.

**If deploy fails on the `Depends` line:** the first line of the contract pins an exact py-genlayer runtime hash. If Studio Next reports that hash as unknown, replace it with the hash your CLI/Studio reports for the current release. Do **not** change it to `py-genlayer:latest` — a floating tag can resolve to different builds on different validators, which breaks consensus in a way that's very hard to debug. (`tests/test_no_drift.py` will fail if you do.)

## 3. Point the frontend at your deployment

```bash
cd public
python3 -m http.server 8080
```

Open `http://localhost:8080/pages/setup.html`, paste the deployed address, save. It's stored in your browser's local storage only.

Firebase Hosting is configured with `cleanUrls: true`, so these are the same page after deploy:

- `/pages/dashboard.html` (always works, including local `python -m http.server`)
- `/pages/dashboard` (works on Firebase only — this was the buyer 404)

Do not bookmark `/pages/dashboard` for local Python serving; use the `.html` form. After `firebase deploy`, both work. Short aliases `/dashboard`, `/board`, `/post`, `/setup`, `/verify` also redirect on Firebase.

Optionally, bake it in instead by setting `window.PATCHCOURT_CONTRACT_ADDRESS` before the module script loads — useful if you're deploying the frontend somewhere public for judges.

## 4. Walk the happy path

With **account A** (buyer):

1. **Post** → case id `demo-1`, any repo URL, an issue, acceptance criteria, reward `12`. One transaction; the reward is escrowed by the same call.

Switch to **account B** (worker) via the wallet chip → Switch account:

2. **Claim** the case from its docket page.
3. **Submit patch** — paste a diff that changes *production* code. Something like:

```diff
--- a/src/refund.py
+++ b/src/refund.py
@@ -3,6 +3,6 @@ def refund(total, already_paid):
-    return total
+    return total - already_paid
```

4. **Judge with GenLayer.** This is the slow step — validators are each running the prompt. Keep the tab open. Expect `APPROVED`.
5. **Dashboard** → the worker should now show withdrawable credit equal to the full reward.

## 5. Two things to verify on-chain before recording your demo

**a) Does `withdraw()` actually move value?**

Run Withdraw from the Dashboard, then check the account balance on the explorer. `withdraw()` uses `emit_transfer` through a ghost-contract interface, which is the documented correct primitive for paying an EOA from an Intelligent Contract — but there have been GenLayer networks where this reports success without moving anything. Find out here, with a 12-wei bounty, not live on camera.

**b) Does `submit_verdict` need explicit fees?**

Studio Next includes fees. `genlayer-client.js` already tries to attach a fee estimate to every write, but it skips silently if the SDK build doesn't expose an estimator. If `submit_verdict` reverts with a fee error, that's the path to look at.

## 6. Prove the interesting case

This is the one worth putting in the demo video, because it's the part CI can't do.

Post a second bounty. As the worker, submit a diff that only weakens the test — no production change:

```diff
--- a/tests/test_refund.py
+++ b/tests/test_refund.py
@@ -10,7 +10,7 @@ def test_partial_refund():
-    assertEqual(result, 42)
+    assertTrue(result > 0)
```

Judge it. Two things should happen:

- The case docket shows an amber screening warning — the automated screen caught the pattern.
- The validator verdict comes back `REJECTED`, and the buyer gets a full refund.

The test log can honestly say `PASS`. That's the whole point: the tests pass, and the patch is still rejected.

## 7. Submit

- Portal submission can happen any time during the build period — submit early so you have room to respond to reviewer notes.
- The demo video is mandatory even though the form labels it optional.
- Point judges at `/pages/verify.html` — it's written for them, and walks through checking a verdict on the explorer.
