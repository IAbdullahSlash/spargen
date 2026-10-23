const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

/* ---------- 3D hero (loaded separately so the page works if WebGL/CDN fails) ---------- */
const canvas = document.getElementById("hero-canvas");
import("./hero3d.js")
  .then(({ initHero }) => initHero(canvas, [...document.querySelectorAll(".node-label")]))
  .catch((err) => {
    console.warn("3D hero unavailable:", err);
    canvas.remove();
    document.querySelector(".hero-labels")?.remove();
  });

requestAnimationFrame(() => document.body.classList.add("loaded"));

/* ---------- nav ---------- */
const nav = document.getElementById("nav");
const toggle = nav.querySelector(".nav-toggle");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
function closeNav() {
  nav.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
}
nav.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => {
  closeNav();
}));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("open")) {
    closeNav();
    toggle.focus();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (nav.classList.contains("open") && !nav.contains(e.target)) closeNav();
});

/* ---------- day / night theme ---------- */
const themeBtn = document.getElementById("theme-toggle");
const root = document.documentElement;

function setTheme(theme, save) {
  const apply = () => {
    root.dataset.theme = theme;
    themeBtn.setAttribute("aria-label", `Switch to ${theme === "light" ? "dark" : "light"} theme`);
  };
  // cross-fade where supported, instant otherwise
  if (save && document.startViewTransition && !reduce) document.startViewTransition(apply);
  else apply();
  if (save) { try { localStorage.setItem("spargen-theme", theme); } catch (e) {} }
}
setTheme(root.dataset.theme || "light", false);
themeBtn.addEventListener("click", () => setTheme(root.dataset.theme === "light" ? "dark" : "light", true));

