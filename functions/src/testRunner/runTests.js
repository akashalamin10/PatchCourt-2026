const { execSync } = require("child_process");
const fs = require("fs");
const { cloneToTempDir } = require("../github/cloneRepo");

function extractBranchRef(branchLink) {
  if (!branchLink) return null;
  const match = branchLink.match(/tree\/([^/]+)/);
  return match ? match[1] : null;
}

function runSandboxedTest(repoUrl, branchLink) {
  const log = [];
  let workDir;

  try {
    workDir = cloneToTempDir(repoUrl, extractBranchRef(branchLink));
    log.push(`Cloned ${repoUrl}`);

    execSync("npm install --silent", { cwd: workDir, stdio: "pipe" });
    log.push("Installed dependencies");

    execSync("npm test --silent", { cwd: workDir, stdio: "pipe" });
    log.push("Test suite passed");

    return { status: "pass", suspicious: false, log };
  } catch (error) {
    log.push("Test suite failed or errored");
    return { status: "fail", suspicious: false, log, error: String(error.message || error) };
  } finally {
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  }
}

module.exports = { runSandboxedTest };
