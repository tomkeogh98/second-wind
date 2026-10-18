// Today: the clock, what you've saved, what's happening in your body, today's tip and what's coming up.
// Nothing to fill in: the only buttons are SOS and "I slipped".
import { dateOf, esc, humanDur, money, pad, prettyDate, split } from "./util.js?v=5";
import { store } from "./store.js?v=5";
import { $, $$, context } from "./ui.js?v=5";
import { pickGreeting } from "./greetings.js?v=5";
import { planFor, words } from "./content.js?v=5";
import { cleanFor, dailyCost, lastNicotine, milestones } from "./quit.js?v=5";
import { openSOS, reasons, slipped } from "./sos.js?v=5";

let greeting = null; // one greeting per page load
let clockTimer = null;

export function renderToday(view) {
  clearInterval(clockTimer);
  const c = context();
  const { s, p } = c;
  greeting ||= pickGreeting(c);
  const plan = planFor(Math.max(1, c.day), p.product);
  const cp = c.course;
  const ms = milestones(s, p);
  const nextMs = ms.findIndex((m) => !m.done);
  const from = nextMs < 0 ? ms.length - 5 : Math.max(0, nextMs - 1);
  const shown = ms.slice(from, from + 5);
  const perDay = dailyCost(p);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">${esc(greeting.h)}</h1>
        <p class="hero-sub">${esc(greeting.s)}</p>
        <div class="hero-cta">
          <button class="btn sos-btn big" type="button" data-act="sos"><span class="pulse-dot" aria-hidden="true"></span>Craving? Ride it out</button>
        </div>
      </div>
      ${bib(c)}
      <dl class="hero-stats">
        <div><dt>Saved</dt><dd><b data-count="${c.savedN.toFixed(2)}" data-dp="${c.savedN < 100 ? 2 : 0}" data-pre="£" id="liveSaved">${esc(c.saved)}</b></dd></div>
        <div><dt>Pods not bought</dt><dd><b data-count="${c.avoided.pods}">${c.avoided.pods}</b><small>${esc(p.device)} pods</small></dd></div>
        <div><dt>Nicotine not inhaled</dt><dd><b data-count="${c.avoided.mg}">${c.avoided.mg.toLocaleString("en-GB")}</b><small>mg</small></dd></div>
        <div><dt>Cravings beaten</dt><dd><b data-count="${c.beat}">${c.beat}</b><small>with SOS</small></dd></div>
      </dl>
    </section>

    <div class="today-grid">
      <section class="panel tip">
        <h2 class="sec">Today's tip <small>Day ${c.day} · ${esc(prettyDate(c.now))}</small></h2>
        <p class="b-title">${esc(plan.title)}</p>
        <p class="tip-about">${esc(plan.about)}</p>
        <p class="tip-try"><span class="label">Try this</span>${esc(plan.task)}</p>
        <p class="fine">${esc(plan.builds)}</p>
      </section>
      <a class="panel body-now" href="#/course">
        <span class="eyebrow">In your body right now</span>
        ${cp.last ? `<b>${esc(cp.last.title)}</b><span class="body-copy">${esc(cp.last.body)}</span>` : `<b>The first minutes</b><span class="body-copy">Nicotine is a stimulant. Without a top-up, your heart rate starts to settle. First cravings usually show up within a few hours: hit SOS when they do.</span>`}
        ${cp.next ? `<span class="next-line"><span class="label">Next · ${esc(cp.next.title)}</span><span class="bar"><i style="width:${(cp.frac * 100).toFixed(1)}%"></i></span><span class="fine">in ${esc(humanDur(cp.next.at - c.cleanMs))} · see the course →</span></span>` : ""}
      </a>
    </div>

    <div class="today-grid">
      <section class="panel coming">
        <h2 class="sec">Coming up <small>${money(perDay * 7, 2)} a week back in your pocket</small></h2>
        <ol class="ms-list">${shown.map((m) => `<li class="${m.done ? "done" : m === ms[nextMs] ? "next" : ""}">
          <span class="ms-dot" aria-hidden="true">${m.done ? "✓" : ""}</span>
          <span class="ms-title"><b>${esc(m.title)}</b><small>${m.done ? "done" : `${esc(prettyDate(dateOf(m.when)))}, ${pad(new Date(m.when).getHours())}:${pad(new Date(m.when).getMinutes())}`}</small></span>
          <span class="ms-money">${money(m.money)}<small>saved</small></span>
        </li>`).join("")}</ol>
      </section>
      <aside class="panel why-panel">
        <h2 class="sec">Remember why</h2>
        <blockquote class="why">“${esc(p.why)}”</blockquote>
        <ul class="reason-list">${reasons().slice(1).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      </aside>
    </div>

    <p class="slip-link"><button class="link" type="button" data-act="slip">Slipped? Restart the clock</button></p>`;

  $$("[data-act='sos']", view).forEach((b) => b.addEventListener("click", openSOS));
  $("[data-act='slip']", view).addEventListener("click", slipped);
  startClock(view, c);
}

function bib(c) {
  const { p } = c;
  const { d } = split(c.cleanMs);
  return `<div class="bib" aria-label="Time since your last ${esc(words(p.product).puff)}">
    <div class="bib-top"><span>Second Wind</span><span>Oxford · ${esc(p.name || "Tom")}</span></div>
    <p class="bib-label">${d === 1 ? "Day" : "Days"} clean</p>
    <p class="bib-num"><b id="clockD">${d}</b></p>
    <p class="bib-time tc" id="clockT" aria-live="off">00:00:00</p>
    <div class="bib-foot"><span>Since ${esc(new Date(lastNicotine(c.s, p)).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span><span>Not a ${esc(words(p.product).puff)}</span></div>
    <i class="pin tl"></i><i class="pin tr"></i><i class="pin bl"></i><i class="pin br"></i>
  </div>`;
}

function startClock(view, c) {
  const D = $("#clockD", view), T = $("#clockT", view), S = $("#liveSaved", view);
  if (!D || !T) return;
  const perMs = dailyCost(c.p) / 86400000;
  let n = 0;
  const tick = () => {
    if (!view.isConnected) return clearInterval(clockTimer);
    const x = split(cleanFor(store.state, c.p));
    D.textContent = String(x.d);
    T.textContent = `${pad(x.h)}:${pad(x.m)}:${pad(x.s)}`;
    // let the count-up finish, then keep the money ticking too
    if (S && ++n > 2) S.textContent = money(Math.max(0, (Date.now() - c.p.quitAt) * perMs), 2);
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}
