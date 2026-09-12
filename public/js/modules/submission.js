import { db } from "../config/firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { markUnderReview, settleBounty, rejectBounty, getBounty } from "./bounty.js";
import { WORKER_URL } from "../config/pipeline-config.js";

// Fire-and-forget call to the free judging pipeline (Cloudflare Worker ->
// GitHub Actions -> GenLayer -> Firestore). If WORKER_URL isn't set up yet,
// or the call fails for any reason, this quietly does nothing — the buyer
// can still Approve/Reject manually from the bounty-detail page.
async function triggerJudging(payload) {
  if (!WORKER_URL) return;
  try {
    await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn("Judging pipeline unreachable, falling back to manual review.", error);
  }
}

export async function createSubmission(bountyId, workerId, data) {
  const submissionRef = await addDoc(collection(db, "submissions"), {
    bountyId,
    workerId,
    branchLink: data.branchLink,
    explanation: data.explanation,
    testResult: "pending",
    createdAt: serverTimestamp()
  });
  await markUnderReview(bountyId);

  const bounty = await getBounty(bountyId);
  triggerJudging({
    bountyId,
    submissionId: submissionRef.id,
    repoUrl: bounty ? bounty.repoUrl : "",
    branchLink: data.branchLink,
    explanation: data.explanation,
    workerId
  });
}

export function watchSubmissionsByWorker(workerId, callback) {
  const q = query(
    collection(db, "submissions"),
    where("workerId", "==", workerId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

// Manual verdict path. On a Firebase free (Spark) plan, Cloud Functions
// cannot be deployed, so there is no automated sandbox test / GenLayer
// judging happening in the background. This lets the buyer decide the
// outcome directly from the app so the bounty flow can still complete
// end-to-end. Swap this out once Cloud Functions are live on a Blaze plan.
export async function approveSubmission(submissionId, bountyId) {
  await updateDoc(doc(db, "submissions", submissionId), {
    verdict: "approved",
    testResult: "approved"
  });
  await settleBounty(bountyId);
}

export async function rejectSubmission(submissionId, bountyId) {
  await updateDoc(doc(db, "submissions", submissionId), {
    verdict: "rejected",
    testResult: "rejected"
  });
  await rejectBounty(bountyId);
}

// Records a verdict that came from a direct wallet-signed GenLayer call
// (see modules/direct-judge.js). Same effect as the manual/pipeline paths,
// plus the transaction hash so the bounty-detail page can link to the
// GenLayer explorer as proof.
export async function recordDirectVerdict(submissionId, bountyId, verdict, txHash) {
  const outcome = verdict === "APPROVED" || verdict === "PARTIAL" ? "settled" : "rejected";
  await updateDoc(doc(db, "submissions", submissionId), {
    verdict: outcome === "settled" ? "approved" : "rejected",
    testResult: "judged",
    genlayerVerdict: verdict,
    genlayerTxHash: txHash
  });
  if (outcome === "settled") {
    await settleBounty(bountyId);
  } else {
    await rejectBounty(bountyId);
  }
}

export function watchSubmissionsByBounty(bountyId, callback) {
  const q = query(
    collection(db, "submissions"),
    where("bountyId", "==", bountyId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}
