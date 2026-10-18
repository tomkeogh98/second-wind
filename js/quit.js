// The rules: the clock, what you've saved, day statuses, streaks, craving patterns and nudges.
// Pure functions of (state, profile, now) so they're easy to test. scripts/nudge.py in
// quit-vaping-data mirrors dayStatus / nudgeCheck. Keep them in sync.
import { addDays, dateOf, DAY, daysBetween, HOUR, live, today, weekday } from "./util.js?v=1";
import { course } from "./content.js?v=1";

export const quitDate = (p) => (p.quitAt ? dateOf(p.quitAt) : null);
export const started = (p, nowMs = Date.now()) => Boolean(p.quitAt) && nowMs >= p.quitAt;

export const liveSlips = (s) => Object.values(s.slips).filter(live).sort((a, b) => a.at - b.at);
export const liveCravings = (s) => Object.values(s.cravings).filter(live).sort((a, b) => a.at - b.at);
export const slipsOn = (s, d) => liveSlips(s).filter((x) => x.date === d);
export const cravingsOn = (s, d) => liveCravings(s).filter((x) => x.date === d);

// The last nicotine: your quit moment, or the latest slip after it.
export function lastNicotine(s, p) {
  const after = liveSlips(s).filter((x) => x.at >= p.quitAt);
  return after.length ? Math.max(p.quitAt, after[after.length - 1].at) : p.quitAt;
}
export const cleanFor = (s, p, nowMs = Date.now()) => Math.max(0, nowMs - lastNicotine(s, p));

// The longest clean stretch ever (medals are kept even after a slip).
export function bestRun(s, p, nowMs = Date.now()) {
  if (!started(p, nowMs)) return 0;
  const marks = [p.quitAt, ...liveSlips(s).filter((x) => x.at >= p.quitAt).map((x) => x.at), nowMs];
  let best = 0;
  for (let i = 1; i < marks.length; i++) best = Math.max(best, marks[i] - marks[i - 1]);
  return best;
}

// ---------- money and nicotine ----------
export function dailyCost(p) {
  const v = p.product !== "smoke" ? Number(p.vape.costWeek || 0) / 7 : 0;
  const c = p.product !== "vape" ? (Number(p.smoke.packPrice || 0) / 20) * Number(p.smoke.perDay || 0) : 0;
  return v + c;
}
// Money is counted from the quit moment: slips only cost what you actually spent on them.
export function saved(s, p, nowMs = Date.now()) {
  if (!started(p, nowMs)) return 0;
  const spent = liveSlips(s).reduce((t, x) => t + Number(x.spent || 0), 0);
  return Math.max(0, (dailyCost(p) * (nowMs - p.quitAt)) / DAY - spent);
}
export function avoided(s, p, nowMs = Date.now()) {
  const days = started(p, nowMs) ? (nowMs - p.quitAt) / DAY : 0;
  const slips = liveSlips(s).filter((x) => x.at >= p.quitAt).length;
  return {
    mg: p.product !== "smoke" ? Math.max(0, Math.round((Number(p.vape.mgml) * Number(p.vape.mlWeek) * days) / 7)) : 0,
    ml: p.product !== "smoke" ? Math.max(0, Math.round((Number(p.vape.mlWeek) * days) / 7 * 10) / 10) : 0,
    cigs: p.product !== "vape" ? Math.max(0, Math.floor(Number(p.smoke.perDay) * days) - slips) : 0,
  };
}

// ---------- days ----------
// clean = no slip and confirmed · assumed = no slip logged, not checked in · slip · today · off (before quit day) · future
export function dayStatus(s, p, d, now = today()) {
  const q = quitDate(p);
  if (!q || d < q) return "off";
  if (d > now) return "future";
  if (slipsOn(s, d).some((x) => x.at >= p.quitAt)) return "slip";
  const c = s.checkins[d];
  if (live(c) && c.clean === false) return "slip";
  if (d === now) return live(c) && c.clean ? "clean" : "today";
  return live(c) && c.clean ? "clean" : "assumed";
}
export const dayNumber = (p, now = today()) => (quitDate(p) ? daysBetween(quitDate(p), now) + 1 : 0);

export function totals(s, p, now = today()) {
  const q = quitDate(p);
  const out = { clean: 0, slip: 0, assumed: 0, checked: 0, days: 0 };
  if (!q || now < q) return out;
  for (let d = q; d <= now; d = addDays(d, 1)) {
    const st = dayStatus(s, p, d, now);
    out.days++;
    if (st === "clean") out.clean++;
    else if (st === "slip") out.slip++;
    else if (st === "assumed") out.assumed++;
    if (live(s.checkins[d])) out.checked++;
  }
  return out;
}

