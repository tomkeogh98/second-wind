// Craving SOS ("ride it out"), the one-tap slip, and the breathing drill. Nothing to fill in.
import { dateOf, esc, pad, pickRandom, reducedMotion, uid } from "./util.js?v=5";
import { profile, setRec, store } from "./store.js?v=5";
import { DISTRACTIONS, REASON_IDEAS, words } from "./content.js?v=5";
import { cravingsBeaten } from "./quit.js?v=5";
import { $, celebrate, modal, toast } from "./ui.js?v=5";

const RIDE = 5 * 60; // most cravings peak and pass within a few minutes

export const reasons = () => [profile().why, ...REASON_IDEAS.slice(0, 5)];

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
  const prompts = [...reasons().map((t) => ({ k: "Remember why", t })), ...DISTRACTIONS.map((t) => ({ k: "Try this", t }))];
  const first = prompts[0];
  let done = false;
  const t0 = Date.now();

  modal(`<div class="sos">
    <p class="kicker">Craving SOS</p>
    <h2 class="sos-title">Ride it out.</h2>
    <p class="sos-lede">Cravings peak and fade within a few minutes. You don't have to beat it forever, only for the next five.</p>
    <div class="sos-core">
      <div class="pacer" aria-hidden="true"><i></i><span class="pacer-word">Breathe in</span></div>
      <div class="sos-time"><b id="sosClock">5:00</b><small>left on the hill</small></div>
    </div>
    <div class="sos-prompt" aria-live="polite"><span id="sosK">${esc(first.k)}</span><p id="sosT">${esc(first.t)}</p><button type="button" class="link" id="sosNext">Another one →</button></div>
    <div class="sos-actions">
      <button class="btn primary big" type="button" id="sosBeat">Craving's gone ✓</button>
      <button class="btn ghost" type="button" id="sosSlip">I slipped</button>
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
    const show = () => { const x = pickRandom(prompts); $("#sosK", d).textContent = x.k; $("#sosT", d).textContent = x.t; };
    const rot = setInterval(show, 20000);
    $("#sosNext", d).addEventListener("click", show);
    $("#sosBeat", d).addEventListener("click", () => {
      if (done) return;
      done = true;
      setRec("cravings", uid(), { at: t0, date: dateOf(t0), outcome: "beat", secs: Math.round((Date.now() - t0) / 1000) });
      d.close();
      const n = cravingsBeaten(store.state);
      celebrate(n === 1 ? "First hill climbed" : `Hill ${n} climbed`, "That craving didn't win.", "Craving beaten");
    });
    $("#sosSlip", d).addEventListener("click", () => { d.close(); slipped(); });
    d.addEventListener("close", () => { clearInterval(tick); clearInterval(rot); stopPacer(); });
  }, "sos-sheet");
}

// A slip: one tap restarts the clock. Money saved and everything you've learned stay.
export function slipped() {
  const w = words(profile().product);
  modal(`<div class="sheet-body slip-sheet">
    <p class="kicker">Slipped?</p>
    <h2>It happens. Keep running.</h2>
    <p>A slip is a stumble, not the end of the race. Most people who quit for good had a few along the way. The clock and the health markers restart; what you've learned doesn't.</p>
    <p class="fine">Useful question for later: what set it off? Whatever it was, there's a plan for it in the Toolkit.</p>
    <div class="row-actions">
      <button class="btn primary" type="button" id="slipYes">Restart the clock</button>
      <button class="btn ghost" type="button" data-close>Actually, I didn't</button>
    </div>
  </div>`, (d) => {
    $("#slipYes", d).addEventListener("click", () => {
      const at = Date.now();
      setRec("slips", uid(), { at, date: dateOf(at) });
      d.close();
      toast(`Clock restarted. Not a ${w.puff} from here.`);
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

