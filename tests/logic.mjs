// Pure-logic checks for the rules, run in headless Chrome by tests/run_logic.py.
import { DAY, HOUR } from "/js/util.js?v=2";
import { avoided, cleanFor, courseProgress, cravingsBeaten, dailyCost, dayNumber, lastNicotine, milestones, saved } from "/js/quit.js?v=2";
import { course, planFor, withdrawal } from "/js/content.js?v=2";
import { DEFAULT_PROFILE, merge, mergeRec, QUIT_AT } from "/js/store.js?v=2";

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log("FAIL:", msg); } };
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

const P = DEFAULT_PROFILE;
const blank = () => ({ version: 1, profile: null, cravings: {}, slips: {}, milestones: {} });

// Tom's numbers: Lost Mary BM600, one 2 ml 20 mg/ml pod a day; a £6.50 2-pack lasts two days
ok(new Date(QUIT_AT).getHours() === 18 && new Date(QUIT_AT).getMinutes() === 56, "start line is 18:56");
ok(near(dailyCost(P), 3.25), `£3.25 a day, got ${dailyCost(P)}`);
const tenDays = QUIT_AT + 10 * DAY;
ok(near(saved(P, tenDays), 32.5), "10 days = £32.50 saved");
const a = avoided(P, tenDays);
ok(a.pods === 10 && a.mg === 400 && a.puffs === 6000, `10 days: 10 pods, 400 mg, 6k puffs (${JSON.stringify(a)})`);
ok(saved(P, QUIT_AT - HOUR) === 0 && avoided(P, QUIT_AT - HOUR).pods === 0, "nothing before the start");

// clock & slips
let s = blank();
ok(lastNicotine(s, P) === QUIT_AT && near(cleanFor(s, P, tenDays), 10 * DAY), "no slips: clock from the start");
s.slips.a = { at: QUIT_AT + 4 * DAY, date: "x", updatedAt: 1 };
s.slips.old = { at: QUIT_AT - DAY, date: "x", updatedAt: 1 };
s.slips.del = { at: QUIT_AT + 8 * DAY, date: "x", deleted: true, updatedAt: 2 };
ok(lastNicotine(s, P) === QUIT_AT + 4 * DAY, "slip restarts the clock; earlier and deleted slips ignored");
ok(near(saved(P, tenDays), 32.5), "a slip doesn't cost the money saved");

// course & milestones
const cp = courseProgress(blank(), P, tenDays);
ok(cp.last.title === "Physical symptoms easing" && cp.next.title === "Withdrawal mostly over", `course at day 10: ${cp.last?.title} → ${cp.next?.title}`);
ok(courseProgress(blank(), P, QUIT_AT + 5 * 60000).last === null, "first minutes: nothing passed yet");
const ms = milestones(blank(), P, tenDays);
ok(ms.filter((m) => m.done).length === 3 && near(ms.find((m) => m.title === "28 days").money, 91), "milestones: 3 done by day 10, 28 days = £91");
ok(milestones(s, P, tenDays).filter((m) => m.done).length === 2, "after a slip on day 4, only 24h and 72h done");
const wk = new Date(milestones(blank(), P, QUIT_AT).find((m) => m.title === "One week").when);
ok(wk.getDate() === 25 && wk.getHours() === 18 && wk.getMinutes() === 56, `one week lands Sun 25 Oct 18:56 despite the clocks change (${wk})`);
ok(course("smoke")[0].title === "Pulse settling" && course("both").length > course("smoke").length, "smoke/both courses");
ok(withdrawal(3) > withdrawal(1) && withdrawal(3) > withdrawal(10) && withdrawal(30) < 0.2, "withdrawal peaks at day 3");
ok(dayNumber(P, new Date(QUIT_AT).toISOString().slice(0, 10)) >= 1, "day number");

// cravings
s = blank();
s.cravings.a = { at: 1, outcome: "beat", updatedAt: 1 };
s.cravings.b = { at: 2, outcome: "beat", deleted: true, updatedAt: 1 };
ok(cravingsBeaten(s) === 1, "cravings beaten count");

// tips: every day has all four parts, placeholders filled, and nothing refers to removed features
for (let d = 1; d < 400; d++) {
  const e = planFor(d, "vape");
  const txt = JSON.stringify(e);
  if (!e.title || !e.about || !e.task || !e.builds) ok(false, `tip day ${d} incomplete`);
  if (/\{\w+\}/.test(txt)) ok(false, `tip day ${d} has an unfilled placeholder`);
  if (/check-in|journal|Splits|Medals|reward fund|log the|Log any/i.test(txt)) ok(false, `tip day ${d} mentions a removed feature: ${txt.slice(0, 120)}`);
}
ok(planFor(1, "vape").task.includes("BM600"), "day 1 names the BM600");

// merge: field-level
const A = { outcome: "beat", _f: { outcome: 10 }, updatedAt: 10 };
const B = { secs: 120, _f: { secs: 20 }, updatedAt: 20 };
const m = mergeRec(A, B);
ok(m.outcome === "beat" && m.secs === 120, "field-level merge keeps both");
const m2 = merge({ ...blank(), cravings: { x: A } }, { ...blank(), cravings: { x: B }, slips: { y: { at: 5, updatedAt: 1 } } });
ok(m2.cravings.x.secs === 120 && m2.slips.y, "state merge");
ok(mergeRec({ x: 1, updatedAt: 5 }, { deleted: true, updatedAt: 6 }).deleted, "tombstone wins when newer");

console.log(`logic: ${passes} passed, ${fails} failed`);
if (fails) throw new Error(`${fails} logic checks failed`);
