// The toolkit: in-the-moment tools, a plan for every trigger, the things your brain will say, and support. Read-only.
import { esc } from "./util.js?v=2";
import { profile } from "./store.js?v=2";
import { $ } from "./ui.js?v=2";
import { BELIEFS, FOUR_DS, fill, SUPPORT, TRIGGERS } from "./content.js?v=2";
import { breathingDrill, openSOS } from "./sos.js?v=2";

export function renderTools(view) {
  const p = profile();
  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Toolkit</p>
      <h1 class="page-title">Everything you need mid-race.</h1>
      <p class="lede">Nothing to fill in. Grab what helps, and leave the rest.</p>
    </header>

    <div class="aid-top">
      <button class="panel aid-big sos-card" type="button" data-act="sos"><span class="eyebrow">Craving now</span><b>Ride it out</b><small>5-minute timer, breathing pacer, your reasons</small></button>
      <button class="panel aid-big" type="button" data-act="breathe"><span class="eyebrow">Practice</span><b>Breathing drill</b><small>2 minutes · in for 4, out for 6</small></button>
    </div>

    <section class="panel fourds">
      <h2 class="sec">When a craving hits: the four Ds</h2>
      <ol class="ds">${FOUR_DS.map((d, i) => `<li><span class="d-num">${i + 1}</span><b>${esc(d.k)}</b><p>${esc(d.t)}</p></li>`).join("")}</ol>
    </section>

    <section class="panel plans">
      <h2 class="sec">A plan for every trigger</h2>
      <p class="fine">Deciding ahead of time beats deciding in the moment. Find your moment, and do the thing.</p>
      <dl class="trigger-grid">${TRIGGERS.filter((t) => t.id !== "other").map((t) => `<div><dt>If ${esc(t.label.toLowerCase())}…</dt><dd>${esc(fill(t.plan, p.product))}</dd></div>`).join("")}</dl>
    </section>

    <section class="panel beliefs">
      <h2 class="sec">Things your brain will say</h2>
      <div class="belief-grid">${BELIEFS.map((b) => `<div class="belief"><p class="myth">${esc(b.myth)}</p><p>${esc(b.truth)}</p></div>`).join("")}</div>
    </section>

    <section class="panel support">
      <h2 class="sec">Support crew</h2>
      <p class="fine">You're up to three times more likely to quit with a stop-smoking adviser and stop-smoking aids than going it alone (NHS). It's free, and it works for vaping too.</p>
      <ul class="support-list">${SUPPORT.map((x) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.t)} ↗</b></a>` : `<b>${esc(x.t)}</b>`}<p>${esc(x.d)}</p></li>`).join("")}</ul>
    </section>`;

  $("[data-act='sos']", view).addEventListener("click", openSOS);
  $("[data-act='breathe']", view).addEventListener("click", breathingDrill);
}