// Consecutive check-ins up to today (or yesterday, if today's isn't in yet).
export function checkinStreak(s, now = today()) {
  let d = live(s.checkins[now]) ? now : addDays(now, -1), n = 0;
  while (live(s.checkins[d])) { n++; d = addDays(d, -1); }
  return n;
}
export function bestCheckinStreak(s) {
  const days = Object.keys(s.checkins).filter((d) => live(s.checkins[d])).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

// ---------- the course ----------
export function courseProgress(s, p, nowMs = Date.now()) {
  const markers = course(p.product);
  const clean = started(p, nowMs) ? cleanFor(s, p, nowMs) : 0;
  const best = bestRun(s, p, nowMs);
  const list = markers.map((m) => ({ ...m, reached: clean >= m.at, everReached: best >= m.at, eta: lastNicotine(s, p) + m.at }));
  const next = list.find((m) => !m.reached) || null;
  const prevAt = [...list].reverse().find((m) => m.reached)?.at || 0;
  const frac = next ? (clean - prevAt) / (next.at - prevAt) : 1;
  return { list, next, clean, frac: Math.max(0, Math.min(1, frac)), reached: list.filter((m) => m.reached).length };
}

// ---------- craving patterns ----------
export function patterns(s, nowMs = Date.now(), days = 28) {
  const from = nowMs - days * DAY;
  const list = liveCravings(s).filter((c) => c.at >= from);
  const byHour = Array(24).fill(0);
  const byTrigger = {};
  for (const c of list) {
    byHour[new Date(c.at).getHours()]++;
    byTrigger[c.trigger || "other"] = (byTrigger[c.trigger || "other"] || 0) + 1;
  }
  const triggers = Object.entries(byTrigger).sort((a, b) => b[1] - a[1]);
  // Busiest two-hour window
  let peak = -1, peakN = 0;
  for (let h = 0; h < 24; h++) { const n = byHour[h] + byHour[(h + 1) % 24]; if (n > peakN) { peak = h; peakN = n; } }
  const beat = list.filter((c) => c.outcome !== "slip").length;
  return { list, byHour, triggers, top: triggers[0]?.[0] || null, peak: peakN >= 3 ? peak : null, peakN, beat, total: list.length };
}
export const cravingsBeaten = (s) => liveCravings(s).filter((c) => c.outcome !== "slip").length;
export function beatenFor(s, trigger) { return liveCravings(s).filter((c) => c.trigger === trigger && c.outcome !== "slip").length; }

// Average logged craving strength per day (check-in rating, else the mean of logged cravings).
export function dailyCraving(s, d) {
  const c = s.checkins[d];
  if (live(c) && c.cravings != null) return Number(c.cravings);
  const list = cravingsOn(s, d);
  return list.length ? list.reduce((t, x) => t + Number(x.intensity || 0), 0) / list.length : null;
}

// ---------- today's list ----------
export function dayList(s, p, d = today()) {
  const t = s.tasks[d] || {};
  const ci = s.checkins[d];
  const items = {
    checkin: live(ci),
    plan: Boolean(t.plan),
    move: Boolean(t.move),
    journal: live(ci) && Boolean(String(ci.note || "").trim()),
  };
  const done = Object.values(items).filter(Boolean).length;
  return { items, done, total: 4, full: done === 4 };
}
export function fullDays(s, p, now = today()) {
  const q = quitDate(p);
  let n = 0;
  if (!q) return 0;
  for (let d = q; d <= now; d = addDays(d, 1)) if (dayList(s, p, d).full && dayStatus(s, p, d, now) !== "slip") n++;
  return n;
}

// ---------- nudges: warm, never guilt-tripping ----------
// slipped  - a slip in the last 3 days
// wobble   - 3+ slips in the last 7 days (time to bring in support)
// confirm  - yesterday wasn't checked in
// rising   - craving ratings up three check-ins in a row
// window   - your busiest craving window starts within the next hour
// social   - Friday/Saturday and drinking is a logged trigger
export function nudgeCheck(s, p, nowMs = Date.now()) {
  if (!started(p, nowMs)) return null;
  const now = dateOf(nowMs);
  const slips = liveSlips(s).filter((x) => x.at >= p.quitAt);
  const recent7 = slips.filter((x) => x.at >= nowMs - 7 * DAY);
  if (recent7.length >= 3) return { kind: "wobble", count: recent7.length };
  const last = slips[slips.length - 1];
  if (last && nowMs - last.at < 3 * DAY) return { kind: "slipped", count: slips.length, at: last.at, trigger: last.trigger };
  const y = addDays(now, -1);
  if (y >= quitDate(p) && !live(s.checkins[y]) && dayStatus(s, p, y, now) === "assumed") return { kind: "confirm", date: y };
  const ratings = [3, 2, 1, 0].map((i) => s.checkins[addDays(now, -i)]).filter((c) => live(c) && c.cravings != null).map((c) => Number(c.cravings));
  if (ratings.length >= 3 && ratings.slice(-3).every((v, i, a) => i === 0 || v > a[i - 1])) return { kind: "rising" };
  const pat = patterns(s, nowMs);
  const h = new Date(nowMs).getHours();
  if (pat.peak != null && (pat.peak === h + 1 || pat.peak === h)) return { kind: "window", hour: pat.peak, trigger: pat.top };
  const wd = weekday(now);
  if ((wd === 5 || wd === 6) && pat.triggers.some(([t]) => t === "alcohol") && h >= 15) return { kind: "social" };
  return null;
}

// Hours until the next course marker (for greetings).
export function hoursToNext(s, p, nowMs = Date.now()) {
  const cp = courseProgress(s, p, nowMs);
  return cp.next ? (cp.next.at - cp.clean) / HOUR : null;
}
