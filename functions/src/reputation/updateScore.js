const { getFirestore, FieldValue } = require("firebase-admin/firestore");

async function updateReputation(workerId, verdict) {
  const db = getFirestore();
  const userRef = db.collection("users").doc(workerId);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists) return;

    const data = snap.data();
    const reputation = data.reputation || {
      genuineFixRate: 100,
      disputeRate: 0,
      avgTurnaround: 0,
      bondForfeitures: 0
    };

    const totalCases = (reputation.totalCases || 0) + 1;
    const genuineCases = (reputation.genuineCases || 0) + (verdict === "APPROVED" || verdict === "PARTIAL" ? 1 : 0);
    const rejectedCases = (reputation.rejectedCases || 0) + (verdict === "REJECTED" ? 1 : 0);

    transaction.update(userRef, {
      "reputation.totalCases": totalCases,
      "reputation.genuineCases": genuineCases,
      "reputation.rejectedCases": rejectedCases,
      "reputation.genuineFixRate": Math.round((genuineCases / totalCases) * 100),
      "reputation.disputeRate": Math.round((rejectedCases / totalCases) * 100),
      "reputation.updatedAt": FieldValue.serverTimestamp()
    });
  });
}

module.exports = { updateReputation };
