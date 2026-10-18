// Medals: earned once, kept for good. Each group shows what you've got and the next one up,
// and the trigger medals follow whatever your own log says is your hardest hill.
import { DAY, HOUR, live, money } from "./util.js?v=1";
import { bestCheckinStreak, bestRun, beatenFor, cravingsBeaten, fullDays, patterns, saved, started } from "./quit.js?v=1";
import { triggerLabel } from "./content.js?v=1";

const TIME = [
  [24 * HOUR, "24 hours", "The first full day"],
  [72 * HOUR, "72 hours", "Over the wall"],
  [7 * DAY, "One week", "Seven straight"],
  [14 * DAY, "Two weeks", "Fortnight finisher"],
  [28 * DAY, "28 days", "Five times more likely to stay quit"],
  [42 * DAY, "Six weeks", "Mood lifting"],
  [90 * DAY, "Three months", "New normal"],
  [182 * DAY, "Six months", "Half marathon of a year"],
  [365 * DAY, "One year", "The full marathon"],
];
const CRAVINGS = [1, 10, 25, 50, 100, 250, 500];
const MONEY = [10, 25, 50, 100, 250, 500, 1000, 2500];
const STREAK = [3, 7, 14, 30, 60, 100];
const FULL = [3, 7, 14, 28, 50];
const MOVES = [3, 10, 25, 50];

const tiers = (group, list, value, make) => list.map((t, i) => ({ group, id: `${group}-${Array.isArray(t) ? t[0] : t}`, ...make(t, i), value, target: Array.isArray(t) ? t[0] : t, done: value >= (Array.isArray(t) ? t[0] : t) }));

export function medals(s, p, nowMs = Date.now()) {
  const run = started(p, nowMs) ? bestRun(s, p, nowMs) : 0;
  const beat = cravingsBeaten(s);
  const cash = saved(s, p, nowMs);
  const streak = bestCheckinStreak(s);
  const full = fullDays(s, p);
  const moves = Object.values(s.tasks).filter((t) => live(t) && t.move).length;
  const groups = [
    { key: "time", name: "Distance", blurb: "Your longest clean run. Kept even if you slip.", items: tiers("time", TIME, run, ([, t, sub]) => ({ title: t, sub })) },
    { key: "craving", name: "Hills climbed", blurb: "Every craving you ride out is a rep.", items: tiers("craving", CRAVINGS, beat, (n) => ({ title: n === 1 ? "First hill" : `${n} hills`, sub: n === 1 ? "Rode out your first craving" : `${n} cravings beaten` })) },
    { key: "money", name: "Prize money", blurb: "What you haven't spent.", items: tiers("money", MONEY, cash, (n) => ({ title: money(n), sub: "saved" })) },
    { key: "streak", name: "Check-in streak", blurb: "Honest check-ins, day after day.", items: tiers("streak", STREAK, streak, (n) => ({ title: `${n} days`, sub: "checked in in a row" })) },
    { key: "full", name: "Full splits", blurb: "Days with every item on the list done.", items: tiers("full", FULL, full, (n) => ({ title: `${n} full days`, sub: "every box ticked" })) },
    { key: "move", name: "Engine", blurb: "Days you moved for 20+ minutes. Exercise is a proven craving-cutter.", items: tiers("move", MOVES, moves, (n) => ({ title: `${n} active days`, sub: "moved 20+ minutes" })) },
  ];
  // Trigger mastery: built from your own top triggers.
  const pat = patterns(s, nowMs, 3650);
  const tops = pat.triggers.slice(0, 2).map(([t]) => t).filter((t) => t !== "other");
  for (const t of tops) {
    const n = beatenFor(s, t);
    groups.push({ key: `trig-${t}`, name: `Beat “${triggerLabel(t)}”`, blurb: "One of your hardest hills, from your own log.", items: tiers(`trig-${t}`, [3, 10, 25], n, (k) => ({ title: `${k}×`, sub: `${triggerLabel(t).toLowerCase()} cravings beaten` })) });
  }
  for (const g of groups) {
    g.got = g.items.filter((i) => i.done);
    g.next = g.items.find((i) => !i.done) || null;
  }
  return groups;
}

export const achievedIds = (s, p, nowMs) => medals(s, p, nowMs).flatMap((g) => g.got.map((i) => i.id));
export function medalLabel(s, p, id) {
  for (const g of medals(s, p)) for (const i of g.items) if (i.id === id) return `${i.title} · ${g.name}`;
  return "Medal";
}

// Contextual "next up": the three nearest unearned medals, by how close they are.
export function nextUp(s, p, nowMs = Date.now()) {
  return medals(s, p, nowMs).filter((g) => g.next).map((g) => ({ g, m: g.next, frac: g.next.value / g.next.target }))
    .sort((a, b) => b.frac - a.frac).slice(0, 3);
}

// Rewards fill in order from savings that haven't already been spent on claimed rewards.
export function rewardProgress(s, p, nowMs = Date.now()) {
  const list = Object.entries(s.rewards).filter(([, r]) => live(r)).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const claimed = list.filter((r) => r.claimed).reduce((t, r) => t + Number(r.price || 0), 0);
  let pot = Math.max(0, saved(s, p, nowMs) - claimed);
  return list.map((r) => {
    if (r.claimed) return { ...r, have: Number(r.price), frac: 1 };
    const have = Math.min(pot, Number(r.price || 0));
    pot -= have;
    return { ...r, have, frac: r.price ? have / r.price : 0 };
  });
}
