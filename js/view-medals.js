// Medals: the trophy wall, what's next, and the reward fund your savings pay into.
import { esc, money, today } from "./util.js?v=1";
import { profile, removeRec, setRec, store } from "./store.js?v=1";
import { $, $$, context, toast } from "./ui.js?v=1";
import { medals, nextUp, rewardProgress } from "./goals.js?v=1";
import { dailyCost } from "./quit.js?v=1";
import { uid } from "./util.js?v=1";

export function renderMedals(view) {
  const s = store.state, p = profile();
  const c = context();
  const groups = medals(s, p);
  const got = groups.reduce((t, g) => t + g.got.length, 0);
  const all = groups.reduce((t, g) => t + g.items.length, 0);
  const up = nextUp(s, p);
  const rewards = rewardProgress(s, p);
  const perWeek = dailyCost(p) * 7;

  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">Medals</p>
      <h1 class="page-title">${got} on the wall.</h1>
      <p class="lede">${got} of ${all} earned. Medals are kept for good, so a slip never takes one away. The trigger medals come from your own craving log, so they always point at your hardest hill.</p>
    </header>

    ${up.length ? `<section class="up-next">${up.map(({ g, m, frac }) => `<div class="panel up">
      <span class="eyebrow">Next up · ${esc(g.name)}</span>
      <b>${esc(m.title)}</b><small>${esc(m.sub)}</small>
      <span class="bar"><i style="width:${(Math.min(1, frac) * 100).toFixed(0)}%"></i></span>
      <span class="fine">${progressText(g.key, m)}</span>
    </div>`).join("")}</section>` : ""}

    <div class="medal-groups">
      ${groups.map((g) => `<section class="panel mgroup">
        <h2 class="sec">${esc(g.name)} <small>${g.got.length}/${g.items.length}</small></h2>
        <p class="fine">${esc(g.blurb)}</p>
        <ul class="medal-row">${g.items.map((m) => `<li class="m ${m.done ? "got" : m === g.next ? "next" : ""}" title="${esc(m.sub)}"><span class="disc" aria-hidden="true">${m.done ? "★" : ""}</span><b>${esc(m.title)}</b><small>${esc(m.sub)}</small><span class="sr-only">${m.done ? "earned" : "not yet"}</span></li>`).join("")}</ul>
      </section>`).join("")}
    </div>

    <section class="panel reward-fund">
      <h2 class="sec">Reward fund <small>${esc(c.saved)} saved · ${money(perWeek, 2)} a week</small></h2>
      <p class="fine">Pick what the money's for. Rewards fill in order from your savings; claim one when it's full and treat yourself properly.</p>
      ${rewards.length ? `<ul class="rewards">${rewards.map((r) => `<li class="${r.claimed ? "claimed" : r.frac >= 1 ? "ready" : ""}">
        <div><b>${esc(r.name)}</b><small>${money(r.have, 2)} of ${money(r.price, 2)}${r.claimed ? ` · claimed ${esc(r.claimed)}` : r.frac < 1 && perWeek ? ` · about ${Math.ceil(((r.price - r.have) / perWeek) * 7)} days to go` : ""}</small></div>
        <span class="bar"><i style="width:${(r.frac * 100).toFixed(0)}%"></i></span>
        <div class="r-act">${!r.claimed && r.frac >= 1 ? `<button class="btn primary" type="button" data-claim="${esc(r.id)}">Claim it</button>` : ""}<button class="link danger" type="button" data-del="${esc(r.id)}" aria-label="Remove ${esc(r.name)}">remove</button></div>
      </li>`).join("")}</ul>` : ""}
      <form class="row-form" id="rewardForm">
        <input name="name" placeholder="e.g. New running shoes" aria-label="Reward" required maxlength="60">
        <input name="price" type="number" min="1" step="1" inputmode="decimal" placeholder="£" aria-label="Price in pounds" required class="price">
        <button class="btn">Add</button>
      </form>
    </section>`;

  $("#rewardForm", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setRec("rewards", uid(), { name: String(f.get("name")).trim(), price: Number(f.get("price")), createdAt: Date.now() });
    toast("Reward added. Your savings are on it.");
  });
  $$("[data-claim]", view).forEach((b) => b.addEventListener("click", () => { setRec("rewards", b.dataset.claim, { claimed: today() }); toast("Claimed. Enjoy it, you earned it. 🏅"); }));
  $$("[data-del]", view).forEach((b) => b.addEventListener("click", () => removeRec("rewards", b.dataset.del)));
}

function progressText(key, m) {
  if (key === "time") return `${Math.floor(m.value / 3600000)} of ${Math.round(m.target / 3600000)} hours on your best run`;
  if (key === "money") return `${money(m.value, 2)} of ${money(m.target)}`;
  return `${Math.floor(m.value)} of ${m.target}`;
}
