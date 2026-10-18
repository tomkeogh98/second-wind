// The shell: routing, header sync badge, pairing, medal + marker celebrations, keeping devices in step.
import { borrowToken, configured, connectDevice, onboarded, pairLink, profile, readPairCode, setRec, store, syncNow, update } from "./store.js?v=1";
import { $, $$, celebrate, enter, modal, toast } from "./ui.js?v=1";
import { renderToday } from "./view-today.js?v=1";
import { renderCourse } from "./view-course.js?v=1";
import { renderSplits } from "./view-splits.js?v=1";
import { renderMedals } from "./view-medals.js?v=1";
import { renderAid } from "./view-aid.js?v=1";
import { renderSettings } from "./view-settings.js?v=1";
import { openSOS } from "./sos.js?v=1";
import { achievedIds, medalLabel } from "./goals.js?v=1";
import { bestRun, started } from "./quit.js?v=1";
import { course } from "./content.js?v=1";
import { today } from "./util.js?v=1";

const ROUTES = { "": renderToday, course: renderCourse, splits: renderSplits, medals: renderMedals, aid: renderAid, settings: renderSettings };
const MORE = ["medals", "aid", "settings"];

const view = $("#view");
let renderedRev = -1, pendingRender = false, quiet = false;

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (name === "pair") { pairDevice(arg); return; }
  $$("nav.tabs a, nav.bottom-tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === `#/${name}` ? "page" : "false"));
  $("#moreBtn")?.setAttribute("aria-current", MORE.includes(name) ? "page" : "false");
  document.body.dataset.route = name || "today";
  document.body.classList.toggle("pre-reg", !onboarded());
  drawBanner();
  // A connected device that hasn't pulled yet shouldn't show registration: wait for the data.
  if (!onboarded() && configured() && !store.sync.lastSynced && store.sync.status !== "error") {
    view.innerHTML = `<section class="panel loading"><p class="loading-word">Collecting your bib…</p><p class="fine">Pulling your data from the private repo.</p></section>`;
    renderedRev = -1;
    return;
  }
  if (!onboarded() && name !== "settings") { renderToday(view); renderedRev = store.rev; return; }
  (ROUTES[name] || renderToday)(view);
  renderedRev = store.rev;
  checkMilestones();
}

function navigate() {
  route();
  enter(view);
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

// Redraw when data changes, but never under someone's fingers mid-typing.
function maybeRerender() {
  if (quiet || store.rev === renderedRev) return;
  const a = document.activeElement;
  const typing = a && view.contains(a) && (a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "range"].includes(a.type)));
  if (typing || document.querySelector("dialog[open]")) { pendingRender = true; return; }
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}
document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender) { pendingRender = false; maybeRerender(); } }, 50));
document.addEventListener("close", () => setTimeout(() => { if (pendingRender || store.rev !== renderedRev) { pendingRender = false; maybeRerender(); } }, 0), true);
window.addEventListener("sw:refresh", () => { if (!document.querySelector("dialog[open]")) { renderedRev = -1; maybeRerender(); } });

// ---------- medals & course markers ----------
function checkMilestones() {
  if (!onboarded()) return;
  const s = store.state, p = profile();
  if (!started(p)) return;
  const best = bestRun(s, p);
  const markerIds = course(p.product).filter((m) => best >= m.at).map((m) => `c-${p.product}-${m.at}`);
  const ids = [...achievedIds(s, p), ...markerIds];
  const fresh = ids.filter((id) => !s.milestones[id]);
  if (!fresh.length) return;
  quiet = true; // milestones don't change what's on screen
  update((st) => { for (const id of fresh) st.milestones[id] = { date: today(), updatedAt: Date.now() }; });
  quiet = false;
  renderedRev = store.rev;
  if (document.querySelector("dialog[open]")) return; // don't stack on top of the SOS sheet
  const firstMarker = fresh.find((id) => id.startsWith("c-"));
  const firstMedal = fresh.find((id) => !id.startsWith("c-"));
  const more = fresh.length - 1;
  if (firstMedal) celebrate(medalLabel(s, p, firstMedal), more ? `+ ${more} more on the wall.` : "Another one on the wall.");
  else if (firstMarker) {
    const m = course(p.product).find((x) => `c-${p.product}-${x.at}` === firstMarker);
    celebrate(m?.title || "Marker passed", m?.body || "", "Course marker passed");
  }
}

