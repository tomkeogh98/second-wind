// The course: health markers along the route, and the elevation profile of withdrawal.
import { DAY, esc, humanDur } from "./util.js?v=5";
import { profile } from "./store.js?v=5";
import { context } from "./ui.js?v=5";
import { elevation } from "./chart.js?v=5";
import { SOURCES } from "./content.js?v=5";

export function renderCourse(view) {
  const c = context();
  const p = profile();
  const cp = c.course;
  const label = { vape: "vaping", smoke: "smoking", both: "smoking and vaping" }[p.product];
  view.innerHTML = `
    <header class="page-head">
      <p class="kicker">The course</p>
      <h1 class="page-title">What comes back, and when.</h1>
      <p class="lede">Every marker is something your body does once nicotine${p.product !== "vape" ? " and smoke are" : " is"} out of the picture, timed from your last ${p.product === "smoke" ? "cigarette" : "puff"}. ${cp.reached} of ${cp.list.length} passed. Tailored for quitting ${label}.</p>
    </header>

    <section class="panel elev-panel">
      <h2 class="sec">Elevation profile <small>the first 30 days</small></h2>
      <p class="fine">Withdrawal climbs in the first hours, peaks around day three (the wall), then eases over two to four weeks. After that, what's left is short cravings set off by cues. ${c.started ? `You're <b>${esc(humanDur(c.cleanMs))}</b> in.` : "Your dot appears once you start."}</p>
      ${elevation(c.started ? c.cleanMs / DAY : 0)}
    </section>

    <ol class="route">
      ${cp.list.map((m, i) => {
        const state = m.reached ? "passed" : m === cp.next ? "next" : "ahead";
        const left = m.at - cp.clean;
        return `<li class="marker-row ${state}">
          <div class="km"><b>${esc(m.km)}</b><small>${/\d/.test(m.km) ? "km" : ""}</small></div>
          <div class="marker-dot" aria-hidden="true">${m.reached ? "✓" : i + 1}</div>
          <div class="marker-body">
            <p class="marker-time">${esc(humanAt(m.at))}${state === "next" ? ` · <b>${esc(humanDur(left))} to go</b>` : state === "passed" ? " · passed" : ""}</p>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.body)}</p>
            ${state === "next" ? `<span class="bar"><i style="width:${(cp.frac * 100).toFixed(1)}%"></i></span>` : ""}
            ${m.src ? `<p class="src">Source: ${esc(m.src)}</p>` : ""}
          </div>
        </li>`;
      }).join("")}
    </ol>

    <section class="panel sources">
      <h2 class="sec">Where this comes from</h2>
      <p class="fine">Smoking markers follow the NHS quit timeline. Vaping is newer and the long-term research is still coming in, so vaping markers stick to what's known about nicotine and withdrawal. A slip restarts the clock on these markers, but not the money you've saved.</p>
      <ul class="src-list">${SOURCES.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a></li>`).join("")}</ul>
    </section>`;
}

function humanAt(ms) {
  const m = ms / 60000;
  if (m < 60) return `${Math.round(m)} minutes`;
  const h = m / 60;
  if (h < 48) return `${Math.round(h)} hours`;
  const d = h / 24;
  if (d < 14) return `${Math.round(d)} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  if (d < 365) return `${Math.round(d / 30)} months`;
  const y = Math.round(d / 365);
  return y === 1 ? "1 year" : `${y} years`;
}
