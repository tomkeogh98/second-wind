// The shell: routing, pairing, marker + milestone celebrations, quiet background sync.
import { borrowToken, configured, connectDevice, pairLink, profile, readPairCode, setRec, store, syncNow, update } from "./store.js?v=2";
import { $, $$, enter, celebrate, toast } from "./ui.js?v=2";
import { renderToday } from "./view-today.js?v=2";
import { renderCourse } from "./view-course.js?v=2";
import { renderTools } from "./view-tools.js?v=2";
import { renderSettings } from "./view-settings.js?v=2";
import { openSOS } from "./sos.js?v=2";
import { course } from "./content.js?v=2";
import { cleanFor, milestones, started } from "./quit.js?v=2";
import { money, today } from "./util.js?v=2";

const ROUTES = { "": renderToday, course: renderCourse, tools: renderTools, settings: renderSettings };

const view = $("#view");
let renderedRev = -1, pendingRender = false, quiet = false;

function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (name === "pair") { pairDevice(arg); return; }
  $$("nav.tabs a, nav.bottom-tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === `#/${name}` ? "page" : "false"));
  document.body.dataset.route = name || "today";
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

// Redraw when data changes (a sync, a slip), but never under an open dialog.
function maybeRerender() {
  if (quiet || store.rev === renderedRev) return;
  if (document.querySelector("dialog[open]")) { pendingRender = true; return; }
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}
document.addEventListener("close", () => setTimeout(() => { if (pendingRender || store.rev !== renderedRev) { pendingRender = false; maybeRerender(); } }, 0), true);

// ---------- course markers & time milestones: celebrated once, the first time you get there ----------
function checkMilestones() {
  const s = store.state, p = profile();
  if (!started(p)) return;
  const clean = cleanFor(s, p);
  const fresh = [
    ...course(p.product).filter((m) => clean >= m.at).map((m) => ({ id: `c-${p.product}-${m.at}`, title: m.title, sub: m.body, eyebrow: "Course marker passed" })),
    ...milestones(s, p).filter((m) => m.done).map((m) => ({ id: m.id, title: m.title, sub: `${money(m.money)} not spent on pods. Keep running.`, eyebrow: "Milestone" })),
  ].filter((m) => !s.milestones[m.id]);
  if (!fresh.length) return;
  quiet = true; // milestones don't change what's on screen
  update((st) => { for (const m of fresh) st.milestones[m.id] = { date: today(), updatedAt: Date.now() }; });
  quiet = false;
  renderedRev = store.rev;
  if (document.querySelector("dialog[open]")) return;
  const pick = fresh.find((m) => m.eyebrow === "Milestone") || fresh[fresh.length - 1];
  celebrate(pick.title, pick.sub, pick.eyebrow);
}

try {
  const t = localStorage.getItem("sw.theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch { /* ignore */ }

async function pairDevice(code) {
  history.replaceState(null, "", `${location.pathname}#/`); // drop the token from the address bar straight away
  const p = readPairCode(code || "");
  if (!p) { toast("That setup link looks broken. Make a fresh one in Settings on your other device.", "bad"); route(); return; }
  try {
    await connectDevice(p.repo, p.token);
    toast("This device is connected. 🏁");
  } catch (e) {
    toast(e.message, "bad");
  }
  route();
}

$$("[data-sos]").forEach((b) => b.addEventListener("click", openSOS));

// ---------- boot ----------
store.subscribe(maybeRerender);
setInterval(() => { if (document.visibilityState === "visible" && configured()) syncNow(); }, 120000);
window.addEventListener("hashchange", navigate);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (configured()) syncNow(); route(); } });
// Midnight rollover (new tip), and markers passing while the page is open.
let lastDay = new Date().toDateString();
setInterval(() => {
  if (new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); route(); }
  else if (!document.querySelector("dialog[open]")) checkMilestones();
}, 60000);

route();
enter(view);
if (configured()) syncNow(); else borrowToken();
window.__sw = { store, setRec, syncNow, pairLink }; // handy for debugging in the console
