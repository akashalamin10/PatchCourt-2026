// PatchCourt free-tier judging trigger.
//
// This Worker's only job: receive a small POST from the PatchCourt frontend
// right after a patch is submitted, and forward it to GitHub as a
// `repository_dispatch` event. GitHub Actions then does the actual work
// (clone the repo, run tests, call GenLayer, write the verdict to Firestore).
//
// Why this exists: a GitHub token must never be shipped in frontend JS
// (anyone viewing the page could steal it). This Worker holds the token as a
// secret and is the only thing allowed to use it.
//
// Deploy: Cloudflare Dashboard -> Workers & Pages -> Create Worker -> paste
// this file -> Settings -> Variables -> add GITHUB_TOKEN (encrypted),
// GITHUB_OWNER, GITHUB_REPO.

function withCors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    if (request.method !== "POST") {
      return withCors(new Response("Method not allowed", { status: 405 }));
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return withCors(new Response("Invalid JSON body", { status: 400 }));
    }

    const { bountyId, submissionId, repoUrl, branchLink, explanation, workerId } = payload;
    if (!bountyId || !submissionId || !repoUrl || !workerId) {
      return withCors(new Response("Missing required fields", { status: 400 }));
    }

    const dispatchUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;

    const githubResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "patchcourt-worker",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_type: "patch-submitted",
        client_payload: { bountyId, submissionId, repoUrl, branchLink, explanation, workerId }
      })
    });

    if (!githubResponse.ok) {
      const text = await githubResponse.text();
      return withCors(new Response(`GitHub dispatch failed (${githubResponse.status}): ${text}`, { status: 502 }));
    }

    return withCors(
      new Response(JSON.stringify({ triggered: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
};
