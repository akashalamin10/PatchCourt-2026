import { db } from "../config/firebase-config.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { markUnderReview } from "./bounty.js";

export async function createDispute(bountyId, raisedBy, reason, notes) {
  const ref = await addDoc(collection(db, "disputes"), {
    bountyId,
    raisedBy,
    reason,
    notes: notes || "",
    status: "pending",
    createdAt: serverTimestamp()
  });
  // Reopens the bounty for re-judging (buyer or claimed worker can already
  // do this per the existing bounties security rule) -- this is what turns
  // "raise a dispute" from a log entry into something that actually gets a
  // fresh verdict, via the same Approve/Reject or wallet-judge buttons on
  // the bounty-detail page.
  await markUnderReview(bountyId);
  return ref;
}

export function watchDisputesByUser(uid, callback) {
  const q = query(
    collection(db, "disputes"),
    where("raisedBy", "==", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export const disputeStatusBadge = {
  pending: "badge-open",
  under_review: "badge-review",
  ai_judged: "badge-claimed",
  resolved: "badge-settled"
};

export const disputeStatusLabel = {
  pending: "Pending",
  under_review: "Under review",
  ai_judged: "AI-judged",
  resolved: "Resolved"
};

export const disputeReasons = [
  "Suspected test-gaming",
  "Incomplete fix",
  "Unrelated regression introduced",
  "Disagreement on acceptance criteria"
];
