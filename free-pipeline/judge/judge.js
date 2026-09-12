// Runs inside the GitHub Actions job (.github/workflows/judge.yml).
//
// Simpler than an earlier version of this file: instead of cloning the
// submitted repo and running `npm test` (fragile -- assumes every repo is a
// Node project with a working test script), this fetches just the diff text
// and lets GenLayer's own AI validators judge it against the issue and the
// worker's explanation -- the same approach the AgentDeal reference project
// uses (judge the evidence with the LLM, don't try to re-execute the work).
//
// Ported from functions/src/genlayerBridge/verdictHandler.js and
// functions/src/reputation/updateScore.js so it runs without Cloud
// Functions / the Blaze plan.

const admin = require("firebase-admin");
const { createClient, createAccount } = require("genlayer-js");
const { studionet, testnetAsimov } = require("genlayer-js/chains");

function outcomeFromVerdict(verdict) {
  if (verdict === "APPROVED" || verdict === "PARTIAL") return "settled";
  return "rejected";
}

async function fetchDiff(branchLink) {
  const match = (branchLink || "").match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    return "(No pull request link was provided, so no diff could be fetched automatically.)";
  }
  const [, owner, repo, pullNumber] = match;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_API_TOKEN}`,
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "patchcourt-judge"
    }
  });
  if (!response.ok) {
    return `(Could not fetch the diff from GitHub -- API responded with ${response.status}.)`;
  }
  const text = await response.text();
  return text.slice(0, 6000);
}

async function getVerdictFromGenLayer(bountyId, issueDescription, acceptanceCriteria, diffText, explanation) {
  const chain = process.env.GENLAYER_NETWORK === "testnet" ? testnetAsimov : studionet;
  const account = createAccount();
  const clientConfig = { chain, account };
  // Both networks already know their own RPC endpoint. GENLAYER_RPC_URL is
  // only needed if you're pointing at a custom/self-hosted node.
  if (process.env.GENLAYER_RPC_URL) {
    clientConfig.endpoint = process.env.GENLAYER_RPC_URL;
  }
  const client = createClient(clientConfig);
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS;

  const receipt = await client.writeContract({
    address: contractAddress,
    functionName: "submit_verdict",
    args: [
      bountyId,
      issueDescription,
      acceptanceCriteria,
      diffText,
      explanation,
      "No automated test suite was run for this submission -- the verdict is based on the diff and explanation only."
    ]
  });
  await client.waitForTransactionReceipt({ hash: receipt });

  const result = await client.readContract({
    address: contractAddress,
    functionName: "get_bounty",
    args: [bountyId]
  });

  return (result && result.verdict) || "REJECTED";
}

async function main() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const bountyId = process.env.BOUNTY_ID;
  const submissionId = process.env.SUBMISSION_ID;
  const workerId = process.env.WORKER_ID;
  const branchLink = process.env.BRANCH_LINK || "";
  const explanation = process.env.EXPLANATION || "";

  const bountySnap = await db.collection("bounties").doc(bountyId).get();
  const bountyData = bountySnap.exists ? bountySnap.data() : {};
  const issueDescription = bountyData.issueDescription || "";
  const acceptanceCriteria = bountyData.acceptanceCriteria || "";

  const diffText = await fetchDiff(branchLink);
  const verdict = await getVerdictFromGenLayer(bountyId, issueDescription, acceptanceCriteria, diffText, explanation);
  const outcome = outcomeFromVerdict(verdict);

  await db.collection("submissions").doc(submissionId).update({
    testResult: "judged",
    verdict
  });

  await db.collection("bounties").doc(bountyId).update({
    status: outcome,
    verdict
  });

  const userRef = db.collection("users").doc(workerId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists) return;

    const data = snap.data();
    const reputation = data.reputation || {
      genuineFixRate: 100,
      disputeRate: 0,
      avgTurnaround: 0,
      bondForfeitures: 0
    };

    const totalCases = (reputation.totalCases || 0) + 1;
    const genuineCases = (reputation.genuineCases || 0) + (verdict === "APPROVED" || verdict === "PARTIAL" ? 1 : 0);
    const rejectedCases = (reputation.rejectedCases || 0) + (verdict === "REJECTED" ? 1 : 0);

    transaction.update(userRef, {
      "reputation.totalCases": totalCases,
      "reputation.genuineCases": genuineCases,
      "reputation.rejectedCases": rejectedCases,
      "reputation.genuineFixRate": Math.round((genuineCases / totalCases) * 100),
      "reputation.disputeRate": Math.round((rejectedCases / totalCases) * 100),
      "reputation.updatedAt": admin.firestore.FieldValue.serverTimestamp()
    });
  });

  console.log(`Verdict: ${verdict} -> bounty ${bountyId} marked ${outcome}`);
}

main().catch((error) => {
  console.error("Judging failed:", error);
  process.exit(1);
});
