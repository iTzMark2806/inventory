// Show / hide password (works on both pages, even if this script loads early)
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-pw");
  if (!btn) return;

  const input = document.getElementById(btn.dataset.target);
  if (!input) return;

  const show = input.type === "password";
  input.type = show ? "text" : "password";

  // The CSS shows icon-on when .is-visible is set, icon-off otherwise
  btn.classList.toggle("is-visible", show);
  btn.setAttribute("aria-pressed", show ? "true" : "false");
  btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

const errorBox = document.getElementById("formError");
const showError = (msg) => { if (errorBox) errorBox.textContent = msg; };

// Log-in form
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;
    if (!username || !password) {
      showError("Please enter your username and password.");
      return;
    }
    showError("");
    // TODO: send credentials to your backend here
    console.log("Log-in submitted:", { username });
  });
}

// Sign-in form
const signinForm = document.getElementById("signinForm");
if (signinForm) {
  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = signinForm.email.value.trim();
    const password = signinForm.password.value;
    const confirm = signinForm.confirm.value;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      showError("Passwords do not match.");
      return;
    }
    showError("");
    // TODO: send sign-up data to your backend here
    console.log("Sign-in submitted:", { email });
  });
}