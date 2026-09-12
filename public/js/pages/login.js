import { logIn, signInWithGoogle, mapAuthError } from "../modules/auth.js";
import { showToast } from "../components/toast.js";

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const googleBtn = document.getElementById("googleBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const passwordToggle = document.getElementById("passwordToggle");
const eyeIcon = document.getElementById("eyeIcon");

const EYE_OPEN = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>';
const EYE_CLOSED = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 4.22-5.44M9.9 4.24A10.5 10.5 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.34 3.36M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';

passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  eyeIcon.innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
  passwordToggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

function clearErrors() {
  emailError.textContent = "";
  passwordError.textContent = "";
}

function validate() {
  clearErrors();
  let valid = true;

  if (!emailInput.value.trim()) {
    emailError.textContent = "Email is required.";
    valid = false;
  }

  if (!passwordInput.value) {
    passwordError.textContent = "Password is required.";
    valid = false;
  }

  return valid;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validate()) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    await logIn(emailInput.value.trim(), passwordInput.value);
    showToast("Welcome back.", "success");
    window.location.href = "/pages/dashboard.html";
  } catch (error) {
    showToast(mapAuthError(error), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
  }
});

googleBtn.addEventListener("click", async () => {
  googleBtn.disabled = true;
  try {
    await signInWithGoogle("buyer");
    showToast("Welcome back.", "success");
    window.location.href = "/pages/dashboard.html";
  } catch (error) {
    showToast(mapAuthError(error), "error");
    googleBtn.disabled = false;
  }
});
