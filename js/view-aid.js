// The aid station: in-the-moment tools, your if-then plans, your reasons, and where to get support.
import { esc, live, uid } from "./util.js?v=1";
import { profile, removeRec, setRec, store } from "./store.js?v=1";
import { $, $$, toast } from "./ui.js?v=1";
import { BELIEFS, FOUR_DS, fill, SUPPORT, TRIGGERS, triggerLabel } from "./content.js?v=1";
import { patterns } from "./quit.js?v=1";
import { breathingDrill, openSOS } from "./sos.js?v=1";

export function renderAid(view) {
  const s = store.state, p = profile();
  const pat = patterns(s, Date.now(), 3650);
  const ranked = new Map(pat.triggers);
  const plans = Object.entries(s.plans).filter(([, x]) => live(x));
  const reasons = Object.entries(s.reasons).filter(([, x]) => live(x));
  const triggers = [...TRIGGERS].sort((a, b) => (ranked.get(b.id) || 0) - (ranked.get(a.id) || 0));

  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Aid station</p>
      <h1 class="page-title">Everything you need mid-race.</h1>
      <p class="lede">Grab what helps, and leave the rest.</p>
    </header>

    <div class="aid-top">
      <button class="panel aid-big sos-card" type="button" data-act="sos"><span class="eyebrow">Craving now</span><b>Ride it out</b><small>5-minute timer, breathing pacer, your reasons</small></button>
      <button class="panel aid-big" type="button" data-act="breathe"><span class="eyebrow">Practice</span><b>Breathing drill</b><small>2 minutes · in for 4, out for 6</small></button>
    </div>

    <section class="panel fourds">
      <h2 class="sec">The four Ds</h2>
      <ol class="ds">${FOUR_DS.map((d, i) => `<li><span class="d-num">${i + 1}</span><b>${esc(d.k)}</b><p>${esc(d.t)}</p></li>`).join("")}</ol>
    </section>

    <div class="aid-grid">
      <section class="panel plans">
        <h2 class="sec">If-then plans <small>sorted by your log</small></h2>
        <p class="fine">Deciding ahead of time beats deciding in the moment. Your most frequent triggers are first.</p>
        <ul class="plan-list">${triggers.slice(0, 8).map((t) => {
          const own = plans.find(([, x]) => x.trigger === t.id);
          return `<li><p class="label">If ${esc(t.label.toLowerCase())}${ranked.get(t.id) ? ` <span class="pill">${ranked.get(t.id)}× logged</span>` : ""}</p>
            <form class="row-form" data-plan="${t.id}"><input name="then" value="${esc(own ? own[1].then : fill(t.plan, p.product))}" aria-label="Then: plan for ${esc(t.label)}" maxlength="200"><button class="btn ghost">Save</button></form></li>`;
        }).join("")}</ul>
      </section>

      <section class="panel reasons">
        <h2 class="sec">Your reasons <small>shown during every craving</small></h2>
        <blockquote class="why">“${esc(p.why)}”</blockquote>
        <ul class="reason-list">${reasons.map(([id, r]) => `<li><span>${esc(r.text)}</span><button class="link danger" type="button" data-del="${esc(id)}" aria-label="Remove reason">remove</button></li>`).join("")}</ul>
        <form class="row-form" id="reasonForm"><input name="text" placeholder="Add a reason" aria-label="New reason" maxlength="140" required><button class="btn">Add</button></form>
      </section>
    </div>

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
  $$("[data-plan]", view).forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const trig = f.dataset.plan;
    const then = String(new FormData(f).get("then") || "").trim();
    const own = plans.find(([, x]) => x.trigger === trig);
    setRec("plans", own ? own[0] : uid(), { trigger: trig, then });
    toast(`Plan saved for “${triggerLabel(trig)}”.`);
  }));
  $("#reasonForm", view).addEventListener("submit", (e) => {
    e.preventDefault();
    setRec("reasons", uid(), { text: String(new FormData(e.target).get("text")).trim() });
  });
  $$("[data-del]", view).forEach((b) => b.addEventListener("click", () => removeRec("reasons", b.dataset.del)));
}
