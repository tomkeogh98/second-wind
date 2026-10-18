// Splits: the day tracker (green clean · grey before the start · red slip), craving patterns, slips and the journal.
import { clockTime, esc, live, monthName, parse, plural, prettyDate, today } from "./util.js?v=1";
import { profile, removeRec, setRec, store } from "./store.js?v=1";
import { $, $$, modal, toast } from "./ui.js?v=1";
import { dayStatus, liveSlips, patterns, quitDate, slipsOn, cravingsOn, totals } from "./quit.js?v=1";
import { triggerLabel, TRIGGERS } from "./content.js?v=1";
import { logSlip } from "./sos.js?v=1";

const STATUS = { clean: "Clean", assumed: "No slips logged (not checked in)", slip: "Slip", today: "Today", off: "Before the start", future: "" };

export function renderSplits(view) {
  const s = store.state, p = profile(), now = today();
  const q = quitDate(p) || now;
  const tot = totals(s, p, now);
  const pat = patterns(s);
  const first = parse(q < now ? q : now);
  const months = [];
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= parse(now); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(new Date(d));
  if (!months.length) months.push(new Date(parse(now).getFullYear(), parse(now).getMonth(), 1));
  months.reverse();
  const slips = liveSlips(s).reverse();
  const maxH = Math.max(1, ...pat.byHour);

  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Splits</p>
      <h1 class="page-title">Every day, honestly.</h1>
      <p class="lede">Green is a clean, checked-in day. Red is a slip. Grey is before your start line. Outlined days had no slip logged but no check-in: tap one to confirm it.</p>
    </header>

    <dl class="stats-strip">
      <div><dt>Clean days</dt><dd><b>${tot.clean + tot.assumed}</b><small>of ${tot.days}</small></dd></div>
      <div><dt>Checked in</dt><dd><b>${tot.checked}</b><small>days</small></dd></div>
      <div><dt>Slips</dt><dd><b>${slips.filter((x) => x.at >= p.quitAt).length}</b><small>logged</small></dd></div>
      <div><dt>Cravings</dt><dd><b>${pat.beat}</b><small>of ${pat.total} beaten · 4 wks</small></dd></div>
    </dl>

    <div class="splits-grid">
      <section class="panel cal-panel">
        <h2 class="sec">The tracker</h2>
        <p class="legend fine"><i class="st-clean"></i>clean <i class="st-assumed"></i>not checked in <i class="st-slip"></i>slip <i class="st-off"></i>before the start</p>
        ${months.map((m) => month(s, p, m, now)).join("")}
      </section>

      <aside class="side">
        <section class="panel patterns">
          <h2 class="sec">Your hills <small>last 4 weeks</small></h2>
          ${pat.total ? `
            <p class="label">When cravings hit</p>
            <div class="hours" role="img" aria-label="Cravings by hour of day${pat.peak != null ? `, busiest around ${pat.peak}:00` : ""}">${pat.byHour.map((n, h) => `<i style="--h:${(n / maxH).toFixed(2)}" class="${pat.peak != null && (h === pat.peak || h === (pat.peak + 1) % 24) ? "peak" : ""}" title="${h}:00 · ${n}"></i>`).join("")}</div>
            <div class="hours-axis fine"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
            ${pat.peak != null ? `<p>Busiest around <b>${String(pat.peak).padStart(2, "0")}:00–${String((pat.peak + 2) % 24).padStart(2, "0")}:00</b>. Plan something for that window.</p>` : ""}
            <p class="label">What sets them off</p>
            <ul class="trig-bars">${pat.triggers.slice(0, 6).map(([t, n]) => `<li><span>${esc(triggerLabel(t))}</span><i style="--w:${(n / pat.triggers[0][1]).toFixed(2)}"></i><b>${n}</b></li>`).join("")}</ul>
            ${pat.top ? `<p class="plan-tip"><span class="label">Plan for “${esc(triggerLabel(pat.top))}”</span>${esc(planText(s, pat.top))} <a href="#/aid">Edit plans →</a></p>` : ""}`
          : `<p>No cravings logged yet. Use the SOS button when one hits: it times the craving and logs the trigger, so this fills in with your real pattern.</p>`}
        </section>
        <section class="panel slips">
          <h2 class="sec">Slips <small>${slips.length}</small></h2>
          ${slips.length ? `<ul class="slip-list">${slips.slice(0, 8).map((x) => `<li><b>${esc(prettyDate(x.date))}, ${clockTime(x.at)}</b> · ${esc(triggerLabel(x.trigger))}${x.note ? `<br><span class="fine">${esc(x.note)}</span>` : ""} <button class="link danger" type="button" data-unslip data-at="${x.at}">remove</button></li>`).join("")}</ul>` : `<p class="fine">None. Keep it that way.</p>`}
          <button class="btn ghost" type="button" data-act="slip">Log a slip</button>
        </section>
      </aside>
    </div>

    <section class="panel journal-list">
      <h2 class="sec">Journal <small>from your check-ins</small></h2>
      ${journal(s)}
    </section>`;

  $$("[data-date]", view).forEach((b) => b.addEventListener("click", () => dayPanel(b.dataset.date)));
  $("[data-act='slip']", view)?.addEventListener("click", () => logSlip());
  $$("[data-unslip]", view).forEach((b) => b.addEventListener("click", () => {
    const id = Object.keys(store.state.slips).find((k) => store.state.slips[k].at === Number(b.dataset.at) && live(store.state.slips[k]));
    if (id) { removeRec("slips", id); toast("Slip removed."); }
  }));
}

function planText(s, trig) {
  const own = Object.values(s.plans).find((x) => live(x) && x.trigger === trig);
  return own ? `If ${triggerLabel(trig).toLowerCase()}, then ${own.then.charAt(0).toLowerCase()}${own.then.slice(1)}` : TRIGGERS.find((t) => t.id === trig)?.plan || "";
}

function month(s, p, m, now) {
  const y = m.getFullYear(), mo = m.getMonth();
  const days = new Date(y, mo + 1, 0).getDate();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<span class="cal-pad"></span>`);
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const st = dayStatus(s, p, ds, now);
    const n = cravingsOn(s, ds).length;
    cells.push(st === "future" ? `<span class="day st-future"><b>${d}</b></span>` : `<button type="button" class="day st-${st}${ds === now ? " is-today" : ""}" data-date="${ds}" aria-label="${prettyDate(ds)}: ${STATUS[st]}${n ? `, ${plural(n, "craving")}` : ""}"><b>${d}</b>${n ? `<small>${n}</small>` : ""}</button>`);
  }
  return `<div class="month"><h3>${monthName(mo)} ${y}</h3><div class="cal-head">${["M", "T", "W", "T", "F", "S", "S"].map((x) => `<span>${x}</span>`).join("")}</div><div class="cal">${cells.join("")}</div></div>`;
}

