// Shared view helpers: the "now" context, dialogs, toasts and the finisher-medal celebration.
import { dateOf, DAY, daysBetween, humanDur, HOUR, money, reducedMotion, shortDur, weekday, esc } from "./util.js?v=4";
import { profile, store } from "./store.js?v=4";
import { avoided, cleanFor, courseProgress, cravingsBeaten, dayNumber, liveSlips, quitDate, saved, started } from "./quit.js?v=4";
import { words } from "./content.js?v=4";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function context(nowMs = Date.now()) {
  const s = store.state, p = profile();
  const now = dateOf(nowMs);
  const on = started(p, nowMs);
  const clean = on ? cleanFor(s, p, nowMs) : 0;
  const cp = courseProgress(s, p, nowMs);
  const cash = saved(p, nowMs);
  const lastSlip = liveSlips(s, p).pop();
  return {
    s, p, now, nowMs, started: on, name: p.name || "Tom", hour: new Date(nowMs).getHours(), weekday: weekday(now),
    day: on ? dayNumber(p, now) : 0, clean: humanDur(clean), cleanH: clean / HOUR, cleanMs: clean,
    saved: money(cash, cash < 100 ? 2 : 0), savedN: cash, avoided: avoided(p, nowMs), beat: cravingsBeaten(s),
    next: cp.next?.title, nextIn: cp.next ? humanDur(cp.next.at - clean) : "", hoursToNext: cp.next ? (cp.next.at - clean) / HOUR : null, course: cp,
    slipRecent: Boolean(lastSlip && nowMs - lastSlip.at < 2 * DAY), lastSlip,
    toGo: !on && p.quitAt ? shortDur(p.quitAt - nowMs) : "", daysToGo: !on && p.quitAt ? daysBetween(now, quitDate(p)) : 0,
    thing: words(p.product).thing, cloud: p.product === "vape" ? "vapour" : "smoke",
  };
}

// ---------- toast ----------
let toastTimer;
export function toast(msg, kind = "") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
}

// ---------- dialog ----------
export function modal(html, onMount, cls = "") {
  const d = document.createElement("dialog");
  d.className = `sheet ${cls}`;
  d.innerHTML = `<button class="x" type="button" aria-label="Close" data-close>✕</button>${html}`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  d.showModal();
  onMount?.(d);
  return d;
}

// ---------- entrance: sections rise in, big numbers count up (on navigation only) ----------
export function enter(view) {
  view.classList.remove("enter");
  void view.offsetWidth; // restart the CSS animation
  view.classList.add("enter");
  if (reducedMotion()) return;
  view.querySelectorAll("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count), dp = Number(el.dataset.dp || 0), pre = el.dataset.pre || "";
    if (!Number.isFinite(end) || end === 0) return;
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (end * e).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------- the finisher medal ----------
export function celebrate(title, sub = "", eyebrow = "Medal earned") {
  document.querySelectorAll(".finish").forEach((x) => x.remove()); // one at a time
  const o = document.createElement("div");
  o.className = "finish";
  o.setAttribute("role", "alert");
  o.innerHTML = `
    <div class="finish-tape" aria-hidden="true"><span>FINISH</span><span>FINISH</span><span>FINISH</span><span>FINISH</span></div>
    <div class="medal" aria-hidden="true"><i class="ribbon"></i><b>${esc(eyebrow === "Medal earned" ? "★" : "✓")}</b></div>
    <p class="finish-eyebrow">${esc(eyebrow)}</p>
    <p class="finish-title">${esc(title)}</p>
    ${sub ? `<p class="finish-sub">${esc(sub)}</p>` : ""}
    <p class="finish-hint">Tap to keep running</p>`;
  if (!reducedMotion()) {
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = `${Math.random() * 100}%`;
      c.style.animationDelay = `${Math.random() * 0.5}s`;
      c.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      c.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
      c.dataset.k = String(i % 3);
      o.append(c);
    }
  }
  const close = () => o.remove();
  o.addEventListener("click", close);
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter") { close(); document.removeEventListener("keydown", k); } });
  document.body.append(o);
  setTimeout(close, 7000);
}
