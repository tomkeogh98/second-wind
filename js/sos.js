// Craving SOS ("ride it out"), the slip log and the breathing drill.
import { dateOf, esc, fromLocalInput, live, pad, pickRandom, reducedMotion, toLocalInput, uid } from "./util.js?v=1";
import { profile, setRec, store } from "./store.js?v=1";
import { DISTRACTIONS, TRIGGERS, triggerLabel, words } from "./content.js?v=1";
import { cravingsBeaten } from "./quit.js?v=1";
import { $, $$, celebrate, modal, toast } from "./ui.js?v=1";

const RIDE = 5 * 60; // most cravings peak and pass within a few minutes

const reasonsList = () => {
  const p = profile();
  return [p.why, ...Object.values(store.state.reasons).filter(live).map((r) => r.text)].filter(Boolean);
};

const chips = (name, list, sel) => list.map((t) => `<button type="button" class="chip${sel === t.id ? " on" : ""}" data-${name}="${esc(t.id)}" aria-pressed="${sel === t.id}">${esc(t.label)}</button>`).join("");

// The breathing pacer: in for 4, out for 6 (a long exhale is what slows the heart).
function pacer(el) {
  if (!el) return () => {};
  const label = el.querySelector(".pacer-word");
  let alive = true, phase = 0;
  const step = () => {
    if (!alive) return;
    const inhale = phase % 2 === 0;
    el.classList.toggle("in", inhale);
    el.classList.toggle("out", !inhale);
    if (label) label.textContent = inhale ? "Breathe in" : "Breathe out";
    phase++;
    setTimeout(step, inhale ? 4000 : 6000);
  };
  step();
  return () => { alive = false; };
}

export function openSOS() {
  const p = profile();
  const reasons = reasonsList();
  const prompts = [...reasons.map((r) => ({ k: "Remember why", t: r })), ...DISTRACTIONS.map((t) => ({ k: "Try this", t }))];
  const pick = () => pickRandom(prompts);
  let intensity = null, trigger = null, done = false;
  const t0 = Date.now();

  modal(`<div class="sos">
    <p class="kicker">Craving SOS</p>
    <h2 class="sos-title">Ride it out.</h2>
    <p class="sos-lede">Cravings peak and fade within a few minutes. You don't have to beat it forever, only for the next five.</p>
    <div class="sos-core">
      <div class="pacer" aria-hidden="true"><i></i><span class="pacer-word">Breathe in</span></div>
      <div class="sos-time"><b id="sosClock">5:00</b><small>left on the hill</small></div>
    </div>
    <div class="sos-prompt" aria-live="polite"><span id="sosK">Remember why</span><p id="sosT">${esc(reasons[0] || DISTRACTIONS[0])}</p><button type="button" class="link" id="sosNext">Another one →</button></div>
    <div class="sos-log">
      <p class="label">How strong? <span class="fine">(optional)</span></p>
      <div class="chips" role="group" aria-label="Craving strength">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip num" data-int="${n}" aria-pressed="false">${n}</button>`).join("")}</div>
      <p class="label">What set it off?</p>
      <div class="chips" role="group" aria-label="Trigger">${chips("trig", TRIGGERS, null)}</div>
    </div>
    <div class="sos-actions">
      <button class="btn primary big" type="button" id="sosBeat">Craving's gone ✓</button>
      <button class="btn ghost" type="button" id="sosSlip">I ${esc(words(p.product).thing === "smoke" ? "smoked" : "slipped")}</button>
    </div>
  </div>`, (d) => {
    const stopPacer = reducedMotion() ? () => {} : pacer($(".pacer", d));
    const clock = $("#sosClock", d);
    const tick = setInterval(() => {
      const left = Math.max(0, RIDE - Math.floor((Date.now() - t0) / 1000));
      clock.textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
      if (left === 0) {
        clearInterval(tick);
        clock.textContent = "Top of the hill";
        $(".sos-time small", d).textContent = "five minutes done. Is it passing?";
        $("#sosBeat", d).classList.add("pulse");
      }
    }, 250);
    const rot = setInterval(() => { const x = pick(); $("#sosK", d).textContent = x.k; $("#sosT", d).textContent = x.t; }, 20000);
    $("#sosNext", d).addEventListener("click", () => { const x = pick(); $("#sosK", d).textContent = x.k; $("#sosT", d).textContent = x.t; });
    $$("[data-int]", d).forEach((b) => b.addEventListener("click", () => {
      intensity = Number(b.dataset.int);
      $$("[data-int]", d).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    }));
    $$("[data-trig]", d).forEach((b) => b.addEventListener("click", () => {
      trigger = b.dataset.trig;
      $$("[data-trig]", d).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    }));
    const save = (outcome) => {
      if (done) return;
      done = true;
      setRec("cravings", uid(), { at: t0, date: dateOf(t0), intensity, trigger: trigger || "other", outcome, secs: Math.round((Date.now() - t0) / 1000) });
    };
    $("#sosBeat", d).addEventListener("click", () => {
      save("beat");
      d.close();
      const n = cravingsBeaten(store.state);
      celebrate(n === 1 ? "First hill climbed" : `Hill ${n} climbed`, trigger ? `${triggerLabel(trigger)} didn't win this time.` : "That craving didn't win.", "Craving beaten");
    });
    $("#sosSlip", d).addEventListener("click", () => { save("slip"); d.close(); logSlip({ trigger }); });
    d.addEventListener("close", () => { clearInterval(tick); clearInterval(rot); stopPacer(); });
  }, "sos-sheet");
}

