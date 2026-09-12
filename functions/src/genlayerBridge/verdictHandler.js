const { getVerdict } = require("./callContract");

async function resolveVerdict(bounty, submission, testResult) {
  if (testResult.status === "pass" && !testResult.suspicious) {
    return "APPROVED";
  }
  return getVerdict(bounty, submission, testResult);
}

function outcomeFromVerdict(verdict) {
  if (verdict === "APPROVED" || verdict === "PARTIAL") return "settled";
  return "rejected";
}

module.exports = { resolveVerdict, outcomeFromVerdict };
