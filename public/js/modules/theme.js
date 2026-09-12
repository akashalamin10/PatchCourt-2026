const STORAGE_KEY = "patchcourt_theme";

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || "dark";
}

export function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

// Wires a button (created here) into the given container. The theme itself
// is already applied as early as possible by the inline snippet in each
// page's <head> (see theme-init.js) so there's no flash of the wrong theme.
export function mountThemeToggle(container) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";
  button.title = "Toggle light / dark theme";
  button.innerHTML = `
    <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
    <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  `;
  button.addEventListener("click", () => toggleTheme());
  container.appendChild(button);
  return button;
}
