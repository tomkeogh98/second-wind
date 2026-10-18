// Dates are handled as local 'YYYY-MM-DD' strings; moments in time as epoch milliseconds.
export const pad = (n) => String(n).padStart(2, "0");
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => fmt(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
export const weekday = (s) => parse(s).getDay(); // 0 Sun … 6 Sat
export const mondayOf = (s) => addDays(s, -((weekday(s) + 6) % 7));
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const dateOf = (ms) => fmt(new Date(ms));
// 'YYYY-MM-DDTHH:MM' in local time <-> epoch ms
export const toLocalInput = (ms) => { const d = new Date(ms); return `${fmt(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fromLocalInput = (v) => { const [d, t = "00:00"] = String(v).split("T"); const [h, m] = t.split(":").map(Number); const x = parse(d); x.setHours(h || 0, m || 0, 0, 0); return x.getTime(); };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const dayName = (s) => DAY_NAMES[weekday(s)];
export const shortDay = (s) => DAY_NAMES[weekday(s)].slice(0, 3);
export const monthName = (m) => MONTHS[m];
export const prettyDate = (s) => { const d = parse(s); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const shortDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
export const longDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const clockTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Durations
export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
export function split(ms) {
  ms = Math.max(0, ms);
  return { d: Math.floor(ms / DAY), h: Math.floor((ms % DAY) / HOUR), m: Math.floor((ms % HOUR) / MIN), s: Math.floor((ms % MIN) / 1000) };
}
// "3 days 4 hours", "52 minutes": the two biggest units
export function humanDur(ms) {
  const { d, h, m } = split(ms);
  const u = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d >= 1) return h ? `${u(d, "day")} ${u(h, "hour")}` : u(d, "day");
  if (h >= 1) return m ? `${u(h, "hour")} ${u(m, "min")}` : u(h, "hour");
  return u(Math.max(m, 0), "minute");
}
export function shortDur(ms) {
  const { d, h, m } = split(ms);
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const live = (rec) => Boolean(rec) && !rec.deleted;
export const money = (v, dp = 0) => `£${Number(v || 0).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const plural = (n, w, pl = `${w}s`) => `${n} ${n === 1 ? w : pl}`;
