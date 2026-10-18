// Pure-logic checks for the rules, run in headless Chrome by tests/run_logic.py.
import { addDays, DAY, HOUR, fmt, today } from "/js/util.js?v=1";
import { avoided, bestRun, checkinStreak, cleanFor, courseProgress, dailyCost, dayList, dayStatus, lastNicotine, nudgeCheck, patterns, saved, totals } from "/js/quit.js?v=1";
import { medals, rewardProgress } from "/js/goals.js?v=1";
import { course, planFor, withdrawal } from "/js/content.js?v=1";
import { merge, mergeRec } from "/js/store.js?v=1";

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL:", msg); } };
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

const NOW = Date.now();
const day = (n) => addDays(today(), n);
const at = (n, h = 12) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.getTime(); };
const P = { name: "Tom", product: "vape", quitAt: at(-10, 9), method: "cold", vape: { mgml: 20, mlWeek: 7, costWeek: 14 }, smoke: { perDay: 10, packPrice: 16 } };
const blank = () => ({ version: 1, profile: P, checkins: {}, cravings: {}, slips: {}, tasks: {}, plans: {}, reasons: {}, rewards: {}, milestones: {}, attempts: {} });

// money & nicotine
ok(near(dailyCost(P), 2), "vape daily cost = 14/7");
ok(near(dailyCost({ ...P, product: "smoke" }), 8), "smoke daily cost = 16/20*10");
ok(near(dailyCost({ ...P, product: "both" }), 10), "both = sum");
let s = blank();
const sv = saved(s, P, at(0, 9));
ok(near(sv, 20, 0.05), `10 days saved £20, got ${sv}`);
ok(avoided(s, P, at(0, 9)).mg === 200 && avoided(s, P, at(0, 9)).ml === 10, "10 days of 20mg/ml × 1 ml/day = 200 mg");
ok(saved(s, { ...P, quitAt: at(2) }, NOW) === 0, "no savings before the start");

// clock & slips
ok(lastNicotine(s, P) === P.quitAt, "no slips: last nicotine = quit");
s.slips.a = { at: at(-4, 21), date: day(-4), trigger: "alcohol", spent: 5, updatedAt: 1 };
s.slips.b = { at: at(-12, 21), date: day(-12), trigger: "alcohol", updatedAt: 1 }; // before quit: ignored
ok(lastNicotine(s, P) === at(-4, 21), "slip restarts the clock");
ok(near(saved(s, P, at(0, 9)), 15, 0.05), "slip spending comes off savings");
const best = bestRun(s, P, at(0, 9));
ok(near(best / DAY, (at(-4, 21) - P.quitAt) / DAY), "best run is the longer stretch before the slip");
s.slips.c = { at: at(-1, 9), date: day(-1), deleted: true, updatedAt: 2 };
ok(lastNicotine(s, P) === at(-4, 21), "deleted slips don't count");

// day statuses
s.checkins[day(-3)] = { clean: true, updatedAt: 1 };
s.checkins[day(-2)] = { clean: false, updatedAt: 1 };
ok(dayStatus(s, P, day(-11)) === "off", "before quit day = off");
ok(dayStatus(s, P, day(-4)) === "slip", "slip day = slip");
ok(dayStatus(s, P, day(-3)) === "clean", "checked in clean");
ok(dayStatus(s, P, day(-2)) === "slip", "checked in not clean = slip");
ok(dayStatus(s, P, day(-1)) === "assumed", "no check-in, no slip = assumed");
ok(dayStatus(s, P, day(0)) === "today", "today pending");
ok(dayStatus(s, P, day(1)) === "future", "future");
const t = totals(s, P);
ok(t.days === 11 && t.slip === 2 && t.clean === 1, `totals ${JSON.stringify(t)}`);

// streaks & list
s.checkins[day(-1)] = { clean: true, updatedAt: 1 };
s.checkins[day(0)] = { clean: true, note: "Good day", updatedAt: 1 };
ok(checkinStreak(s) === 4, `check-in streak 4, got ${checkinStreak(s)}`);
s.tasks[day(0)] = { plan: true, move: true, updatedAt: 1 };
ok(dayList(s, P, day(0)).full, "full day when all four done");

