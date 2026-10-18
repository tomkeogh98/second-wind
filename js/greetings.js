// The start-line greeting: a different one each visit, chosen from lines that fit the moment.
// h = headline (short, loud), s = the line underneath. {tokens} are filled from the context.
const LINES = [
  // any time, once you've started
  { h: "Keep running, {name}.", s: "Every minute on this clock is one you didn't hand over to nicotine.", when: (c) => c.started },
  { h: "Breathe in. Properly.", s: "That's the whole point of all this. Enjoy it.", when: (c) => c.started },
  { h: "Your race. Your pace.", s: "Nobody's counting puffs but you, and you're at zero.", when: (c) => c.started },
  { h: "Still in it.", s: "Cravings are hills. You've been climbing them all along.", when: (c) => c.started },
  { h: "Good to see you, {name}.", s: "Check in, tick the list, keep the clock running.", when: (c) => c.started },
  { h: "Lungs: reporting for duty.", s: "They've been waiting for this. Give them the day off from the {cloud}.", when: (c) => c.started },
  { h: "No leash today.", s: "No battery to watch, no pod to buy. Just you.", when: (c) => c.started },
  { h: "Steady pace.", s: "Quitting isn't a sprint. It's one ordinary day after another.", when: (c) => c.started },
  { h: "You don't {thing}.", s: "Say it like it's true, because it is.", when: (c) => c.started && c.day >= 5 },
  // time of day
  { h: "Morning, {name}.", s: "First hours are the easiest to protect. Water, shower, out the door.", when: (c) => c.started && c.hour >= 5 && c.hour < 11 },
  { h: "Afternoon check.", s: "The 3pm slump is a classic craving window. Have a plan ready.", when: (c) => c.started && c.hour >= 13 && c.hour < 17 },
  { h: "Evening, {name}.", s: "Evenings are the hilly part of the course. You've got the kit.", when: (c) => c.started && c.hour >= 17 && c.hour < 22 },
  { h: "Late one.", s: "Tired brains crave more. Check in, read a bit, lights out.", when: (c) => c.started && (c.hour >= 22 || c.hour < 5) },
  // the first days
  { h: "Day one. Gun's gone.", s: "Win the next few minutes. Then the next. That's all today is.", when: (c) => c.day === 1, weight: 40 },
  { h: "Day two, {name}.", s: "Nicotine's falling fast. Grumpy is normal. Grumpy is progress.", when: (c) => c.day === 2, weight: 30 },
  { h: "The wall.", s: "Day three is when withdrawal usually peaks. Over this and it's downhill.", when: (c) => c.day === 3, weight: 40 },
  { h: "Over the wall.", s: "Day four. The steepest climb is behind you.", when: (c) => c.day === 4, weight: 30 },
  { h: "One week down.", s: "Seven days. The hardest physical part is behind you.", when: (c) => c.day === 8, weight: 30 },
  { h: "Day 28.", s: "Make today and you're five times more likely to stay quit for good.", when: (c) => c.day === 28, weight: 50 },
  // pre-start
  { h: "{toGo} to the start line.", s: "Use the time well: reasons, triggers, kit, crew.", when: (c) => !c.started && c.toGo },
  { h: "Warm-up lap.", s: "The prep is the part most people skip. Don't.", when: (c) => !c.started },
  { h: "Race eve.", s: "Tomorrow you start. Clear out the kit tonight.", when: (c) => !c.started && c.daysToGo === 1, weight: 30 },
  // progress
  { h: "{clean} clean.", s: "Look at that number. You did that.", when: (c) => c.started && c.cleanH >= 6 },
  { h: "{saved} back in your pocket.", s: "That's money that was going up in {cloud}.", when: (c) => c.started && c.savedN >= 5 },
  { h: "{beat} hills climbed.", s: "Every craving you've ridden out made the next one weaker.", when: (c) => c.beat >= 3 },
  { h: "Next marker: {next}.", s: "{nextIn} to go. Keep the legs turning.", when: (c) => c.started && c.next && c.hoursToNext != null && c.hoursToNext < 48 },
  { h: "Into the long run.", s: "Past the first month. Now it's about not getting complacent.", when: (c) => c.day > 30 },
  { h: "{day} days in.", s: "This isn't a phase any more. This is just you.", when: (c) => c.day >= 14 },
  // days of the week
  { h: "Run club tonight.", s: "18:45, Oxford. Notice your breathing on the hills.", when: (c) => c.started && c.weekday === 3 },
  { h: "Wednesday miles.", s: "Every run without nicotine in your blood is a better run.", when: (c) => c.started && c.weekday === 3 },
  { h: "Friday, {name}.", s: "Weekend's coming. Plan the night out before it plans you.", when: (c) => c.started && c.weekday === 5 },
  { h: "Weekend pace.", s: "Different routine, different triggers. Stay sharp.", when: (c) => c.started && (c.weekday === 6 || c.weekday === 0) },
  { h: "Monday reset.", s: "New week on the course. Same rule: not a puff.", when: (c) => c.started && c.weekday === 1 },
  // after a slip: warm, never guilt
  { h: "Back on your feet.", s: "A slip isn't a finish line. Learn the trigger, keep running.", when: (c) => c.slipRecent, weight: 20 },
  { h: "Stumbles happen.", s: "Most people who quit for good had a wobble along the way. Lace up.", when: (c) => c.slipRecent, weight: 20 },
];

const RECENT_KEY = "sw.greet.recent";

export function pickGreeting(ctx) {
  const fill = (str) => str.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ""));
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { /* ignore */ }
  const eligible = LINES.map((l, i) => ({ ...l, i })).filter((l) => !l.when || l.when(ctx));
  if (!eligible.length) return { h: `Hey ${ctx.name}.`, s: "Let's get you to the start line." };
  const special = eligible.filter((l) => l.weight && !recent.slice(0, 2).includes(l.i));
  let pool = special.length ? special : eligible.filter((l) => !recent.includes(l.i));
  if (!pool.length) pool = eligible;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([pick.i, ...recent].slice(0, 14))); } catch { /* ignore */ }
  return { h: fill(pick.h), s: fill(pick.s) };
}
