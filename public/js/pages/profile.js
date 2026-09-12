import { watchAuth, getUserProfile, updateUserName, logOut } from "../modules/auth.js";
import { formatPercent } from "../utils/formatters.js";
import { showToast } from "../components/toast.js";
import { mountWalletChip } from "../components/wallet-widget.js";

mountWalletChip(document.getElementById("walletChipContainer"));

const logoutBtn = document.getElementById("logoutBtn");
const profileForm = document.getElementById("profileForm");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileRole = document.getElementById("profileRole");
const profileSaveBtn = document.getElementById("profileSaveBtn");
const profileFixRate = document.getElementById("profileFixRate");
const profileDisputeRate = document.getElementById("profileDisputeRate");
const profileTurnaround = document.getElementById("profileTurnaround");
const profileForfeitures = document.getElementById("profileForfeitures");

logoutBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  await logOut();
  window.location.href = "/pages/login.html";
});

let currentUser = null;

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  profileSaveBtn.disabled = true;
  profileSaveBtn.textContent = "Saving…";
  try {
    await updateUserName(currentUser, profileName.value.trim());
    showToast("Profile updated.", "success");
  } catch (error) {
    showToast("Could not update your profile.", "error");
  } finally {
    profileSaveBtn.disabled = false;
    profileSaveBtn.textContent = "Save changes";
  }
});

watchAuth(async (user) => {
  document.getElementById("initialSpinner")?.remove();
  if (!user) {
    window.location.href = "/pages/login.html";
    return;
  }
  currentUser = user;

  const profile = await getUserProfile(user.uid);
  profileName.value = (profile && profile.name) || user.displayName || "";
  profileEmail.value = user.email || "";
  profileRole.value = profile ? (profile.role === "buyer" ? "Buyer" : "Worker") : "—";

  if (profile && profile.reputation) {
    profileFixRate.textContent = formatPercent(profile.reputation.genuineFixRate);
    profileDisputeRate.textContent = formatPercent(profile.reputation.disputeRate);
    profileTurnaround.textContent = profile.reputation.avgTurnaround ? `${profile.reputation.avgTurnaround}h` : "—";
    profileForfeitures.textContent = profile.reputation.bondForfeitures ?? "0";
  }
});
