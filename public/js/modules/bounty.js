import { db } from "../config/firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function createBounty(buyerId, data) {
  return addDoc(collection(db, "bounties"), {
    repoUrl: data.repoUrl,
    issueDescription: data.issueDescription,
    reward: data.reward,
    deadline: data.deadline,
    acceptanceCriteria: data.acceptanceCriteria,
    buyerId,
    status: "open",
    createdAt: serverTimestamp()
  });
}

export async function getBounty(bountyId) {
  const snap = await getDoc(doc(db, "bounties", bountyId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchBuyerBounties(buyerId, callback) {
  const q = query(
    collection(db, "bounties"),
    where("buyerId", "==", buyerId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export function watchWorkerBounties(workerId, callback) {
  const q = query(
    collection(db, "bounties"),
    where("claimedBy", "==", workerId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export function watchOpenBounties(callback) {
  const q = query(
    collection(db, "bounties"),
    where("status", "==", "open"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
  });
}

export async function claimBounty(bountyId, workerId) {
  return updateDoc(doc(db, "bounties", bountyId), {
    status: "claimed",
    claimedBy: workerId,
    claimedAt: serverTimestamp()
  });
}

export async function markUnderReview(bountyId) {
  return updateDoc(doc(db, "bounties", bountyId), {
    status: "under_review"
  });
}

export async function settleBounty(bountyId) {
  return updateDoc(doc(db, "bounties", bountyId), {
    status: "settled"
  });
}

export async function rejectBounty(bountyId) {
  return updateDoc(doc(db, "bounties", bountyId), {
    status: "rejected"
  });
}

export const statusBadgeClass = {
  open: "badge-open",
  claimed: "badge-claimed",
  under_review: "badge-review",
  settled: "badge-settled",
  rejected: "badge-rejected"
};

export const statusLabel = {
  open: "Open",
  claimed: "Claimed",
  under_review: "Under review",
  settled: "Settled",
  rejected: "Rejected"
};
