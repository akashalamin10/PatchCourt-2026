const { createClient } = require("genlayer-js");
const { studionet, testnetAsimov } = require("genlayer-js/chains");

function getClient() {
  const chain = process.env.GENLAYER_NETWORK === "testnet" ? testnetAsimov : studionet;
  return createClient({ chain, endpoint: process.env.GENLAYER_RPC_URL });
}

async function getVerdict(bounty, submission, testResult) {
  const client = getClient();
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS;

  const receipt = await client.writeContract({
    address: contractAddress,
    functionName: "submit_verdict",
    args: [
      bounty.id,
      bounty.issueDescription,
      bounty.acceptanceCriteria,
      submission.branchLink,
      submission.explanation,
      testResult.log.join("\n")
    ]
  });

  await client.waitForTransactionReceipt({ hash: receipt });

  const verdict = await client.readContract({
    address: contractAddress,
    functionName: "get_bounty",
    args: [bounty.id]
  });

  return verdict.verdict || "REJECTED";
}

module.exports = { getVerdict };
