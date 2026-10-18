// The rules: the clock, what you've saved, the course and the milestones ahead.
// Pure functions of (state, profile, now) so they're easy to test. scripts/nudge.py in
// second-wind-data mirrors lastNicotine / course(). Keep them in sync.
import { dateOf, DAY, daysBetween, HOUR, live, today } from "./util.js?v=3";
import { course } from "./content.js?v=3";

export const quitDate = (p) => (p.quitAt ? dateOf(p.quitAt) : null);
export const started = (p, nowMs = Date.now()) => Boolean(p.quitAt) && nowMs >= p.quitAt;
export const dayNumber = (p, now = today()) => (quitDate(p) ? daysBetween(quitDate(p), now) + 1 : 0);

export const liveSlips = (s, p) => Object.values(s.slips).filter((x) => live(x) && x.at >= p.quitAt).sort((a, b) => a.at - b.at);

// The last nicotine: your quit moment, or the latest slip after it.
export function lastNicotine(s, p) {
  const slips = liveSlips(s, p);
  return slips.length ? slips[slips.length - 1].at : p.quitAt;
}
export const cleanFor = (s, p, nowMs = Date.now()) => Math.max(0, nowMs - lastNicotine(s, p));

// ---------- money, pods and nicotine (counted from the quit moment; a slip doesn't buy pods) ----------
export const dailyCost = (p) => Number(p.vape.costWeek || 0) / 7 + (p.product !== "vape" ? (Number(p.smoke.packPrice || 0) / 20) * Number(p.smoke.perDay || 0) : 0);
const daysSince = (p, nowMs) => (started(p, nowMs) ? (nowMs - p.quitAt) / DAY : 0);
export const saved = (p, nowMs = Date.now()) => dailyCost(p) * daysSince(p, nowMs);
export function avoided(p, nowMs = Date.now()) {
  const days = daysSince(p, nowMs);
  return {
    pods: Math.floor(Number(p.podsDay || 0) * days),
    mg: Math.round((Number(p.vape.mgml) * Number(p.vape.mlWeek) * days) / 7),
    puffs: Math.floor(Number(p.podsDay || 0) * 600 * days), // a BM600 pod is rated up to ~600 puffs
  };
}

// ---------- the course ----------
export function courseProgress(s, p, nowMs = Date.now()) {
  const clean = started(p, nowMs) ? cleanFor(s, p, nowMs) : 0;
  const list = course(p.product).map((m) => ({ ...m, reached: clean >= m.at, eta: lastNicotine(s, p) + m.at }));
  const next = list.find((m) => !m.reached) || null;
  const last = [...list].reverse().find((m) => m.reached) || null;
  const prevAt = last?.at || 0;
  const frac = next ? (clean - prevAt) / (next.at - prevAt) : 1;
  return { list, next, last, clean, frac: Math.max(0, Math.min(1, frac)), reached: list.filter((m) => m.reached).length };
}

// ---------- milestones ahead: when each lands and what you'll have saved by then ----------
export const MILESTONES = [
  [24 * HOUR, "24 hours"], [72 * HOUR, "72 hours"], [7 * DAY, "One week"], [14 * DAY, "Two weeks"], [28 * DAY, "28 days"],
  [42 * DAY, "Six weeks"], [91 * DAY, "Three months"], [182 * DAY, "Six months"], [365 * DAY, "One year"],
];
// Whole-day milestones land at the same clock time even across a clocks-change (calendar days, not 24h blocks).
const later = (from, at) => {
  if (at % DAY) return from + at;
  const d = new Date(from);
  d.setDate(d.getDate() + at / DAY);
  return d.getTime();
};
export function milestones(s, p, nowMs = Date.now()) {
  const from = lastNicotine(s, p);
  return MILESTONES.map(([at, title]) => {
    const when = later(from, at);
    return { id: `t-${at}`, at, title, when, done: nowMs >= when, money: dailyCost(p) * (at / DAY) };
  });
}

export const cravingsBeaten = (s) => Object.values(s.cravings).filter((c) => live(c) && c.outcome !== "slip").length;
