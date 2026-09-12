// A hexagonal "scanning" spinner -- three arcs pulse around a rotating
// hex core, in the cyan/amber cyber palette. Deliberately different from
// the reference spinner (which draws/fills a logo outline): this one reads
// as a radar/scan sweep, which fits an "AI validating something" moment.

const SPINNER_SVG = `
<svg viewBox="0 0 60 60" class="cyber-spinner-svg">
  <polygon points="30,4 52,17 52,43 30,56 8,43 8,17" class="cs-hex" />
  <circle cx="30" cy="30" r="18" class="cs-arc cs-arc-1" />
  <circle cx="30" cy="30" r="12" class="cs-arc cs-arc-2" />
  <circle cx="30" cy="30" r="2.4" class="cs-core" />
</svg>`;

export function spinnerMarkup(size = "md") {
  return `<span class="cyber-spinner cyber-spinner-${size}">${SPINNER_SVG}</span>`;
}

let overlayEl = null;

export function showPageSpinner(label = "Loading...") {
  if (overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.className = "page-spinner-overlay";
  overlayEl.innerHTML = `
    <div class="page-spinner-box">
      ${spinnerMarkup("lg")}
      <span class="page-spinner-label mono">${label}</span>
    </div>
  `;
  document.body.appendChild(overlayEl);
}

export function hidePageSpinner() {
  if (!overlayEl) return;
  overlayEl.classList.add("fade-out");
  const el = overlayEl;
  overlayEl = null;
  setTimeout(() => el.remove(), 200);
}

// Swaps a button's contents for a small inline spinner + label while an
// async action runs, then restores it (or leaves it disabled on error --
// caller decides). Purely a visual helper; doesn't touch any app logic.
export async function withButtonSpinner(button, busyLabel, action) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${spinnerMarkup("sm")}<span>${busyLabel}</span>`;
  try {
    return await action();
  } finally {
    button.innerHTML = original;
    button.disabled = false;
  }
}
