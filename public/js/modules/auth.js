import { auth, db } from "../config/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function signUp(name, email, password, role) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, "users", credential.user.uid), {
    name,
    email,
    role,
    reputation: {
      genuineFixRate: 100,
      disputeRate: 0,
      avgTurnaround: 0,
      bondForfeitures: 0
    },
    createdAt: Date.now()
  });
  return credential.user;
}

export async function logIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle(defaultRole) {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const existing = await getUserProfile(credential.user.uid);

  if (!existing) {
    await setDoc(doc(db, "users", credential.user.uid), {
      name: credential.user.displayName || "",
      email: credential.user.email,
      role: defaultRole || "buyer",
      reputation: {
        genuineFixRate: 100,
        disputeRate: 0,
        avgTurnaround: 0,
        bondForfeitures: 0
      },
      createdAt: Date.now()
    });
  }

  return credential.user;
}

export async function logOut() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserName(user, name) {
  await updateProfile(user, { displayName: name });
  await setDoc(doc(db, "users", user.uid), { name }, { merge: true });
}

export function mapAuthError(error) {
  const code = error && error.code ? error.code : "";
  const messages = {
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "That password doesn't match.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/account-exists-with-different-credential": "This email is already linked to a different sign-in method."
  };
  return messages[code] || "Something went wrong. Please try again.";
}
