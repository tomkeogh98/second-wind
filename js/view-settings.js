// Settings: your entry (product, usage, quit time), a fresh start line, devices & sync, theme and backups.
import { DAY, esc, fromLocalInput, live, money, toLocalInput, uid } from "./util.js?v=1";
import { exportJSON, importJSON, profile, setProfile, setRec, store } from "./store.js?v=1";
import { devicesCard, wireDevices } from "./devices.js?v=1";
import { $, $$, toast } from "./ui.js?v=1";
import { dailyCost } from "./quit.js?v=1";

export function renderSettings(view) {
  const p = profile();
  const theme = document.documentElement.dataset.theme || "system";
  const attempts = Object.values(store.state.attempts).filter(live).sort((a, b) => b.quitAt - a.quitAt);

  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Settings</p>
      <h1 class="page-title">Kit bag.</h1>
    </header>
    <div class="settings-grid">
      <form class="panel" id="profileForm">
        <h2 class="sec">Your entry</h2>
        <label>Name <input name="name" value="${esc(p.name)}"></label>
        <label>Quitting
          <select name="product">${[["vape", "Vaping"], ["smoke", "Smoking"], ["both", "Both"]].map(([v, t]) => `<option value="${v}"${p.product === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <div class="row3" data-for="vape">
          <label>Nicotine <span class="fine">mg/ml</span><input type="number" name="mgml" min="0" max="20" value="${p.vape.mgml}"></label>
          <label>Liquid <span class="fine">ml/week</span><input type="number" name="mlWeek" min="0" step="0.5" value="${p.vape.mlWeek}"></label>
          <label>Spend <span class="fine">£/week</span><input type="number" name="costWeek" min="0" step="0.5" value="${p.vape.costWeek}"></label>
        </div>
        <div class="row3" data-for="smoke">
          <label>Cigarettes <span class="fine">a day</span><input type="number" name="perDay" min="0" value="${p.smoke.perDay}"></label>
          <label>Price of 20 <span class="fine">£</span><input type="number" name="packPrice" min="0" step="0.1" value="${p.smoke.packPrice}"></label>
        </div>
        <p class="fine">That's ${money(dailyCost(p) * 7, 2)} a week, or ${money(dailyCost(p) * 365)} a year.</p>
        <label>Quit time <input type="datetime-local" name="quitAt" value="${toLocalInput(p.quitAt)}"></label>
        <label>Your why <textarea name="why" rows="2">${esc(p.why)}</textarea></label>
        <button class="btn primary">Save</button>
      </form>

      <section class="panel restart">
        <h2 class="sec">New start line</h2>
        <p>If it's gone past a slip into using again, that's not failure. Most people take a few attempts. Set a new line, and everything you've learned (your triggers, plans and medals) comes with you.</p>
        <form id="restartForm" class="row-form">
          <input type="datetime-local" name="at" value="${toLocalInput(Date.now())}" aria-label="New quit time">
          <button class="btn">Set new start</button>
        </form>
        ${attempts.length > 1 ? `<p class="label">Previous start lines</p><ul class="mini-list">${attempts.slice(1).map((a) => `<li>${new Date(a.quitAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</li>`).join("")}</ul>` : ""}
      </section>

      ${devicesCard(store.settings)}

      <section class="panel">
        <h2 class="sec">Look</h2>
        <div class="chips" role="group" aria-label="Theme">${[["system", "Match device"], ["light", "Day race"], ["dark", "Night race"]].map(([v, t]) => `<button type="button" class="chip${theme === v ? " on" : ""}" data-theme-set="${v}" aria-pressed="${theme === v}">${t}</button>`).join("")}</div>
        <h2 class="sec" style="margin-top:28px">Backup</h2>
        <p class="fine">Your data syncs to your private repo, but a local copy never hurts.</p>
        <p><button class="btn" type="button" id="exportBtn">Download backup</button>
        <label class="btn ghost file-btn">Restore from file<input type="file" id="importFile" accept="application/json"></label></p>
        <p class="fine">Second Wind is part of the family with <a href="https://tomkeogh98.github.io/the-cut/">The Cut</a> and <a href="https://tomkeogh98.github.io/guitar-hero/">Guitar Hero</a>.</p>
      </section>
    </div>`;

  const pf = $("#profileForm", view);
  const showUsage = () => $$("[data-for]", pf).forEach((x) => { x.hidden = !(pf.product.value === "both" || pf.product.value === x.dataset.for); });
  pf.product.addEventListener("change", showUsage);
  showUsage();
  pf.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(pf);
    const n = (k) => Number(f.get(k) || 0);
    setProfile({
      name: String(f.get("name") || "Tom").trim(), product: String(f.get("product")), why: String(f.get("why") || "").trim() || p.why,
      vape: { mgml: n("mgml"), mlWeek: n("mlWeek"), costWeek: n("costWeek") }, smoke: { perDay: n("perDay"), packPrice: n("packPrice") },
      quitAt: f.get("quitAt") ? fromLocalInput(String(f.get("quitAt"))) : p.quitAt,
    });
    toast("Saved.");
  });
  $("#restartForm", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const at = fromLocalInput(String(new FormData(e.target).get("at")));
    if (!Number.isFinite(at)) return;
    if (at > Date.now() + 60 * DAY) { toast("Pick a start within the next two months.", "bad"); return; }
    setProfile({ quitAt: at });
    setRec("attempts", uid(), { quitAt: at, product: p.product });
    toast("New start line set. Lace up.");
    location.hash = "#/";
  });
  $$("[data-theme-set]", view).forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.themeSet;
    if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    try { if (v === "system") localStorage.removeItem("sw.theme"); else localStorage.setItem("sw.theme", v); } catch { /* ignore */ }
    $$("[data-theme-set]", view).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
  }));
  $("#exportBtn", view).addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(exportJSON());
    a.download = `second-wind-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#importFile", view).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { importJSON(await file.text()); toast("Backup restored and merged."); } catch (err) { toast(err.message, "bad"); }
  });
  wireDevices(view, () => renderSettings(view));
}