function journal(s) {
  const entries = Object.entries(s.checkins).filter(([, c]) => live(c) && (c.note || "").trim()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!entries.length) return `<p class="fine">Journal entries from your daily check-ins land here.</p>`;
  return `<div class="entries">${entries.slice(0, 60).map(([d, c]) => `<article class="entry${c.clean === false ? " slip" : ""}">
    <p class="entry-date">${esc(prettyDate(d))}${c.clean === false ? " · slip" : ""}</p>
    <p>${esc(c.note)}</p>
    <p class="fine">${[c.cravings != null ? `cravings ${c.cravings}/5` : "", c.mood ? `mood ${c.mood}/5` : "", c.sleep ? `sleep ${c.sleep}/5` : ""].filter(Boolean).join(" · ")}</p>
  </article>`).join("")}</div>`;
}

export function dayPanel(d) {
  const s = store.state, p = profile();
  const st = dayStatus(s, p, d);
  const ci = live(s.checkins[d]) ? s.checkins[d] : null;
  const cr = cravingsOn(s, d), sl = slipsOn(s, d);
  modal(`<div class="sheet-body">
    <p class="kicker">${esc(STATUS[st] || "")}</p>
    <h2>${esc(prettyDate(d))}</h2>
    ${ci ? `<p>${ci.clean === false ? "Checked in: not clean." : "Checked in: clean."} ${ci.note ? `“${esc(ci.note)}”` : ""}</p>` : st === "off" ? "<p>Before your start line.</p>" : "<p>No check-in for this day.</p>"}
    ${cr.length ? `<p class="label">Cravings</p><ul class="mini-list">${cr.map((c) => `<li>${clockTime(c.at)} · ${esc(triggerLabel(c.trigger))}${c.intensity ? ` · ${c.intensity}/5` : ""} · ${c.outcome === "slip" ? "slipped" : "beaten ✓"}</li>`).join("")}</ul>` : ""}
    ${sl.length ? `<p class="label">Slips</p><ul class="mini-list">${sl.map((x) => `<li>${clockTime(x.at)} · ${esc(triggerLabel(x.trigger))}</li>`).join("")}</ul>` : ""}
    ${st !== "off" && st !== "future" ? `<div class="row-actions">
      ${!sl.length ? `<button class="btn primary" type="button" data-set="clean">Mark clean ✓</button>` : ""}
      <button class="btn ghost" type="button" data-set="slip">Log a slip on this day</button>
    </div>` : ""}
  </div>`, (dlg) => {
    $("[data-set='clean']", dlg)?.addEventListener("click", () => { setRec("checkins", d, { clean: true }); dlg.close(); toast(`${prettyDate(d)} marked clean.`); });
    $("[data-set='slip']", dlg)?.addEventListener("click", () => { dlg.close(); const at = parse(d); at.setHours(20, 0, 0, 0); logSlip({ at: Math.min(Date.now(), at.getTime()) }); });
  });
}