/* ---------- counters ---------- */
function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = +(el.dataset.decimals || 0);
  const pre = el.dataset.prefix || "";
  const suf = el.dataset.suffix || "";
  const fmt = (v) => pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
  if (reduce) { el.textContent = fmt(end); return; }
  const dur = 1800;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = fmt(end * (1 - Math.pow(1 - p, 4)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) * 80}ms`;
    el.classList.add("in");
    el.querySelectorAll("[data-count]").forEach(countUp);
    if (el.matches("[data-count]")) countUp(el);
    setTimeout(() => (el.style.transitionDelay = ""), 1200);
    io.unobserve(el);
  });
}, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- cursor glow ---------- */
if (finePointer) {
  const glow = document.querySelector(".cursor-glow");
  let gx = innerWidth / 2, gy = innerHeight / 2, cx = gx, cy = gy;
  addEventListener("pointermove", (e) => { gx = e.clientX; gy = e.clientY; document.body.classList.add("has-pointer"); }, { passive: true });
  (function loop() {
    cx += (gx - cx) * 0.12; cy += (gy - cy) * 0.12;
    glow.style.transform = `translate(${cx - 260}px, ${cy - 260}px)`;
    requestAnimationFrame(loop);
  })();
}

/* ---------- 3D tilt cards with spotlight ---------- */
if (finePointer && !reduce) {
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.classList.add("tilting");
      card.style.setProperty("--ry", `${(px - 0.5) * 12}deg`);
      card.style.setProperty("--rx", `${(0.5 - py) * 12}deg`);
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
} else {
  document.querySelectorAll(".card-glow").forEach((g) => (g.style.opacity = 0));
}

/* ---------- dashboard follows the cursor ---------- */
const stage = document.querySelector(".dash-stage");
const dash = document.getElementById("dash");
if (finePointer && !reduce && dash) {
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    dash.style.setProperty("--dy", `${-18 + px * 22}deg`);
    dash.style.setProperty("--dx", `${14 - py * 18}deg`);
  });
  stage.addEventListener("pointerleave", () => {
    dash.style.setProperty("--dy", "-18deg");
    dash.style.setProperty("--dx", "14deg");
  });
}

/* ---------- process: pinned scroll steps through each stage ---------- */
const psSection = document.querySelector(".process-scroll");
const psPanels = [...psSection.querySelectorAll(".ps-panel")];
const psRail = [...psSection.querySelectorAll(".ps-rail-item")];
const psFill = document.getElementById("ps-rail-fill");
const psRing = document.getElementById("ps-ring");
const psNum = document.getElementById("ps-num");
const psPinned = matchMedia("(min-width: 861px) and (pointer: fine)");
let psActive = -1;

function psUpdate() {
  if (!psPinned.matches) return;
  const r = psSection.getBoundingClientRect();
  const span = r.height - innerHeight;
  const p = Math.min(Math.max(-r.top / span, 0), 1);
  const raw = p * psPanels.length;
  const active = Math.min(Math.floor(raw), psPanels.length - 1);

  psFill.style.transform = `scaleY(${p})`;
  psRing.style.strokeDashoffset = 1 - Math.min(raw - active, 1);

  if (active === psActive) return;
  psActive = active;
  psPanels.forEach((el, i) => {
    el.classList.toggle("is-active", i === active);
    el.classList.toggle("is-past", i < active);
  });
  psRail.forEach((el, i) => {
    el.classList.toggle("is-on", i <= active);
    el.classList.toggle("is-current", i === active);
    if (i === active) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
  psNum.textContent = String(active + 1).padStart(2, "0");
  psNum.classList.remove("flip");
  void psNum.offsetWidth;
  psNum.classList.add("flip");
}

// clicking a step on the rail scrolls to that stage
psRail.forEach((el, i) => el.addEventListener("click", () => {
  const span = psSection.offsetHeight - innerHeight;
  const top = psSection.getBoundingClientRect().top + scrollY;
  scrollTo({ top: top + span * ((i + 0.5) / psPanels.length), behavior: "smooth" });
}));

addEventListener("scroll", psUpdate, { passive: true });
addEventListener("resize", psUpdate);
psPinned.addEventListener("change", () => { psActive = -1; psUpdate(); });
psUpdate();

/* ---------- services: vertical scroll drives a horizontal, 3D card rail ---------- */
const ssSection = document.querySelector(".services-scroll");
const ssTrack = document.getElementById("ss-track");
const ssBar = document.getElementById("ss-bar");
const ssCurrent = document.getElementById("ss-current");
const ssCards = [...ssTrack.children];
const ssPinned = matchMedia("(min-width: 861px) and (pointer: fine)");
let ssDistance = 0;

function ssMeasure() {
  if (!ssPinned.matches) {
    ssSection.style.removeProperty("--ss-height");
    ssTrack.style.transform = "";
    ssCards.forEach((c) => { c.style.removeProperty("--sry"); c.style.removeProperty("--ss"); });
    return;
  }
  ssDistance = Math.max(0, ssTrack.scrollWidth - innerWidth);
  ssSection.style.setProperty("--ss-height", `${innerHeight + ssDistance}px`);
  ssUpdate();
}

function ssUpdate() {
  if (!ssPinned.matches) return;
  const top = ssSection.getBoundingClientRect().top;
  const p = ssDistance ? Math.min(Math.max(-top / ssDistance, 0), 1) : 0;
  ssTrack.style.transform = `translate3d(${-p * ssDistance}px, 0, 0)`;
  ssBar.style.transform = `scaleX(${p})`;

  // cards turn toward the viewer as they approach the centre of the screen
  const mid = innerWidth / 2;
  ssCards.forEach((card) => {
    const r = card.getBoundingClientRect();
    const off = (r.left + r.width / 2 - mid) / innerWidth; // -0.5 … 0.5 on screen
    const clamped = Math.max(-1, Math.min(1, off * 1.6));
    if (!reduce) {
      card.style.setProperty("--sry", `${clamped * -18}deg`);
      card.style.setProperty("--ss", (1 - Math.abs(clamped) * 0.05).toFixed(3));
    }
  });
  ssCurrent.textContent = String(Math.round(p * 3) + 1).padStart(2, "0");
}

addEventListener("scroll", ssUpdate, { passive: true });
addEventListener("resize", ssMeasure);
ssPinned.addEventListener("change", ssMeasure);
document.fonts?.ready.then(ssMeasure);
ssMeasure();

/* ---------- integrations: curved beams from each tool into the core ---------- */
const beamStage = document.getElementById("beam-stage");
const beamSvg = beamStage.querySelector(".beam-svg");
const beamHub = beamStage.querySelector(".beam-hub svg");
const beamNodes = [...beamStage.querySelectorAll(".beam-node")];
const SVG_NS = "http://www.w3.org/2000/svg";

function drawBeams() {
  const box = beamStage.getBoundingClientRect();
  const hub = beamHub.getBoundingClientRect();
  const hx = hub.left + hub.width / 2 - box.left;
  const hy = hub.top + hub.height / 2 - box.top;
  beamSvg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  beamSvg.replaceChildren();
  beamNodes.forEach((node, i) => {
    const icon = node.querySelector(".beam-icon").getBoundingClientRect();
    const nx = icon.left + icon.width / 2 - box.left;
    const ny = icon.top + icon.height / 2 - box.top;
    const left = nx < hx;
    // tools on the left feed into the core; the core feeds tools on the right
    const [x0, y0, x1, y1] = left ? [nx, ny, hx, hy] : [hx, hy, nx, ny];
    const dx = (x1 - x0) * 0.5;
    const d = `M${x0},${y0} C${x0 + dx},${y0} ${x1 - dx},${y1} ${x1},${y1}`;
    ["beam-base", "beam-light"].forEach((cls) => {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", cls);
      p.setAttribute("pathLength", "1");
      p.style.setProperty("--c", node.style.getPropertyValue("--c"));
      if (cls === "beam-light") p.style.animationDelay = `${(i % 3) * 0.55 + (left ? 0 : 1.6)}s`;
      beamSvg.append(p);
    });
  });
}
new ResizeObserver(drawBeams).observe(beamStage);
document.fonts?.ready.then(drawBeams);

/* ---------- FAQ accordion: one answer open at a time ---------- */
const faqItems = [...document.querySelectorAll(".faq-item")];
faqItems.forEach((item) => {
  const q = item.querySelector(".faq-q");
  q.addEventListener("click", () => {
    const open = !item.classList.contains("open");
    faqItems.forEach((other) => {
      other.classList.remove("open");
      other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
    });
    item.classList.toggle("open", open);
    q.setAttribute("aria-expanded", String(open));
  });
});

/* ---------- footer wordmark: outline draws in, gradient follows the cursor ---------- */
const footSvg = document.getElementById("foot-svg");
const fwReveal = document.getElementById("fw-reveal");
new IntersectionObserver(([e], obs) => {
  if (e.isIntersecting) { footSvg.classList.add("in"); obs.disconnect(); }
}, { threshold: 0.3 }).observe(footSvg);
const fwHide = () => { fwReveal.setAttribute("cx", "-600"); fwReveal.setAttribute("cy", "-600"); };
fwHide();
footSvg.addEventListener("pointermove", (e) => {
  const r = footSvg.getBoundingClientRect();
  fwReveal.setAttribute("cx", ((e.clientX - r.left) / r.width) * 1000);
  fwReveal.setAttribute("cy", ((e.clientY - r.top) / r.height) * 240);
});
footSvg.addEventListener("pointerleave", fwHide);

/* ---------- enquiry form: validates, sends through Web3Forms, falls back to email ---------- */
const leadForm = document.getElementById("lead-form");
const lfStatus = document.getElementById("lf-status");
const lfDone = document.getElementById("lf-done");
const FOUNDERS = "abdullahaz7677@gmail.com,razaainaan@gmail.com";
const LF_CHECKS = {
  name: (v) => (v.length >= 2 ? "" : "Please tell us your name."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Please enter a valid email address."),
  project_type: (v) => (v ? "" : "Please pick what you need — “Not sure yet” is fine."),
  message: (v) => (v.length >= 20 ? "" : "A sentence or two helps us prepare (20+ characters)."),
};

function lfValidate(field) {
  const check = LF_CHECKS[field.name];
  if (!check) return true;
  const msg = check(field.value.trim());
  const wrap = field.closest(".lf-field");
  wrap.classList.toggle("invalid", !!msg);
  field.setAttribute("aria-invalid", msg ? "true" : "false");
  const err = wrap.querySelector(".lf-error");
  if (err) err.textContent = msg;
  if (err) field.setAttribute("aria-describedby", err.id);
  return !msg;
}

function lfMailto(data) {
  const body = [
    `Name: ${data.name}`, `Email: ${data.email}`, `Company: ${data.company || "—"}`,
    `Needs: ${data.project_type}`, `Timeline: ${data.timeline}`, "", data.message,
  ].join("\n");
  return `mailto:${FOUNDERS}?subject=${encodeURIComponent(`Project enquiry: ${data.project_type}`)}&body=${encodeURIComponent(body)}`;
}

function lfFinish(viaEmailApp) {
  lfDone.querySelector("h3").textContent = viaEmailApp ? "Your email app should now be open." : "Thanks — your message is on its way.";
  lfDone.querySelector("p").textContent = viaEmailApp
    ? "We've written the message for you — just press send. Nothing opened? Email us at abdullahaz7677@gmail.com or razaainaan@gmail.com."
    : "One of the founders will reply within one working day. Keep an eye on your inbox (and the spam folder, just in case).";
  leadForm.classList.add("done");
  lfDone.focus();
}

[...leadForm.querySelectorAll("input, select, textarea")].forEach((f) => {
  f.addEventListener("blur", () => f.value && lfValidate(f));
  f.addEventListener("input", () => f.closest(".lf-field")?.classList.contains("invalid") && lfValidate(f));
});

leadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  lfStatus.textContent = "";
  lfStatus.classList.remove("error");
  const fields = [...leadForm.querySelectorAll("[name]")].filter((f) => LF_CHECKS[f.name]);
  const valid = fields.map(lfValidate); // check every field so all errors show at once
  if (valid.includes(false)) { fields[valid.indexOf(false)].focus(); return; }

  const data = Object.fromEntries(new FormData(leadForm));
  Object.keys(data).forEach((k) => typeof data[k] === "string" && (data[k] = data[k].trim()));
  if (data.botcheck) { lfFinish(false); return; } // a bot ticked the hidden box: pretend it worked

  const key = leadForm.dataset.web3formsKey;
  if (!key || key === "YOUR_ACCESS_KEY_HERE") { // not configured yet: hand over to the visitor's email app
    location.href = lfMailto(data);
    lfFinish(true);
    return;
  }

  leadForm.classList.add("sending");
  leadForm.querySelector(".lf-btn-text").textContent = "Sending…";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: `New enquiry: ${data.project_type} — ${data.name}`,
        from_name: "Spargen website",
        ...data,
      }),
      signal: ctrl.signal,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.success) throw new Error(out.message || `HTTP ${res.status}`);
    leadForm.reset();
    lfFinish(false);
  } catch (err) {
    console.warn("Enquiry form failed:", err);
    lfStatus.classList.add("error");
    lfStatus.innerHTML = `Sorry, that didn't go through. Please try again, or <a href="${lfMailto(data).replace(/"/g, "&quot;")}">send it by email instead</a>.`;
  } finally {
    clearTimeout(timer);
    leadForm.classList.remove("sending");
    leadForm.querySelector(".lf-btn-text").textContent = "Send enquiry";
  }
});

leadForm.querySelector(".lf-again").addEventListener("click", () => {
  leadForm.classList.remove("done");
  leadForm.reset();
  leadForm.querySelector("#lf-name").focus();
});
