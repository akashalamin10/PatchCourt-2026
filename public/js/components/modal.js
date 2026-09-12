export function openModal(html) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "activeModal";
  overlay.innerHTML = `<div class="modal-box">${html}</div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  return overlay;
}

export function closeModal() {
  const existing = document.getElementById("activeModal");
  if (existing) existing.remove();
}
