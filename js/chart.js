// The elevation profile: the typical withdrawal curve drawn as the course's hills, with
// "you are here" and your own daily craving ratings dotted over the top. Hand-rolled SVG.
import { addDays, esc } from "./util.js?v=1";
import { withdrawal } from "./content.js?v=1";
import { dailyCraving, quitDate } from "./quit.js?v=1";

const W = 960, H = 300, PAD = { l: 28, r: 20, t: 34, b: 40 };
const DAYS = 30;
const x = (d) => PAD.l + (d / DAYS) * (W - PAD.l - PAD.r);
const y = (v) => H - PAD.b - v * (H - PAD.t - PAD.b);

export function elevation(s, p, cleanDays, nowDate) {
  const pts = [];
  for (let i = 0; i <= DAYS * 4; i++) { const d = i / 4; pts.push([x(d), y(withdrawal(d))]); }
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join(" ");
  const area = `${line} L${x(DAYS)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const here = Math.min(DAYS, Math.max(0, cleanDays));
  const hx = x(here), hy = y(withdrawal(here));
  const done = pts.filter(([a]) => a <= hx);
  const doneLine = done.length > 1 ? done.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join(" ") : "";

  // Your own data: craving rating (0–5) per day since quit day.
  const dots = [];
  const q = quitDate(p);
  if (q) for (let i = 0; i < DAYS; i++) {
    const d = addDays(q, i);
    if (d > nowDate) break;
    const v = dailyCraving(s, d);
    if (v != null) dots.push({ d: i + 0.5, v: v / 5, date: d, raw: v });
  }
  const ticks = [0, 3, 7, 14, 21, 28];
  const desc = `Typical nicotine withdrawal: rises in the first hours, peaks around day 3, eases over two to four weeks. You are at day ${Math.floor(cleanDays)}.${dots.length ? ` ${dots.length} days of your own craving ratings are plotted.` : ""}`;
  return `<figure class="elev">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="elevFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
        <pattern id="contour" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 12 L12 0" stroke="var(--line-2)" stroke-width="1"/></pattern>
      </defs>
      ${[0.25, 0.5, 0.75, 1].map((v) => `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}" class="elev-grid"/>`).join("")}
      <path d="${area}" fill="url(#contour)" opacity=".5"/>
      <path d="${area}" fill="url(#elevFill)"/>
      <path d="${line}" class="elev-line"/>
      ${doneLine ? `<path d="${doneLine}" class="elev-done"/>` : ""}
      <g class="elev-wall"><line x1="${x(3)}" x2="${x(3)}" y1="${y(1) - 4}" y2="${y(0)}"/><text x="${x(3)}" y="${y(1) - 12}" text-anchor="middle">THE WALL · DAY 3</text></g>
      <text x="${x(21)}" y="${y(withdrawal(21)) - 16}" text-anchor="middle" class="elev-note">cue cravings: short, rare</text>
      ${dots.map((o) => `<circle cx="${x(o.d).toFixed(1)}" cy="${y(o.v).toFixed(1)}" r="5" class="elev-dot"><title>${esc(o.date)}: cravings ${o.raw}/5</title></circle>`).join("")}
      <g class="elev-here" transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)})"><line y1="0" y2="${(y(0) - hy).toFixed(1)}"/><circle r="9"/><circle r="4" class="core"/></g>
      ${ticks.map((t) => `<text x="${x(t)}" y="${H - 14}" text-anchor="middle" class="elev-tick">${t === 0 ? "START" : `DAY ${t}`}</text>`).join("")}
    </svg>
    <figcaption><span><i class="k-line"></i>Typical withdrawal (the shape, not your data)</span>${dots.length ? `<span><i class="k-dot"></i>Your daily craving rating</span>` : ""}<span><i class="k-here"></i>You${cleanDays > DAYS ? `: day ${Math.floor(cleanDays)}, off the end of the map` : ""}</span></figcaption>
  </figure>`;
}
