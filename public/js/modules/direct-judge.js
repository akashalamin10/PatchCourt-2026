// Lets a connected wallet ask GenLayer to judge a patch directly from the
// browser -- no Cloudflare Worker, no GitHub Actions. The user's own wallet
// signs the transaction, so no backend secret key is involved at all.
//
// genlayer-js is loaded from esm.sh at call time (not bundled), so pages
// that never use this feature never pay the download cost, and the whole
// app still works even if this CDN import fails for some reason -- the
// Cloudflare/GitHub pipeline (or manual Approve/Reject) remains available
// as a fallback either way.

import { GENLAYER_CONTRACT_ADDRESS } from "../config/pipeline-config.js";
import { getProvider, GENLAYER_EXPLORER_URL } from "./wallet.js";

let genlayerModulePromise = null;

async function loadGenLayer() {
  if (!genlayerModulePromise) {
    genlayerModulePromise = Promise.all([
      import("https://esm.sh/genlayer-js"),
      import("https://esm.sh/genlayer-js/chains")
    ]);
  }
  return genlayerModulePromise;
}

export function isDirectJudgingConfigured() {
  return !!GENLAYER_CONTRACT_ADDRESS;
}

// Fetches a fresh diff for a GitHub pull request link, client-side, using
// GitHub's public API (no token -- fine for the occasional call a real
// user makes; the free-pipeline path uses an authenticated token for
// higher-volume automated use).
async function fetchDiff(branchLink) {
  const match = (branchLink || "").match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    return "(No pull request link was provided, so no diff could be fetched automatically.)";
  }
  const [, owner, repo, pullNumber] = match;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: { Accept: "application/vnd.github.v3.diff" }
  });
  if (!response.ok) {
    return `(Could not fetch the diff from GitHub -- API responded with ${response.status}.)`;
  }
  const text = await response.text();
  return text.slice(0, 6000);
}

// Runs the whole direct-judging flow and returns { verdict, txHash, explorerUrl }.
export async function judgeWithWallet({ address, bountyId, issueDescription, acceptanceCriteria, branchLink, explanation }) {
  if (!isDirectJudgingConfigured()) {
    throw new Error("Direct wallet judging isn't set up yet (missing GENLAYER_CONTRACT_ADDRESS).");
  }
  const provider = getProvider();
  if (!provider) {
    throw new Error("No wallet found. Connect a wallet first.");
  }

  const [{ createClient }, { studionet }] = await loadGenLayer();

  const client = createClient({
    chain: studionet,
    account: address,
    provider
  });

  const diffText = await fetchDiff(branchLink);
  const testLog = "No automated test suite was run for this submission -- the verdict is based on the diff and explanation only.";

  const txHash = await client.writeContract({
    address: GENLAYER_CONTRACT_ADDRESS,
    functionName: "submit_verdict",
    args: [bountyId, issueDescription, acceptanceCriteria, diffText, explanation, testLog]
  });

  await client.waitForTransactionReceipt({ hash: txHash });

  const result = await client.readContract({
    address: GENLAYER_CONTRACT_ADDRESS,
    functionName: "get_bounty",
    args: [bountyId]
  });

  const verdict = (result && result.verdict) || "REJECTED";
  const explorerUrl = `${GENLAYER_EXPLORER_URL}/tx/${txHash}`;

  return { verdict, txHash, explorerUrl };
}
