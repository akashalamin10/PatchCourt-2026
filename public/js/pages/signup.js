import { signUp, signInWithGoogle, mapAuthError } from "../modules/auth.js";
import { showToast } from "../components/toast.js";

const form = document.getElementById("signupForm");
const submitBtn = document.getElementById("submitBtn");
const googleBtn = document.getElementById("googleBtn");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmError = document.getElementById("confirmPasswordError");

function clearErrors() {
  nameError.textContent = "";
  emailError.textContent = "";
  passwordError.textContent = "";
  confirmError.textContent = "";
}

function validate() {
  clearErrors();
  let valid = true;

  if (!nameInput.value.trim()) {
    nameError.textContent = "Name is required.";
    valid = false;
  }

  if (!emailInput.value.trim()) {
    emailError.textContent = "Email is required.";
    valid = false;
  }

  if (passwordInput.value.length < 6) {
    passwordError.textContent = "Use at least 6 characters.";
    valid = false;
  }

  if (confirmInput.value !== passwordInput.value) {
    confirmError.textContent = "Passwords don't match.";
    valid = false;
  }

  return valid;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validate()) return;

  const role = form.querySelector('input[name="role"]:checked').value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  try {
    await signUp(nameInput.value.trim(), emailInput.value.trim(), passwordInput.value, role);
    showToast("Account created.", "success");
    window.location.href = "/pages/dashboard.html";
  } catch (error) {
    showToast(mapAuthError(error), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
  }
});

googleBtn.addEventListener("click", async () => {
  const role = form.querySelector('input[name="role"]:checked').value;
  googleBtn.disabled = true;
  try {
    await signInWithGoogle(role);
    showToast("Account ready.", "success");
    window.location.href = "/pages/dashboard.html";
  } catch (error) {
    showToast(mapAuthError(error), "error");
    googleBtn.disabled = false;
  }
});
