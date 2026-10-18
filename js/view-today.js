// Today (race day) and first-run registration.
import { addDays, dateOf, DAY, dayName, esc, fromLocalInput, humanDur, live, mondayOf, money, pad, plural, prettyDate, shortDate, shortDay, split, toLocalInput, uid } from "./util.js?v=1";
import { borrowToken, DEFAULT_PROFILE, onboarded, profile, setProfile, setRec, siblingTokens, store } from "./store.js?v=1";
import { connectForm, wireConnectForm } from "./devices.js?v=1";
import { $, $$, celebrate, context, nudgeText, toast } from "./ui.js?v=1";
import { pickGreeting } from "./greetings.js?v=1";
import { planFor, REASON_IDEAS, words } from "./content.js?v=1";
import { checkinStreak, cleanFor, cravingsOn, dailyCost, dayList, dayStatus, lastNicotine, nudgeCheck, slipsOn, started } from "./quit.js?v=1";
import { nextUp } from "./goals.js?v=1";
import { logSlip, openSOS } from "./sos.js?v=1";

let greeting = null; // one greeting per page load, so ticking boxes doesn't reshuffle it
let clockTimer = null;

export function renderToday(view) {
  clearInterval(clockTimer);
  if (!onboarded()) return renderRegistration(view);
  const c = context();
  const { s, p, now } = c;
  greeting ||= pickGreeting(c);
  const w = words(p.product);
  const nudge = nudgeCheck(s, p);
  const list = dayList(s, p, now);
  const plan = planFor(c.started ? c.day : 1 - c.daysToGo, p.product);
  const yPlan = c.started && c.day > 1 ? planFor(c.day - 1, p.product) : null;
  const cp = c.course;
  const streak = checkinStreak(s, now);
  const next = nextUp(s, p).slice(0, 2);
  const isRunDay = c.weekday === 3;

  view.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">${esc(greeting.h)}</h1>
        <p class="hero-sub">${esc(greeting.s)}</p>
        <div class="hero-cta">
          ${c.started ? `<button class="btn sos-btn big" type="button" data-act="sos"><span class="pulse-dot" aria-hidden="true"></span>Craving? Ride it out</button>
            <button class="btn ghost" type="button" data-act="slip">Log a slip</button>`
          : `<button class="btn primary big" type="button" data-act="startnow">Start now instead</button> <a class="btn ghost" href="#/settings">Change quit time</a>`}
        </div>
      </div>
      ${bib(c)}
      ${c.started ? `<dl class="hero-stats">
        <div><dt>Saved</dt><dd><b data-count="${c.savedN.toFixed(2)}" data-dp="${c.savedN < 100 ? 2 : 0}" data-pre="£">${esc(c.saved)}</b></dd></div>
        ${p.product !== "smoke" ? `<div><dt>Nicotine left in the bottle</dt><dd><b data-count="${c.avoided.mg}">${c.avoided.mg.toLocaleString("en-GB")}</b><small>mg</small></dd></div>` : ""}
        ${p.product !== "vape" ? `<div><dt>Not smoked</dt><dd><b data-count="${c.avoided.cigs}">${c.avoided.cigs.toLocaleString("en-GB")}</b><small>cigarettes</small></dd></div>` : ""}
        <div><dt>Hills climbed</dt><dd><b data-count="${c.beat}">${c.beat}</b><small>cravings beaten</small></dd></div>
        <div><dt>Check-in streak</dt><dd><b data-count="${streak}">${streak}</b><small>${streak === 1 ? "day" : "days"}</small></dd></div>
      </dl>` : `<dl class="hero-stats">
        <div><dt>Quit day</dt><dd><b>${esc(shortDate(dateOf(p.quitAt)))}</b><small>${esc(dayName(dateOf(p.quitAt)))}</small></dd></div>
        <div><dt>You'll save</dt><dd><b>${esc(money(dailyCost(p) * 7, 2))}</b><small>a week</small></dd></div>
        <div><dt>In a year</dt><dd><b>${esc(money(dailyCost(p) * 365))}</b><small>back in your pocket</small></dd></div>
        <div><dt>Prep</dt><dd><b>${Math.max(0, Math.min(7, 8 - c.daysToGo))}</b><small>of 7 days</small></dd></div>
      </dl>`}
    </section>

    ${nudge ? `<aside class="coach" role="note">
      <p class="coach-head">Coach's note</p>
      <p class="coach-body">${esc(nudgeText(nudge))}</p>
      ${nudge.kind === "confirm" ? `<p class="coach-actions"><button class="btn primary" type="button" data-confirm="clean">Yes, it was clean</button> <button class="btn ghost" type="button" data-confirm="slip">No, I slipped</button></p>` : ""}
      ${nudge.kind === "wobble" ? `<p class="coach-actions"><a class="btn" href="#/aid">Get support →</a></p>` : ""}
      <p class="coach-why"><span>Remember why</span>“${esc(p.why)}”</p>
    </aside>` : ""}

    <section class="panel brief">
      <h2 class="sec">The story so far <small>${c.started ? `Day ${c.day} · ${prettyDate(now)}` : `Prep · quit day is ${prettyDate(dateOf(p.quitAt))}`}</small></h2>
      <ol class="brief-cols">
        <li><p class="b-label"><i>01</i> Previously</p><p>${previously(c, yPlan)}</p></li>
        <li class="b-today"><p class="b-label"><i>02</i> Today</p><p class="b-title">${esc(plan.title)}</p><p>${esc(plan.about)}</p></li>
        <li><p class="b-label"><i>03</i> How it builds</p><p>${esc(plan.builds)}</p></li>
      </ol>
    </section>

    <div class="today-grid">
      <section class="panel the-list">
        <h2 class="sec">${c.started ? "Today's splits" : "Today's prep"} <small>${c.started ? `${list.done} of ${list.total}${list.full ? " · full day" : ""}` : `${[list.items.plan, list.items.move].filter(Boolean).length} of 2`}</small></h2>
        <div class="items">
          ${!c.started ? "" : item("checkin", list.items.checkin, "Check in", list.items.checkin ? checkinLine(s, now) : `Was today clean? Thirty seconds, honest answer.`, list.items.checkin ? "" : `<a class="btn ghost" href="#checkin-box" data-act="tocheck">Check in ↓</a>`)}
          ${item("plan", list.items.plan, plan.task, `Today's focus: ${plan.title}.`, "", true)}
          ${item("move", list.items.move, isRunDay ? "Run club (or move 20 min)" : "Move for 20 minutes", isRunDay ? "18:45, Oxford Run Club. Notice your breathing on the hills." : "Walk, run, lift. Exercise is one of the fastest ways to cut a craving short.", "", true)}
          ${!c.started ? "" : item("journal", list.items.journal, "Journal", "Two lines on how it went. It's part of the check-in below.", list.items.journal ? "" : `<a class="btn ghost" href="#checkin-box" data-act="tocheck">Write it ↓</a>`)}
        </div>
      </section>
      <aside class="side">
        <section class="panel week">
          <h2 class="sec">This week</h2>
          <div class="week-strip">${Array.from({ length: 7 }, (_, i) => {
            const d = addDays(mondayOf(now), i);
            const st = dayStatus(s, p, d, now);
            return `<a class="wd st-${st}${d === now ? " is-today" : ""}" href="#/splits" aria-label="${prettyDate(d)}: ${LABEL[st]}"><span>${shortDay(d).slice(0, 2)}</span><b>${MARK[st]}</b></a>`;
          }).join("")}</div>
          <p class="fine legend"><i class="st-clean"></i>clean <i class="st-assumed"></i>not checked in <i class="st-slip"></i>slip <i class="st-off"></i>before the start</p>
        </section>
        ${cp.next && c.started ? `<a class="panel next-marker" href="#/course">
          <span class="eyebrow">Next marker · ${esc(cp.next.km)}${/\d/.test(cp.next.km) ? " km" : ""}</span>
          <b>${esc(cp.next.title)}</b>
          <span class="bar"><i style="width:${(cp.frac * 100).toFixed(1)}%"></i></span>
          <span class="fine">in ${esc(humanDur(cp.next.at - c.cleanMs))} · see the course →</span>
        </a>` : ""}
        ${next.length ? `<a class="panel next-medals" href="#/medals"><span class="eyebrow">Medals in reach</span>${next.map(({ g, m, frac }) => `<span class="nm"><b>${esc(m.title)}</b><small>${esc(g.name)}</small><span class="bar"><i style="width:${(Math.min(1, frac) * 100).toFixed(0)}%"></i></span></span>`).join("")}</a>` : ""}
      </aside>
    </div>

    <section class="panel checkin" id="checkin-box">
      <h2 class="sec">Check-in <small>${prettyDate(now)}</small></h2>
      ${c.started ? checkinForm(s, now) : `<p>Check-ins start on quit day. For now, work through the prep above.</p>`}
    </section>`;

  wireToday(view, c);
}

const LABEL = { clean: "clean", assumed: "no slips logged, not checked in", slip: "slip", today: "today", off: "before the start", future: "to come" };
const MARK = { clean: "✓", assumed: "·", slip: "✕", today: "●", off: "–", future: "" };

function bib(c) {
  const { p } = c;
  if (!c.started) {
    return `<div class="bib pre" aria-label="Countdown to your quit time">
      <div class="bib-top"><span>Second Wind</span><span>Start line</span></div>
      <p class="bib-label">Starts in</p>
      <p class="bib-num"><b id="clockD">${split(p.quitAt - c.nowMs).d}</b><small>days</small></p>
      <p class="bib-time tc" id="clockT">--:--:--</p>
      <div class="bib-foot"><span>${esc(prettyDate(dateOf(p.quitAt)))}</span><span>${esc(new Date(p.quitAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span></div>
      <i class="pin tl"></i><i class="pin tr"></i><i class="pin bl"></i><i class="pin br"></i>
    </div>`;
  }
  const { d } = split(c.cleanMs);
  return `<div class="bib" aria-label="Time since your last ${esc(words(p.product).puff)}">
    <div class="bib-top"><span>Second Wind</span><span>Oxford · ${esc(p.name || "Tom")}</span></div>
    <p class="bib-label">${d === 1 ? "Day" : "Days"} clean</p>
    <p class="bib-num"><b id="clockD">${d}</b></p>
    <p class="bib-time tc" id="clockT" aria-live="off">00:00:00</p>
    <div class="bib-foot"><span>Since ${esc(new Date(lastNicotine(c.s, p)).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }))}</span><span>Not a ${esc(words(p.product).puff)}</span></div>
    <i class="pin tl"></i><i class="pin tr"></i><i class="pin bl"></i><i class="pin br"></i>
  </div>`;
}

function startClock(view, c) {
  const D = $("#clockD", view), T = $("#clockT", view);
  if (!D || !T) return;
  const p = c.p;
  const tick = () => {
    if (!view.isConnected) return clearInterval(clockTimer);
    const ms = c.started ? cleanFor(store.state, p) : p.quitAt - Date.now();
    if (!c.started && ms <= 0) { clearInterval(clockTimer); window.dispatchEvent(new Event("sw:refresh")); return; }
    const x = split(ms);
    D.textContent = String(x.d);
    T.textContent = `${pad(x.h)}:${pad(x.m)}:${pad(x.s)}`;
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function previously(c, yPlan) {
  const { s, p, now } = c;
  if (!c.started) return c.daysToGo >= 7 ? "Registration's done. The prep plan starts a week before your quit day." : `Yesterday's prep: ${esc(planFor(-c.daysToGo, p.product).title.toLowerCase())}.`;
  if (c.day === 1) return `You picked your line and showed up to it. ${esc(p.product === "smoke" ? "The last cigarette is behind you." : "The last puff is behind you.")}`;
  const y = addDays(now, -1);
  const st = dayStatus(s, p, y, now);
  const beat = cravingsOn(s, y).filter((x) => x.outcome !== "slip").length;
  const slips = slipsOn(s, y).length;
  const parts = [];
  if (st === "clean") parts.push("Yesterday was clean and checked in.");
  else if (st === "assumed") parts.push("No slips logged yesterday, but no check-in either.");
  else if (st === "slip") parts.push(`Yesterday had ${slips > 1 ? `${slips} slips` : "a slip"}. Logged honestly, which is how you learn from it.`);
  if (beat) parts.push(`You rode out ${plural(beat, "craving")}.`);
  if (yPlan) parts.push(`Focus was <b>${esc(yPlan.title.toLowerCase())}</b>.`);
  return parts.join(" ");
}

function checkinLine(s, d) {
  const ci = s.checkins[d];
  if (!ci) return "";
  return ci.clean === false ? "Logged: not clean today. Tomorrow's a fresh start." : `Clean${ci.cravings != null ? ` · cravings ${ci.cravings}/5` : ""}${ci.mood ? ` · mood ${ci.mood}/5` : ""}`;
}

function item(key, done, title, sub, action, tickable = false) {
  return `<div class="item${done ? " done" : ""}" data-item="${key}">
    ${tickable ? `<button class="tick" type="button" data-tick="${key}" aria-pressed="${done}" aria-label="${esc(title)}: ${done ? "done" : "not done"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>` : `<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`}
    <div class="item-body"><p class="item-title">${esc(title)}</p><p class="item-sub">${sub}</p></div>
    ${action ? `<div class="item-act">${action}</div>` : ""}
  </div>`;
}

const scale = (name, label, val, lo, hi, hint) => `<fieldset class="scale"><legend>${esc(label)} <span class="fine">${esc(hint)}</span></legend><div class="chips">${Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => `<label class="chip num${Number(val) === n ? " on" : ""}"><input type="radio" name="${name}" value="${n}"${Number(val) === n ? " checked" : ""}> ${n}</label>`).join("")}</div></fieldset>`;

function checkinForm(s, d) {
  const ci = live(s.checkins[d]) ? s.checkins[d] : {};
  const slipped = slipsOn(s, d).length > 0;
  return `<form class="checkin-form" id="checkinForm">
    <div class="clean-q" role="group" aria-label="Was today clean?">
      <p class="label">Clean today?</p>
      <label class="big-choice yes${ci.clean === true && !slipped ? " on" : ""}"><input type="radio" name="clean" value="yes"${ci.clean === true && !slipped ? " checked" : ""}> <b>Yes</b><small>not a puff</small></label>
      <label class="big-choice no${ci.clean === false || slipped ? " on" : ""}"><input type="radio" name="clean" value="no"${ci.clean === false || slipped ? " checked" : ""}> <b>I slipped</b><small>log it, learn it</small></label>
    </div>
    <div class="scales">
      ${scale("cravings", "Cravings", ci.cravings, 0, 5, "0 none · 5 brutal")}
      ${scale("mood", "Mood", ci.mood, 1, 5, "1 low · 5 great")}
      ${scale("sleep", "Sleep", ci.sleep, 1, 5, "1 awful · 5 great")}
    </div>
    <label>Journal <span class="fine">How did it go? What helped?</span><textarea name="note" rows="3" placeholder="e.g. Coffee was the hard bit. Walked round the block and it passed.">${esc(ci.note || "")}</textarea></label>
    <button class="btn primary">${live(s.checkins[d]) ? "Update check-in" : "Check in"}</button>
  </form>`;
}

function wireToday(view, c) {
  const { p, now } = c;
  startClock(view, c);
  $$("[data-act='sos']", view).forEach((b) => b.addEventListener("click", openSOS));
  $("[data-act='slip']", view)?.addEventListener("click", () => logSlip());
  $("[data-act='startnow']", view)?.addEventListener("click", () => {
    setProfile({ quitAt: Date.now() });
    celebrate("You're off", "The clock's running. Win the next few minutes.", "Start line crossed");
  });
  $$("[data-act='tocheck']", view).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); $("#checkin-box", view).scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => $("#checkinForm textarea", view)?.focus({ preventScroll: true }), 400); }));
  $$("[data-tick]", view).forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.tick;
    const cur = Boolean(store.state.tasks[now]?.[k]);
    setRec("tasks", now, { [k]: !cur });
    if (!cur && dayList(store.state, p, now).full) toast("Full day. Every split ticked. 🏁");
  }));
  $$("[data-confirm]", view).forEach((b) => b.addEventListener("click", () => {
    const y = addDays(now, -1);
    if (b.dataset.confirm === "clean") { setRec("checkins", y, { clean: true }); toast("Confirmed: yesterday was clean."); }
    else logSlip();
  }));
  // check-in form
  const form = $("#checkinForm", view);
  if (!form) return;
  form.addEventListener("change", (e) => {
    if (e.target.name && e.target.type === "radio") $$(`input[name="${e.target.name}"]`, form).forEach((r) => r.closest("label").classList.toggle("on", r.checked));
    if (e.target.name === "clean" && e.target.value === "no" && !slipsOn(store.state, now).length) logSlip();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const clean = f.get("clean");
    if (!clean) { toast("First: was today clean?", "bad"); return; }
    const num = (k) => (f.get(k) == null ? null : Number(f.get(k)));
    const first = !live(store.state.checkins[now]);
    setRec("checkins", now, { clean: clean === "yes", cravings: num("cravings"), mood: num("mood"), sleep: num("sleep"), note: String(f.get("note") || "").trim() });
    toast(first ? (clean === "yes" ? "Checked in. Another clean day on the board." : "Checked in. Honest splits are the useful ones.") : "Check-in updated.");
  });
}

// ---------- registration (first run) ----------
export function renderRegistration(view) {
  const p = { ...DEFAULT_PROFILE, ...(store.state.profile || {}) };
  const sibs = siblingTokens();
  view.innerHTML = `
    <section class="reg-hero">
      <p class="kicker">Race registration</p>
      <h1 class="page-title">Let's get your <span class="hl">second wind</span>, ${esc(p.name)}.</h1>
      <p class="lede">A quit tracker built like race day. A live clock from your last puff, a course of health markers, a craving SOS, honest splits and medals worth earning. Two minutes to set up.</p>
    </section>
    <div class="reg-grid">
      <form class="panel reg-form" id="regForm">
        <h2 class="sec">Your entry</h2>
        <label>Name <input name="name" value="${esc(p.name)}" autocomplete="given-name"></label>
        <fieldset class="product"><legend>What are you quitting?</legend>
          ${[["vape", "Vaping", "pods, refills"], ["smoke", "Smoking", "cigarettes, rollies"], ["both", "Both", "dual use"]].map(([v, t, sub]) => `<label class="big-choice${p.product === v ? " on" : ""}"><input type="radio" name="product" value="${v}"${p.product === v ? " checked" : ""}><b>${t}</b><small>${sub}</small></label>`).join("")}
        </fieldset>
        <div class="usage" data-for="vape">
          <p class="label">Your vaping</p>
          <div class="row3">
            <label>Nicotine strength <span class="fine">mg/ml</span><input type="number" name="mgml" min="0" max="20" step="1" value="${p.vape.mgml}" inputmode="numeric"></label>
            <label>Liquid a week <span class="fine">ml · a pod is ~2 ml</span><input type="number" name="mlWeek" min="0" max="100" step="0.5" value="${p.vape.mlWeek}" inputmode="decimal"></label>
            <label>Spend a week <span class="fine">£</span><input type="number" name="costWeek" min="0" max="500" step="0.5" value="${p.vape.costWeek}" inputmode="decimal"></label>
          </div>
        </div>
        <div class="usage" data-for="smoke">
          <p class="label">Your smoking</p>
          <div class="row3">
            <label>Cigarettes a day <input type="number" name="perDay" min="0" max="80" step="1" value="${p.smoke.perDay}" inputmode="numeric"></label>
            <label>Price of 20 <span class="fine">£</span><input type="number" name="packPrice" min="0" max="60" step="0.1" value="${p.smoke.packPrice}" inputmode="decimal"></label>
          </div>
        </div>
        <fieldset class="when"><legend>When's your start line?</legend>
          <label class="big-choice on"><input type="radio" name="when" value="now" checked><b>Right now</b><small>the last one's already gone</small></label>
          <label class="big-choice"><input type="radio" name="when" value="later"><b>Pick a time</b><small>a week of prep first</small></label>
          <label class="big-choice"><input type="radio" name="when" value="past"><b>I already quit</b><small>backdate it</small></label>
          <label class="when-at" hidden>Quit at <input type="datetime-local" name="quitAt" value="${toLocalInput(Date.now() + 7 * DAY)}"></label>
        </fieldset>
        <fieldset class="method"><legend>How?</legend>
          <label class="inline"><input type="radio" name="method" value="cold"${p.method !== "taper" ? " checked" : ""}> Stop on the day</label>
          <label class="inline"><input type="radio" name="method" value="taper"${p.method === "taper" ? " checked" : ""}> Step down first</label>
          <p class="fine">Both work about equally well (Cochrane review). What matters most is setting a date and having support.</p>
        </fieldset>
        <label>Your why <span class="fine">This shows up every time a craving does.</span><textarea name="why" rows="2">${esc(p.why)}</textarea></label>
        <p class="label">Add a few more reasons</p>
        <div class="chips reason-ideas">${REASON_IDEAS.map((r, i) => `<label class="chip"><input type="checkbox" name="idea" value="${i}"${i < 2 ? " checked" : ""}> ${esc(r)}</label>`).join("")}</div>
        <button class="btn primary big">Pin the bib on <span aria-hidden="true">→</span></button>
      </form>
      <aside class="panel join">
        <h2 class="sec">Already registered?</h2>
        <p>If you've set Second Wind up on another device, connect this one and everything comes across.</p>
        ${sibs.length ? `<p><button class="btn" type="button" id="regBorrow">Connect with ${esc(sibs[0].name)}'s token</button></p><p class="fine" id="regBorrowMsg" role="status"></p>` : ""}
        ${connectForm(store.settings, { submit: "Connect & pull my data" })}
        <p class="fine">Or open the setup link / QR code from Settings on your other device.</p>
      </aside>
    </div>`;

  const form = $("#regForm", view);
  const sync = () => {
    const prod = form.product.value;
    $$(".usage", form).forEach((u) => { u.hidden = !(prod === "both" || u.dataset.for === prod); });
    $$(".big-choice", form).forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
    const when = form.when.value;
    const at = $(".when-at", form);
    at.hidden = when === "now";
    const inp = form.quitAt;
    if (when === "past") { inp.max = toLocalInput(Date.now()); inp.removeAttribute("min"); if (fromLocalInput(inp.value) > Date.now()) inp.value = toLocalInput(Date.now() - DAY); }
    if (when === "later") { inp.min = toLocalInput(Date.now()); inp.removeAttribute("max"); if (fromLocalInput(inp.value) < Date.now()) inp.value = toLocalInput(Date.now() + 7 * DAY); }
  };
  form.addEventListener("change", sync);
  sync();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const n = (k, fb) => (f.get(k) === "" || f.get(k) == null ? fb : Number(f.get(k)));
    const when = f.get("when");
    const quitAt = when === "now" ? Date.now() : fromLocalInput(String(f.get("quitAt")));
    setProfile({
      name: String(f.get("name") || "Tom").trim() || "Tom",
      product: String(f.get("product")),
      method: String(f.get("method") || "cold"),
      vape: { mgml: n("mgml", 20), mlWeek: n("mlWeek", 6), costWeek: n("costWeek", 15) },
      smoke: { perDay: n("perDay", 10), packPrice: n("packPrice", 17) },
      why: String(f.get("why") || "").trim() || DEFAULT_PROFILE.why,
      quitAt,
    });
    for (const i of f.getAll("idea")) setRec("reasons", uid(), { text: REASON_IDEAS[Number(i)] });
    setRec("attempts", uid(), { quitAt, product: String(f.get("product")) });
    if (started(profile())) celebrate("You're off", "The clock's running. Win the next few minutes.", "Start line crossed");
    else toast("You're registered. The prep plan starts now.");
  });
  wireConnectForm(view, () => window.dispatchEvent(new Event("sw:refresh")));
  $("#regBorrow", view)?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    $("#regBorrowMsg", view).textContent = "Checking…";
    const name = await borrowToken();
    if (name) toast(`Connected using ${name}'s token.`);
    else { e.target.disabled = false; $("#regBorrowMsg", view).textContent = "That token can't see quit-vaping-data yet. Add the repo to it on GitHub, or paste a token below."; }
  });
}

