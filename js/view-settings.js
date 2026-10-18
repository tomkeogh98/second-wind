// Settings: your numbers (built in), the look, and optional sync between devices.
import { esc, money } from "./util.js?v=3";
import { profile, store } from "./store.js?v=3";
import { devicesCard, wireDevices } from "./devices.js?v=3";
import { $, $$ } from "./ui.js?v=3";
import { dailyCost } from "./quit.js?v=3";
import { slipped } from "./sos.js?v=3";

export function renderSettings(view) {
  const p = profile();
  const theme = document.documentElement.dataset.theme || "system";
  const perDay = dailyCost(p);
  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Settings</p>
      <h1 class="page-title">Kit bag.</h1>
    </header>
    <div class="settings-grid">
      <section class="panel">
        <h2 class="sec">Your numbers</h2>
        <dl class="facts">
          <div><dt>Device</dt><dd>${esc(p.device)}, pre-filled pods</dd></div>
          <div><dt>Pods</dt><dd>2 ml each, 20 mg/ml nicotine salt, rated up to ~600 puffs</dd></div>
          <div><dt>You used</dt><dd>${p.podsDay} pod a day (a 2-pack lasts two days) · ${p.podsDay * 2} ml · ${p.podsDay * 2 * p.vape.mgml} mg of nicotine</dd></div>
          <div><dt>Cost</dt><dd>${money(perDay, 2)} a day · ${money(perDay * 7, 2)} a week · ${money(perDay * 365)} a year</dd></div>
          <div><dt>Start line</dt><dd>${esc(new Date(p.quitAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" }))}</dd></div>
        </dl>
        <p><button class="btn ghost" type="button" data-act="slip">Slipped? Restart the clock</button></p>
      </section>
      <section class="panel">
        <h2 class="sec">Look</h2>
        <div class="chips" role="group" aria-label="Theme">${[["system", "Match device"], ["light", "Day race"], ["dark", "Night race"]].map(([v, t]) => `<button type="button" class="chip${theme === v ? " on" : ""}" data-theme-set="${v}" aria-pressed="${theme === v}">${t}</button>`).join("")}</div>
        <p class="fine">Second Wind sits alongside <a href="https://tomkeogh98.github.io/the-cut/">The Cut</a> and <a href="https://tomkeogh98.github.io/guitar-hero/">Guitar Hero</a>.</p>
      </section>
      <details class="panel optional-sync">
        <summary><b>Sync across devices</b> <span class="fine">(optional: only slips and cravings-beaten need it; the clock works everywhere already)</span></summary>
        ${devicesCard(store.settings)}
      </details>
    </div>`;

  $("[data-act='slip']", view).addEventListener("click", slipped);
  $$("[data-theme-set]", view).forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.themeSet;
    if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    try { if (v === "system") localStorage.removeItem("sw.theme"); else localStorage.setItem("sw.theme", v); } catch { /* ignore */ }
    $$("[data-theme-set]", view).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
  }));
  wireDevices(view, () => renderSettings(view));
}
