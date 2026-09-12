async function fetchDiff(branchLink) {
  const match = branchLink.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;

  const [, owner, repo, pullNumber] = match;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.text();
}

module.exports = { fetchDiff };
