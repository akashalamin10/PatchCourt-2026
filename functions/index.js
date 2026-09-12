const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { runInSandbox } = require("./src/testRunner/sandbox");
const { resolveVerdict, outcomeFromVerdict } = require("./src/genlayerBridge/verdictHandler");
const { updateReputation } = require("./src/reputation/updateScore");

initializeApp();

exports.onSubmissionCreated = onDocumentCreated("submissions/{submissionId}", async (event) => {
  const db = getFirestore();
  const submission = event.data.data();
  const submissionRef = event.data.ref;

  const bountyRef = db.collection("bounties").doc(submission.bountyId);
  const bountySnap = await bountyRef.get();
  if (!bountySnap.exists) return;
  const bounty = { id: bountySnap.id, ...bountySnap.data() };

  const testResult = await runInSandbox(bounty.repoUrl, submission.branchLink);
  await submissionRef.update({
    testResult: testResult.status,
    testLog: testResult.log
  });

  const verdict = await resolveVerdict(bounty, submission, testResult);
  const outcome = outcomeFromVerdict(verdict);

  await bountyRef.update({ status: outcome, verdict });
  await submissionRef.update({ verdict });
  await updateReputation(submission.workerId, verdict);
});