// course
const cp = courseProgress(blank(), P, at(0, 9));
ok(cp.list.find((m) => m.title.startsWith("Nicotine cleared")).reached, "72h passed after 10 days");
ok(cp.next && cp.next.title === "Withdrawal mostly over", `next marker after 10 days: ${cp.next?.title}`);
ok(course("smoke")[0].title === "Pulse settling" && course("both").length > course("smoke").length, "smoke/both courses");
ok(withdrawal(3) > withdrawal(1) && withdrawal(3) > withdrawal(10) && withdrawal(30) < 0.2, "withdrawal peaks at day 3");

// patterns & nudges
s = blank();
for (let i = 0; i < 5; i++) s.cravings[`c${i}`] = { at: at(-i, 21), date: day(-i), trigger: "coffee", outcome: "beat", intensity: 3, updatedAt: 1 };
s.cravings.x = { at: at(-1, 22), date: day(-1), trigger: "alcohol", outcome: "slip", updatedAt: 1 };
const pat = patterns(s, NOW);
ok(pat.top === "coffee" && pat.beat === 5 && pat.peak === 21, `patterns ${JSON.stringify({ top: pat.top, beat: pat.beat, peak: pat.peak })}`);
ok(nudgeCheck(blank(), P, at(0, 10))?.kind === "confirm", "missing yesterday check-in → confirm");
s = blank(); s.slips.a = { at: at(-1, 20), date: day(-1), updatedAt: 1 };
ok(nudgeCheck(s, P, at(0, 10))?.kind === "slipped", "recent slip → slipped note");
for (let i = 2; i <= 3; i++) s.slips[`w${i}`] = { at: at(-i, 20), date: day(-i), updatedAt: 1 };
ok(nudgeCheck(s, P, at(0, 10))?.kind === "wobble", "3 slips in a week → wobble");
s = blank(); for (let i = 1; i <= 10; i++) s.checkins[day(-i)] = { clean: true, cravings: 1, updatedAt: 1 };
ok(nudgeCheck(s, P, at(0, 10)) === null, "all good → no note");
ok(nudgeCheck(blank(), { ...P, quitAt: at(3) }, NOW) === null, "no notes before the start");

// plan
ok(planFor(1, "vape").title === "Start line" && planFor(3, "vape").title === "The wall", "plan days");
ok(planFor(0, "vape").title === "Race eve" && planFor(-6, "vape").title === "Pick your start line", "prep days");
ok(planFor(40, "smoke").task && !/\{\w+\}/.test(JSON.stringify(planFor(12, "smoke"))), "placeholders filled");
ok(planFor(200, "vape").title === "Long run", "maintenance after 12 weeks");
for (let d = -8; d < 120; d++) { const e = planFor(d, "both"); if (!e.title || !e.about || !e.task || !e.builds) ok(false, `plan day ${d} incomplete`); }

// medals & rewards
s = blank();
for (let i = 0; i < 12; i++) s.cravings[`c${i}`] = { at: at(-i % 9, 15), date: day(-i % 9), trigger: "coffee", outcome: "beat", updatedAt: 1 };
const g = medals(s, P, at(0, 9));
ok(g.find((x) => x.key === "time").got.length === 3, "10 days: 24h, 72h, 1 week");
ok(g.find((x) => x.key === "craving").got.length === 2, "12 beaten: first + 10");
ok(g.some((x) => x.key === "trig-coffee"), "trigger medal from own log");
s.rewards.a = { name: "Shoes", price: 15, createdAt: 1, updatedAt: 1 };
s.rewards.b = { name: "Lens", price: 100, createdAt: 2, updatedAt: 1 };
const rp = rewardProgress(s, P, at(0, 9));
ok(rp[0].frac === 1 && near(rp[1].have, 5, 0.05), `rewards fill in order ${JSON.stringify(rp.map((r) => r.have))}`);

// merge: field-level
const A = { clean: true, _f: { clean: 10 }, updatedAt: 10 };
const B = { note: "hi", _f: { note: 20 }, updatedAt: 20 };
const m = mergeRec(A, B);
ok(m.clean === true && m.note === "hi", "field-level merge keeps both");
const m2 = merge({ ...blank(), checkins: { [day(0)]: A } }, { ...blank(), checkins: { [day(0)]: B } });
ok(m2.checkins[day(0)].clean && m2.checkins[day(0)].note === "hi", "state merge");
ok(mergeRec({ x: 1, updatedAt: 5 }, { deleted: true, updatedAt: 6 }).deleted, "tombstone wins when newer");

console.log(`logic: ${passes} passed, ${fails} failed`);
if (fails) throw new Error(`${fails} logic checks failed`);
