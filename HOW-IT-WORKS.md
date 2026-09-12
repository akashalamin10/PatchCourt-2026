# PatchCourt — How the whole project works

## The idea in one line

A buyer posts a bug bounty (a broken piece of code + a description of the
issue). A worker fixes it and submits a patch. Instead of trusting either
side's word for it, an AI (running as a GenLayer "Intelligent Contract"
validator) reads the diff and the explanation and decides whether the fix
is genuine, fake ("gamed" the test), or partial — and that decision, plus
who paid whom, is impossible to fake because it's public and reproducible.

## The moving pieces

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  Frontend   │ ───► │  Firebase         │ ───► │  GenLayer contract   │
│ (this repo) │      │  Auth + Firestore │      │  (the AI judge)      │
└─────────────┘      └──────────────────┘      └─────────────────────┘
                             ▲                            ▲
                             │                            │
                    (free pipeline, optional)     (direct wallet call,
                    Cloudflare Worker              optional — user's own
                    + GitHub Actions               MetaMask/Rabby/etc.)
```

### 1. Frontend (`/public`)

Plain HTML/CSS/JS, no build step, no framework. Pages:

- `login.html` / `signup.html` — email+password or Google sign-in, with a
  role toggle (buyer / worker) stored on the user's profile document.
- `dashboard.html` — stats + a list of the user's bounties.
- `bounty-board.html` — browse open bounties, post a new one (buyers),
  claim one (workers).
- `submit-patch.html` — a worker submits a branch/PR link + explanation
  against a bounty they've claimed.
- `bounty-detail.html` — the actual judging screen. Shows every submission
  for a bounty, and however the verdict gets decided (see below), it's
  recorded and shown here with an on-chain proof link when applicable.
- `dispute.html` — either side can flag a verdict they disagree with; this
  reopens the bounty for a fresh judgment (same buttons on bounty-detail).
- `profile.html` — name, role, and reputation stats.

All of the actual logic lives in `/public/js/modules/*.js` (one file per
concern: auth, bounty, submission, dispute, wallet, direct-judge). Pages
just import what they need and wire it to the DOM.

### 2. Firebase (the database + accounts)

- **Auth**: email/password and Google sign-in.
- **Firestore**: four collections — `users`, `bounties`, `submissions`,
  `disputes`. `firestore.rules` enforces who can write what (e.g. only a
  bounty's buyer can set its verdict manually).
- **Hosting**: serves the static files in `/public`.

This all runs on Firebase's free Spark plan. No Cloud Functions are used
(Cloud Functions require the paid Blaze plan), which is why judging happens
one of two other ways instead:

### 3a. Judging path A — the free automated pipeline (no wallet needed)

```
submit patch ──► Cloudflare Worker ──► GitHub Actions ──► GenLayer ──► Firestore
```

See `/free-pipeline/README.md` for the full setup. In short: a Cloudflare
Worker (holding a GitHub token as a secret) triggers a GitHub Actions
workflow, which fetches the PR diff, asks the GenLayer contract to judge
it, and writes the verdict straight to Firestore using a Firebase service
account (which bypasses the security rules the same way a Cloud Function
would have).

This is optional — if `WORKER_URL` in
`public/js/config/pipeline-config.js` is left empty, submissions just sit
as "pending" until a human resolves them (path C, below).

### 3b. Judging path B — direct wallet judging (no backend at all)

If the buyer has a browser wallet (MetaMask, Rabby, OKX Wallet, Coinbase
Wallet — any of them, they all work the same way) and
`GENLAYER_CONTRACT_ADDRESS` is set in `pipeline-config.js`, the
bounty-detail page shows a "⚡ Judge with wallet" button. Clicking it:

1. Fetches the PR diff from GitHub directly in the browser.
2. Loads `genlayer-js` from a CDN (esm.sh) and calls `submit_verdict` on
   the contract, signed by the connected wallet.
3. Reads the verdict back and writes it to Firestore.

No secret keys anywhere — the user's own wallet signs its own transaction.

### 3c. Judging path C — manual (always available, zero setup)

If neither A nor B is configured, the buyer can just click Approve/Reject
on the bounty-detail page themselves. This always works, on any Firebase
project, with zero extra setup — it's the guaranteed fallback.

### 4. The GenLayer contract (`contracts/patch_court_contract.py`)

A GenLayer "Intelligent Contract" — Python code that runs across multiple
independent validator nodes, each of which asks an LLM to judge the same
diff + explanation, and only accepts the result if enough validators agree
(GenLayer's "Equivalence Principle"). This is what makes the verdict
trustworthy instead of just "an API call to one AI."

Storage is a `TreeMap[str, str]` of JSON-encoded bounty records — this
specific shape (rather than typed dataclasses) is what got the contract to
actually deploy without a schema error; see the commit history / chat for
the debugging trail if you ever need to modify it.

### 5. Wallet connect (`public/js/modules/wallet.js`)

Works with any EIP-1193 browser wallet extension (MetaMask, Rabby, OKX
Wallet, Coinbase Wallet, Brave Wallet) with one code path, because they all
inject `window.ethereum` the same way. No wallet library, no paid service.