// Log a slip: honest, quick, no lecture.
export function logSlip(pre = {}) {
  const p = profile();
  const w = words(p.product);
  modal(`<form class="sheet-body slip-form">
    <p class="kicker">Log a slip</p>
    <h2>It happens. Write it down.</h2>
    <p class="fine">A slip is a stumble, not the end of the race. Logging it honestly is how you learn your hardest hills. Your medals stay yours.</p>
    <label>When <input type="datetime-local" name="at" value="${toLocalInput(pre.at || Date.now())}" max="${toLocalInput(Date.now())}" required></label>
    ${p.product === "both" ? `<fieldset><legend>What</legend><label class="inline"><input type="radio" name="what" value="vape" checked> Vape</label><label class="inline"><input type="radio" name="what" value="smoke"> Cigarette</label></fieldset>` : ""}
    <p class="label">What set it off?</p>
    <div class="chips" role="group" aria-label="Trigger">${chips("trig", TRIGGERS, pre.trigger || null)}</div>
    <label>Did you buy anything? <span class="fine">(£, so your savings stay honest)</span><input type="number" name="spent" min="0" step="0.01" inputmode="decimal" placeholder="0"></label>
    <label>What would you do differently? <textarea name="note" rows="2" placeholder="e.g. Leave the pub before the third pint"></textarea></label>
    <button class="btn primary">Log it and keep running</button>
  </form>`, (d) => {
    let trigger = pre.trigger || null;
    $$("[data-trig]", d).forEach((b) => b.addEventListener("click", () => {
      trigger = b.dataset.trig;
      $$("[data-trig]", d).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    }));
    $("form", d).addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const at = Math.min(Date.now(), fromLocalInput(String(f.get("at"))));
      if (at < p.quitAt) { toast("That's before your quit time, so it doesn't count as a slip."); return; }
      setRec("slips", uid(), { at, date: dateOf(at), what: String(f.get("what") || p.product), trigger: trigger || "other", spent: Number(f.get("spent") || 0), note: String(f.get("note") || "").trim() });
      d.close();
      toast(`Logged. The clock restarts, your medals don't. Not a ${w.puff} from here.`);
    });
  });
}

// A two-minute breathing drill, for practice or for a craving.
export function breathingDrill() {
  const t0 = Date.now(), LEN = 120;
  modal(`<div class="sos drill">
    <p class="kicker">Breathing drill · 2 minutes</p>
    <h2 class="sos-title">In for four. Out for six.</h2>
    <p class="sos-lede">The long exhale slows your heart rate. Follow the circle.</p>
    <div class="sos-core"><div class="pacer" aria-hidden="true"><i></i><span class="pacer-word">Breathe in</span></div><div class="sos-time"><b id="drillClock">2:00</b><small>to go</small></div></div>
    <div class="sos-actions"><button class="btn primary" type="button" data-close>Done</button></div>
  </div>`, (d) => {
    const stop = reducedMotion() ? () => {} : pacer($(".pacer", d));
    const tick = setInterval(() => {
      const left = Math.max(0, LEN - Math.floor((Date.now() - t0) / 1000));
      $("#drillClock", d).textContent = left ? `${Math.floor(left / 60)}:${pad(left % 60)}` : "Done";
      if (!left) clearInterval(tick);
    }, 250);
    d.addEventListener("close", () => { clearInterval(tick); stop(); });
  }, "sos-sheet");
}
