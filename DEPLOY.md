# PatchCourt — Full deploy guide (100% free)

Everything below uses only free tiers: Firebase Spark, Cloudflare Workers
free plan, GitHub Actions free minutes, and GenLayer Studionet. Nothing
here requires a credit card or a paid plan.

## What you need before starting

- [Node.js](https://nodejs.org) (LTS) installed
- A Firebase account (Google account)
- A GitHub account
- A Cloudflare account ([dash.cloudflare.com](https://dash.cloudflare.com), free)
- A browser wallet extension (MetaMask, Rabby, OKX Wallet, etc.) — only
  needed if you want direct wallet judging (Path B); skip if you only want
  the automated pipeline (Path A) or manual review (Path C)

## Part 1 — Deploy the frontend to Firebase Hosting

```bash
cd patchcourt          # the folder with firebase.json in it
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,hosting
```

The project is already linked via `.firebaserc`, so no `firebase use` step
is needed. Your site is now live.

## Part 2 — Deploy the GenLayer contract

1. Go to [studio.genlayer.com](https://studio.genlayer.com)
2. New Contract → paste the contents of `contracts/patch_court_contract.py`
3. Deploy (leave Execution Mode as "Normal (Full Consensus)")
4. Copy the **Contract Address** it gives you — you'll need it twice below

## Part 3 — Enable direct wallet judging (Path B)

1. Open `public/js/config/pipeline-config.js`
2. Set `GENLAYER_CONTRACT_ADDRESS` to the address from Part 2
3. Redeploy: `firebase deploy --only hosting`

That's it for Path B — no other account or secret is needed, because the
buyer's own connected wallet signs the transaction.

## Part 4 — Enable the automated free pipeline (Path A, optional)

Skip this if Path B (wallet judging) and Path C (manual Approve/Reject) are
enough for you. Full detail in `/free-pipeline/README.md`; short version:

1. **Firebase service account**: Firebase Console → Project settings →
   Service accounts → Generate new private key → copy the whole JSON.
2. **GitHub repo**: push this project to a GitHub repo if you haven't.
3. **GitHub repo secrets** (repo → Settings → Secrets and variables →
   Actions):
   - `FIREBASE_SERVICE_ACCOUNT` — the JSON from step 1
   - `GENLAYER_CONTRACT_ADDRESS` — the address from Part 2
   - (`GENLAYER_RPC_URL` — leave unset, StudioNet's default is used)
4. **GitHub personal access token** (fine-grained, this repo only,
   Contents: read, Actions: read and write) — used only by the Cloudflare
   Worker to trigger the workflow.
5. **Cloudflare Worker**: dash.cloudflare.com → Workers & Pages → Create
   Worker → paste `free-pipeline/cloudflare-worker.js` → Settings →
   Variables and Secrets → add `GITHUB_TOKEN` (the token from step 4,
   encrypted), `GITHUB_OWNER`, `GITHUB_REPO` → Deploy. Copy the
   `*.workers.dev` URL.
6. Put that URL into `WORKER_URL` in `public/js/config/pipeline-config.js`,
   then `firebase deploy --only hosting` again.

## Part 5 — Test everything end to end

1. Open your live site → sign up as a buyer → post a bounty (repo,
   issue description, reward, acceptance criteria)
2. Sign up as a worker (separate browser/incognito) → claim the bounty →
   submit a patch (a real GitHub PR link works best, so the diff can be
   fetched)
3. On the bounty-detail page (as the buyer):
   - If you set up Path B: connect your wallet, click "⚡ Judge with
     wallet", approve the transaction in your wallet, wait for the
     verdict.
   - If you set up Path A: wait a minute, check the repo's **Actions**
     tab for a "PatchCourt Judge" run, then refresh the page.
   - Otherwise: click Approve/Reject yourself.
4. Confirm in Firebase Console → Firestore that the submission's `verdict`
   field and the bounty's `status` updated.
5. If a verdict came from GenLayer (Path A or B), you'll see a "View on
   GenLayer Explorer" link on the submission — click it to see the
   on-chain transaction as proof.
6. Try the dispute flow: from either account, go to Disputes → raise one
   against that bounty → it reopens on bounty-detail for a fresh verdict.

## Troubleshooting

- **"Could not load contract schema" in GenLayer Studio** — this means the
  Python file itself is invalid to GenVM (not a deploy-time issue). See the
  comments at the top of `contracts/patch_court_contract.py`; it already
  reflects several rounds of fixes for this. If you modify the contract,
  keep write methods returning `None`, keep `TreeMap[str, str]` storage
  with JSON-encoded values, and keep return types like `list[str]` fully
  parameterized (never bare `list`).
- **GitHub Actions run fails** — check the run's log in the Actions tab;
  the most common cause is a missing/incorrect secret in Part 4.
- **Wallet judging button doesn't appear** — it only shows for the bounty's
  buyer, when the bounty is still open for judging, and only after
  `GENLAYER_CONTRACT_ADDRESS` is set.



