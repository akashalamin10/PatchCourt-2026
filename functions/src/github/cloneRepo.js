const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function cloneToTempDir(repoUrl, branch) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchcourt-"));
  execSync(`git clone --depth 1 ${repoUrl} ${workDir}`, { stdio: "pipe" });

  if (branch) {
    execSync(`git fetch origin ${branch} --depth 1`, { cwd: workDir, stdio: "pipe" });
    execSync("git checkout FETCH_HEAD", { cwd: workDir, stdio: "pipe" });
  }

  return workDir;
}

module.exports = { cloneToTempDir };
