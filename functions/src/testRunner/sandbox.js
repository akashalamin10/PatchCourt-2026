const { runSandboxedTest } = require("./runTests");

function withTimeout(fn, ms) {
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Sandbox timed out")), ms))
  ]);
}

function runInSandbox(repoUrl, branchLink, timeoutMs = 60000) {
  return withTimeout(() => runSandboxedTest(repoUrl, branchLink), timeoutMs);
}

module.exports = { runInSandbox };
