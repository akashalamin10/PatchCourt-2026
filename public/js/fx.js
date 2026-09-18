const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

export function injectBackdrop() {
  if (!document.getElementById("sf")) {
    const sf = document.createElement("div");
    sf.id = "sf";
    sf.setAttribute("aria-hidden", "true");
    document.body.prepend(sf);
    spawnStars(sf);
  }
  if (!document.getElementById("fluid")) {
    const canvas = document.createElement("canvas");
    canvas.id = "fluid";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
  }
  if (!document.getElementById("fx-canvas")) {
    const canvas = document.createElement("canvas");
    canvas.id = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
  }
  if (!document.getElementById("modal-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" type="button" data-modal-close aria-label="Close">✕</button>
        <div class="modal-kicker" id="modalKicker"></div>
        <h2 class="modal-title" id="modalTitle"></h2>
        <p class="modal-body" id="modalBody"></p>
        <div id="modalExtra"></div>
        <div class="modal-actions" id="modalActions"></div>
      </div>`;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector("[data-modal-close]").addEventListener("click", closeModal);
    overlay.hidden = true;
    overlay.style.display = "none";
    document.body.appendChild(overlay);
  }
}

function spawnStars(sf) {
  const count = TOUCH ? 80 : 160;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "star";
    const sz = Math.random() * 1.8;
    el.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;--o:${0.1 + Math.random() * 0.9};--d:${2 + Math.random() * 7}s;animation-delay:${Math.random() * 7}s`;
    sf.appendChild(el);
  }
  if (REDUCED) return;
  for (let i = 0; i < (TOUCH ? 2 : 4); i++) {
    const c = document.createElement("div");
    c.className = "comet";
    c.style.top = `${10 + Math.random() * 70}%`;
    c.style.animationDelay = `${i * 6 + Math.random() * 4}s`;
    c.style.animationDuration = `${10 + Math.random() * 8}s`;
    sf.appendChild(c);
  }
}

export function startClock(el) {
  if (!el) return;
  const tick = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  };
  tick();
  setInterval(tick, 1000);
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.hidden = true;
  overlay.style.display = "none";
}

export function openModal({ kicker = "SYSTEM", title, body, extraHtml = "", confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm }) {
  const overlay = document.getElementById("modal-overlay");
  if (!overlay) return;
  document.getElementById("modalKicker").textContent = kicker;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").textContent = body || "";
  document.getElementById("modalExtra").innerHTML = extraHtml;
  const actions = document.getElementById("modalActions");
  actions.innerHTML = "";
  if (cancelLabel) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-secondary";
    cancel.textContent = cancelLabel;
    cancel.addEventListener("click", closeModal);
    actions.appendChild(cancel);
  }
  if (confirmLabel) {
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn-primary";
    ok.textContent = confirmLabel;
    ok.addEventListener("click", async () => {
      if (onConfirm) await onConfirm();
      closeModal();
    });
    actions.appendChild(ok);
  }
  overlay.hidden = false;
  overlay.style.display = "flex";
  overlay.classList.add("open");
}

let confettiPieces = [];
let confettiAnim = null;

export function launchConfetti({ palette, burst = true } = {}) {
  if (REDUCED) return;
  const canvas = document.getElementById("fx-canvas");
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const colors = palette || ["#00c8ff", "#a0ff60", "#ff6b35", "#c060ff", "#ffcc00", "#ff4488", "#ffffff", "#e1306c"];
  const now = Date.now();
  if (burst) {
    for (let j = 0; j < 48; j++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 10 + 3;
      confettiPieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 180,
        y: canvas.height * 0.38,
        w: 5,
        h: 5,
        r: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        tiltAngle: 0,
        tiltSpeed: 0,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 4,
        shape: "star",
        opacity: 1,
        fadeDelay: 0,
        born: now,
      });
    }
  }
  for (let i = 0; i < 110; i++) {
    const shape = ["rect", "strip", "circle"][Math.floor(Math.random() * 3)];
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: -20 - (i / 110) * canvas.height * 0.6,
      w: shape === "strip" ? Math.random() * 3 + 2 : Math.random() * 10 + 5,
      h: shape === "strip" ? Math.random() * 18 + 8 : Math.random() * 8 + 4,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      tiltAngle: Math.random() * Math.PI * 2,
      tiltSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 1.4,
      shape,
      opacity: 1,
      fadeDelay: 4000 + Math.random() * 4000,
      born: now,
    });
  }
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  const start = Date.now();
  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - start;
    confettiPieces.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tiltAngle);
      if (p.shape === "star") {
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const r2 = k % 2 === 0 ? p.r : p.r * 0.4;
          const a = (k * Math.PI) / 4;
          k === 0 ? ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2) : ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.tiltAngle += p.tiltSpeed;
      p.vy += 0.12;
      if (p.shape === "star") {
        p.vy *= 0.96;
        p.opacity -= 0.016;
      } else if (elapsed > p.fadeDelay) {
        p.opacity -= 0.012;
      }
    });
    confettiPieces = confettiPieces.filter((p) => p.opacity > 0.03 && p.y < canvas.height + 40);
    if (confettiPieces.length) confettiAnim = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  frame();
}

export function flashReward() {
  const el = document.createElement("div");
  el.className = "reward-burst";
  el.innerHTML = `<div class="reward-burst-title">CLAIM LOCKED</div><div class="reward-burst-sub">CASE ASSIGNED TO YOUR WALLET</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => el.classList.remove("show"), 2200);
  setTimeout(() => el.remove(), 2800);
  launchConfetti({ palette: ["#00c8ff", "#a0ff60", "#ffffff", "#c060ff"] });
}

export function playVerdict(kind) {
  const k = String(kind || "").toLowerCase();
  const overlay = document.createElement("div");
  overlay.className = "verdict-flash";
  if (k.includes("reject")) {
    overlay.classList.add("is-reject");
    overlay.innerHTML = `<div class="verdict-stamp reject glitch">REJECTED</div>`;
    document.body.classList.add("shake-reject");
    setTimeout(() => document.body.classList.remove("shake-reject"), 700);
  } else if (k.includes("partial")) {
    overlay.classList.add("is-partial");
    overlay.innerHTML = `<div class="verdict-stamp partial">PARTIAL</div>`;
  } else {
    overlay.classList.add("is-ok");
    overlay.innerHTML = `<div class="verdict-stamp approved">APPROVED</div>`;
    launchConfetti({ palette: ["#a0ff60", "#00c8ff", "#ffffff", "#ffcc00"] });
  }
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  setTimeout(() => overlay.classList.remove("show"), 1600);
  setTimeout(() => overlay.remove(), 2100);
}

export function pulseStamp(el, kind) {
  if (!el) return;
  el.classList.add("show");
  const k = String(kind || "").toLowerCase();
  el.classList.remove("approved", "rejected", "partial");
  if (k.includes("reject")) el.classList.add("rejected", "stamp-glitch");
  else if (k.includes("partial")) el.classList.add("partial", "stamp-pulse");
  else el.classList.add("approved", "stamp-happy");
}