// ---------- header ----------
function drawSync() {
  const b = $("#sync");
  const s = store.sync;
  b.dataset.status = s.status;
  b.querySelector("span").textContent = s.status === "ok" ? "synced" : s.status === "syncing" ? "syncing" : s.status === "error" ? "sync error" : "this device";
  b.title = s.message || "Saved on this device only. Set up sync in Settings.";
}
$("#sync").addEventListener("click", () => {
  if (store.sync.status === "off") { location.hash = "#/settings"; return; }
  if (store.sync.status === "error") toast(store.sync.message, "bad");
  syncNow();
});

try {
  const t = localStorage.getItem("sw.theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch { /* ignore */ }

// ---------- pairing & the "not synced" banner ----------
async function pairDevice(code) {
  history.replaceState(null, "", `${location.pathname}#/`); // drop the token from the address bar straight away
  const p = readPairCode(code || "");
  if (!p) { toast("That setup link looks broken. Make a fresh one in Settings on your other device.", "bad"); route(); return; }
  view.innerHTML = `<section class="panel loading"><p class="loading-word">Connecting this device…</p><p class="fine">Checking the private repo and pulling your data.</p></section>`;
  try {
    await connectDevice(p.repo, p.token);
    toast("This device is connected. Everything's in sync. 🏁");
  } catch (e) {
    toast(e.message, "bad");
  }
  route();
}

function drawBanner() {
  const b = $("#syncBanner");
  const s = store.sync;
  if (!onboarded() && !configured()) { b.hidden = true; return; }
  if (!configured()) {
    b.hidden = false;
    b.className = "sync-banner";
    b.innerHTML = `<span><b>This device isn't syncing.</b> Your other laptops and phone can't see what you log here.</span> <a href="#/settings">Connect it →</a>`;
  } else if (s.status === "error") {
    b.hidden = false;
    b.className = "sync-banner bad";
    b.innerHTML = `<span><b>Sync problem:</b> ${s.message.replace(/[<>&]/g, "")}</span> <a href="#/settings">Fix it →</a>`;
  } else b.hidden = true;
}

$$("[data-sos]").forEach((b) => b.addEventListener("click", () => {
  if (!onboarded()) { toast("Register first: it takes two minutes."); return; }
  openSOS();
}));

$("#moreBtn")?.addEventListener("click", () => {
  modal(`<div class="sheet-body more-sheet"><p class="kicker">More</p><nav aria-label="More pages">
    <a href="#/medals"><b>Medals</b><small>trophy wall & reward fund</small></a>
    <a href="#/aid"><b>Aid station</b><small>tools, plans, reasons, support</small></a>
    <a href="#/settings"><b>Settings</b><small>your entry, devices & sync</small></a>
  </nav></div>`, (d) => d.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => d.close())));
});

// ---------- boot ----------
store.subscribe(() => { drawSync(); drawBanner(); maybeRerender(); });
setInterval(() => { if (document.visibilityState === "visible" && configured()) syncNow(); }, 60000);
window.addEventListener("focus", () => { if (configured()) syncNow(); });
window.addEventListener("hashchange", navigate);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { syncNow(); if (store.rev === renderedRev) route(); } });
// Midnight rollover, and course markers passing while the page is open.
let lastDay = new Date().toDateString();
setInterval(() => {
  if (new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); route(); }
  else if (!document.querySelector("dialog[open]")) checkMilestones();
}, 60000);

drawSync();
route();
enter(view);
if (configured()) syncNow();
else borrowToken().then((name) => { if (name) toast(`Synced using ${name}'s token. This device is connected.`); });
window.__sw = { store, setRec, syncNow, pairLink }; // handy for debugging in the console
