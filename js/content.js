// Everything Second Wind says that isn't about your own data: the health course, the withdrawal
// curve, the day-by-day plan and the aid-station toolkit.
// {thing} {things} {kit} {habit} are filled per product (vape / smoke / both), see fill().
import { HOUR, DAY, MIN } from "./util.js?v=3";

const WORDS = {
  vape: { thing: "vape", things: "vapes", kit: "the BM600, every spare pod and the charging cable", habit: "vaping", puff: "puff" },
  smoke: { thing: "smoke", things: "cigarettes", kit: "cigarettes, lighters, papers and ashtrays", habit: "smoking", puff: "drag" },
  both: { thing: "vape or smoke", things: "vapes and cigarettes", kit: "vapes, pods, chargers, cigarettes and lighters", habit: "nicotine", puff: "puff" },
};
export const words = (product) => WORDS[product] || WORDS.vape;
export const fill = (text, product) => String(text).replace(/\{(\w+)\}/g, (m, k) => words(product)[k] ?? m);

// ---------- the course: what recovers, and when ----------
// Smoking markers follow the NHS quit-smoking timeline (NHS Better Health / NHS 111 Wales).
// Vaping has no smoke and no carbon monoxide, so its markers are about nicotine leaving your body
// and withdrawal settling; long-term vaping recovery research is still young, and the copy says so.
const NHS = "NHS";
const COURSE_SMOKE = [
  { at: 20 * MIN, km: "0.2", title: "Pulse settling", body: "Your pulse rate is already starting to return to normal.", src: NHS },
  { at: 8 * HOUR, km: "1", title: "Oxygen back up", body: "Carbon monoxide in your blood has roughly halved and oxygen levels are recovering.", src: NHS },
  { at: 48 * HOUR, km: "3", title: "Carbon monoxide gone", body: "The carbon monoxide has been flushed out. Your lungs start clearing mucus, and taste and smell begin to sharpen.", src: NHS },
  { at: 72 * HOUR, km: "5", title: "Breathing easier", body: "Bronchial tubes start to relax, so breathing feels easier and energy picks up. Nicotine is largely out of your system, which is why withdrawal usually peaks around now.", src: NHS },
  { at: 14 * DAY, km: "10", title: "Circulation improving", body: "From two to twelve weeks, circulation improves. Walking and running get easier: you'll feel it at run club.", src: NHS },
  { at: 6 * 7 * DAY, km: "15", title: "Mood lifting", body: "Mental-health benefits can be felt in as little as six weeks. People who quit end up less anxious, stressed and low than when they smoked.", src: NHS },
  { at: 90 * DAY, km: "21.1", title: "Lungs working better", body: "Between three and nine months, coughs, wheezing and breathing problems improve as your lung function increases.", src: NHS },
  { at: 365 * DAY, km: "42.2", title: "Heart attack risk halved", body: "After a year, your risk of a heart attack is about half that of someone who still smokes.", src: NHS },
  { at: 10 * 365 * DAY, km: "Ultra", title: "Lung cancer risk halved", body: "After ten years, your risk of dying from lung cancer falls to about half that of a smoker.", src: NHS },
  { at: 15 * 365 * DAY, km: "Ultra+", title: "Heart like a non-smoker's", body: "After fifteen years, your risk of a heart attack is the same as someone who has never smoked.", src: NHS },
];
const COURSE_VAPE = [
  { at: 20 * MIN, km: "0.2", title: "Heart rate settling", body: "Nicotine is a stimulant. Without a top-up, your heart rate and blood pressure start drifting back down.", src: "Nicotine pharmacology" },
  { at: 4 * HOUR, km: "1", title: "First cravings", body: "Nicotine's half-life is about two hours, so levels are falling fast. Withdrawal usually starts between 4 and 24 hours after the last puff. This is the body asking, not the body needing.", src: "Australian Dept of Health · NSW Health" },
  { at: 72 * HOUR, km: "5", title: "Nicotine cleared · the wall", body: "Nicotine is largely out of your system. Withdrawal usually peaks around day three, so this is the hardest stretch of the course. It's downhill from here.", src: "Australian Dept of Health" },
  { at: 7 * DAY, km: "8", title: "Physical symptoms easing", body: "For most people, the physical withdrawal (restlessness, irritability, poor sleep) gets better during the first one to two weeks.", src: "NSW Health" },
  { at: 28 * DAY, km: "15", title: "Withdrawal mostly over", body: "After three to four weeks, most withdrawal symptoms have faded. Cravings are now mostly cue-triggered habits: coffee, a break, a drink. Many people notice less throat irritation, though research on recovering from vaping is still young.", src: "Australian Dept of Health" },
  { at: 6 * 7 * DAY, km: "21.1", title: "Mood lifting", body: "In people who quit nicotine by stopping smoking, anxiety and stress end up lower than before, with benefits from about six weeks. Nicotine's relief-then-withdrawal cycle is the common thread, so expect the same arc.", src: "NHS · Cochrane review (smoking)" },
  { at: 90 * DAY, km: "30", title: "The habit loosens", body: "By three months, cravings are rare, short and easy to name. The routines you built in month one are now just how you live.", src: "Habit research" },
  { at: 365 * DAY, km: "42.2", title: "A nicotine-free year", body: "Twelve months without nicotine. Your heart, your sleep and your wallet have had a full year off.", src: "" },
];
export function course(product) {
  if (product === "smoke") return COURSE_SMOKE;
  if (product === "both") {
    // Smoking markers, plus the nicotine-specific ones that the smoking timeline doesn't spell out.
    const extra = COURSE_VAPE.filter((m) => ["First cravings", "Physical symptoms easing", "Withdrawal mostly over"].includes(m.title));
    return [...COURSE_SMOKE, ...extra].sort((a, b) => a.at - b.at);
  }
  return COURSE_VAPE;
}

// ---------- the elevation profile: typical withdrawal intensity by day (0..1) ----------
// A stylised shape, not anyone's data: starts within hours, peaks around day 3,
// eases over two to four weeks, with the odd bump (cue cravings) after that.
export function withdrawal(day) {
  if (day <= 0) return 0;
  if (day <= 3) return 0.25 + 0.75 * Math.sin((day / 3) * (Math.PI / 2));
  const base = 0.08 + 0.92 * Math.exp(-(day - 3) / 8);
  const bump = day > 6 ? 0.05 * Math.exp(-((day - 7) ** 2) / 2) + 0.04 * Math.exp(-((day - 14) ** 2) / 3) : 0;
  return Math.min(1, base + bump);
}

// ---------- triggers ----------
export const TRIGGERS = [
  { id: "coffee", label: "Coffee", plan: "Change the ritual: different mug, different spot, and a glass of water first." },
  { id: "food", label: "After food", plan: "Get up from the table straight away. Brush your teeth or chew mint gum." },
  { id: "alcohol", label: "Drinking", plan: "Tell whoever you're with that you've quit. Hold your drink in your {thing} hand. Alternate with water." },
  { id: "stress", label: "Stress", plan: "Do the 2-minute breathing drill. Nicotine only relieves the withdrawal it causes." },
  { id: "bored", label: "Boredom", plan: "Hands busy: guitar, a walk round the block, ten push-ups." },
  { id: "break", label: "Work break", plan: "Take the break somewhere new. Walk to the end of the street and back." },
  { id: "social", label: "Others using", plan: "Step away, say 'I've quit' out loud, and go and stand with the non-users." },
  { id: "editing", label: "Editing / filming", plan: "Set a 25-minute timer and stand up and stretch when it ends, instead of reaching for a {thing}." },
  { id: "phone", label: "Scrolling", plan: "Phone down, glass of water, back in five." },
  { id: "waking", label: "Waking up", plan: "Get up, open a window, cold water on your face, then shower." },
  { id: "driving", label: "Driving / travel", plan: "Keep gum or mints in the car. Put on a podcast that needs your attention." },
  { id: "other", label: "Something else", plan: "Name it, then use the four Ds: delay, deep breaths, drink water, do something." },
];
export const triggerLabel = (id) => TRIGGERS.find((t) => t.id === id)?.label || "Something else";

// ---------- the aid station: in-the-moment tools ----------
export const FOUR_DS = [
  { k: "Delay", t: "Most cravings peak and pass within a few minutes. Start the timer and wait it out." },
  { k: "Deep breaths", t: "Slowly in through the nose, longer out through the mouth. The long exhale is what calms you." },
  { k: "Drink water", t: "Sip a full glass slowly. It gives your hands and mouth a job." },
  { k: "Do something", t: "Change rooms, walk, do push-ups, pick up the guitar. Moving is one of the fastest craving killers." },
];
export const DISTRACTIONS = [
  "Ten slow push-ups. Count them out loud.",
  "Walk to the end of the street and back.",
  "Drink a full glass of cold water, slowly.",
  "Text someone: 'Craving. Talk me down?'",
  "Play one song on the guitar, start to finish.",
  "Brush your teeth. Nothing tastes worse after toothpaste.",
  "Write down what triggered this, in five words.",
  "Read two pages of your book.",
  "Step outside and take ten breaths of actual fresh air.",
  "Chew gum, or crunch an apple or a carrot.",
  "Wash your face with cold water.",
  "Tidy one surface: desk, sink, bag.",
];
export const BELIEFS = [
  { myth: "\"It helps with my stress.\"", truth: "Nicotine relieves withdrawal, which nicotine causes. Studies of people who quit smoking show their stress and anxiety end up lower than when they used nicotine." },
  { myth: "\"Just one won't hurt.\"", truth: "One puff restarts the craving cycle. Stop-smoking services use a 'not a puff' rule for a reason." },
  { myth: "\"I'll put on weight.\"", truth: "Nicotine blunts appetite, so some gain is common, but it's manageable with protein, fibre and training. The Cut has your meals covered." },
  { myth: "\"I've slipped, so I've failed.\"", truth: "A slip is a stumble, not a finish line. Restart the clock, learn the trigger, keep running." },
  { myth: "\"Vaping isn't really addictive.\"", truth: "Pod liquids carry a lot of nicotine (up to 20 mg/ml in the UK). The pull you feel is real, and so is the way out." },
];

export const SUPPORT = [
  { t: "Stop for Life Oxon", d: "Oxfordshire's free stop-smoking service: coaching and stop-smoking aids for people who live or work in the county.", url: "https://www.stopforlifeoxon.org/" },
  { t: "NHS Quit Smoking (Better Health)", d: "Free NHS tools and the personal quit plan. Most of the advice works the same for vaping.", url: "https://www.nhs.uk/better-health/quit-smoking/" },
  { t: "Find your local stop-smoking service", d: "Free expert support. People who quit with support and stop-smoking aids are much more likely to succeed.", url: "https://www.nhs.uk/better-health/quit-smoking/find-your-local-stop-smoking-service/" },
  { t: "Talk to a pharmacist", d: "Nicotine patches plus a fast-acting form (gum, lozenge, mouth spray) take the edge off withdrawal. Ask what suits you. Combining the two works better than either alone.", url: "" },
];
export const SOURCES = [
  { t: "NHS: Benefits of quitting smoking", url: "https://www.nhs.uk/better-health/quit-smoking/why-quit-smoking/benefits-of-quitting-smoking/" },
  { t: "NHS 111 Wales: Quit smoking timeline", url: "https://111.wales.nhs.uk/LiveWell/QuitSmokingTimeline" },
  { t: "Australian Government Department of Health: What quitting feels like", url: "https://www.health.gov.au/topics/smoking-vaping-and-tobacco/how-to-quit/what-it-feels-like" },
  { t: "NSW Health: Vaping quit support", url: "https://www.health.nsw.gov.au/tobacco/Pages/vaping-quit-support-young-people-factsheet.aspx" },
  { t: "Cochrane (Lindson et al., 2019): reducing first vs quitting abruptly. Similar success either way", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6861854/" },
  { t: "Cochrane (Taylor et al., 2021): mental health improves after quitting smoking", url: "https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD013522.pub2/full" },
];

export const REASON_IDEAS = [
  "Breathe easy on the long runs at Oxford Run Club",
  "A clear voice on camera: no dry throat, no clearing it every take",
  "Stop being on a leash to a little device",
  "Sleep properly and wake up without reaching for anything",
  "Spend the money on something I'll actually remember",
  "Stop feeling anxious when the battery's low",
  "Be the person who just doesn't need it",
];

// ---------- the training plan: one focus a day ----------
// prep: days before quit day (keyed by days to go). days: day 1 = quit day.
// Each entry: title · about (what's going on) · task (one concrete thing to do) · builds (how it follows on).
export const PREP = {
  7: { title: "Pick your start line", about: "A set quit day works better than 'soon'. Pick one in the next week or two, ideally a low-stress day. A Monday works if your weekends are social.", task: "Lock in your quit day and time in Settings, and tell one person.", builds: "This is the starting gun. Everything after it hangs off the date." },
  6: { title: "Know your why", about: "When a craving hits, you won't argue with it using facts. You'll use reasons. Write the ones that actually move you.", task: "Add three reasons to your list in the Aid station.", builds: "The date tells you when; your reasons tell you why. You'll see them during every craving." },
  5: { title: "Map your triggers", about: "Most use is automatic: coffee, breaks, drinks, editing sessions. Notice each time you reach for it today.", task: "Note your top three triggers and write an if-then plan for each.", builds: "Your reasons give the why; the trigger map shows where the hills are." },
  4: { title: "Stock the aid station", about: "Gum, mints, a water bottle, something for your hands. If you want nicotine replacement, get it now, not at 11pm on day two.", task: "Buy what you need: gum, water bottle, and NRT if you're using it.", builds: "You've mapped the hills; now you're packing the kit for them." },
  3: { title: "Tell your crew", about: "People who tell others are more accountable and get more support. Pick the two people you'd text mid-craving.", task: "Tell two people your quit date and ask them to check in on day 3.", builds: "Kit's packed; now the crew knows when you're starting." },
  2: { title: "Step down", about: "Cutting down first and quitting abruptly work about equally well (Cochrane). If you're stepping down, use less today or drop to a lower strength. Either way, stop buying refills.", task: "Use less than usual today, and don't buy any more.", builds: "Crew's briefed; now you're easing off the pace before the start." },
  1: { title: "Race eve", about: "Tomorrow's the start. Clear out everything tonight so there's nothing to reach for in the morning.", task: "Bin or hand over every bit of {kit}, except tonight's last one.", builds: "All the prep comes together: date, reasons, triggers, kit, crew." },
};

export const DAYS = {
  1: { title: "Start line", about: "Your first cravings arrive within hours. Each one peaks and fades in a few minutes, so you only ever have to win the next few minutes.", task: "Bin every bit of {kit} left, and ride out your first craving with the SOS timer.", builds: "Prep's done. Today you stop, and every craving you ride out is a hill climbed." },
  2: { title: "First full day", about: "Nicotine levels are falling fast. Expect cravings, irritability and a short fuse. That's withdrawal doing its thing, and it's temporary.", task: "Hit SOS for every craving today, and notice what set each one off.", builds: "Yesterday you started; today you learn what your cravings feel like and where they come from." },
  3: { title: "The wall", about: "Withdrawal usually peaks around day three, when nicotine's almost gone from your body. This is the hardest stretch of the whole course. It gets easier after today.", task: "Keep today easy: move your body, eat properly, early night.", builds: "You've logged two days of cravings; today you use that knowledge to get over the steepest climb." },
  4: { title: "Over the top", about: "You're over the peak for most people. Exercise is one of the most reliable ways to cut a craving short. Even ten minutes helps.", task: "When the next craving hits, walk or run for ten minutes instead.", builds: "You got through the wall. Now you add your best tool: movement." },
  5: { title: "Hands and mouth", about: "Half the habit is the ritual: hand to mouth, the breath in, the little pause. Give each part a replacement.", task: "Pick a replacement for the ritual (gum, a straw water bottle, a pen) and use it all day.", builds: "Moving handles the craving; this handles the ritual underneath it." },
  6: { title: "First social test", about: "Alcohol and other people using are the biggest relapse triggers. Plan before you go, not when you're there.", task: "Plan your next social: who you'll tell, what you'll drink, when you'll leave.", builds: "You've covered the ritual; now you take it out into the real world." },
  7: { title: "One week", about: "A full week. The worst of the physical withdrawal is behind most people now. Mark it: that's about £23 you didn't spend on pods.", task: "Treat yourself to something small with this week's pod money.", builds: "Seven days in. Everything you've learned so far is now part of a routine." },
  8: { title: "Not a puff", about: "The rule stop-smoking services use is simple: not a single puff. One isn't 'just one'. It restarts the craving cycle.", task: "Have your answer to 'just one won't hurt' ready before you need it.", builds: "Week one was about getting through. Week two is about not giving it a way back in." },
  9: { title: "Appetite", about: "Nicotine blunts appetite, so you might be hungrier. That's normal. Lean on protein and volume rather than sugar.", task: "Keep a protein snack on you (yoghurt, jerky, a shake) for hungry cravings.", builds: "You've closed the door on 'just one'; now you handle hunger, the craving's disguise." },
  10: { title: "Stress isn't the reason", about: "Nicotine only relieves the withdrawal that nicotine causes. Without it, your baseline stress actually comes down over the coming weeks.", task: "Do the 2-minute breathing drill once today, without waiting for a craving.", builds: "Food is handled; now you rewire the 'I need it for stress' belief." },
  11: { title: "Urge surfing", about: "Instead of fighting a craving, watch it: where you feel it, how strong it is, how it rises, peaks and falls. Cravings are waves, and waves end.", task: "Surf one craving today: rate it at the start, the peak and the end.", builds: "Breathing calms you; surfing teaches you that cravings don't win if you wait." },
  12: { title: "New identity", about: "\"I'm trying to quit\" keeps the door open. \"I don't {thing}\" closes it. Small words, big difference.", task: "Next time it comes up, say 'I don't {thing}', not 'I'm trying to quit'.", builds: "You've learned to ride the waves; now you change the story you tell about yourself." },
  13: { title: "Know your hills", about: "Two weeks in, you know when the cravings come: the coffee, the edit session, the pint. Your plan should match your real hills, not generic ones.", task: "Name your top two trigger moments and pick the plan for each from the Toolkit.", builds: "New identity, real knowledge: tune the plan to your actual pattern." },
  14: { title: "Two weeks", about: "Physical withdrawal is easing for most people by now. Circulation is improving, so notice how your breathing feels on a run.", task: "Go for a run or a brisk walk and note how your breathing feels.", builds: "Your plan now fits your real pattern. Time to notice what's already coming back." },
  15: { title: "Sneaky cravings", about: "Week three cravings are less physical and more 'this is when I usually…'. They're shorter, and they surprise you.", task: "Name one 'usually' moment and change something about it.", builds: "The physical part's easing; now you go after the habits." },
  16: { title: "Clear the scent trail", about: "Smells and places cue cravings: a jacket pocket, the car, the drawer where the charger lived.", task: "Clear one cue spot: the car, a bag, a drawer, a jacket.", builds: "You've changed a 'usually' moment; now you remove the cues around you." },
  17: { title: "Say it on camera", about: "You're a creator: saying it out loud makes it real. You don't have to post it.", task: "Record 60 seconds on how week three feels. Keep it or post it.", builds: "Your space is cleaner; now you lock in the identity by saying it out loud." },
  18: { title: "Price the reward", about: "Saved money is more motivating when it has a target. A month without pods is about £90.", task: "Pick something worth around £90 and promise it to yourself on day 28.", builds: "You've said it out loud; now give your savings a finish line." },
  19: { title: "Danger thoughts", about: "\"I've done so well, I deserve one\". \"I'll just have one at the party\". These thoughts get louder when things are going well.", task: "Name your top danger thought, and decide your reply to it now.", builds: "Your reward's set; now you guard against the thoughts that put it at risk." },
  20: { title: "Pay it forward", about: "Telling someone else what's working makes it stick for you too.", task: "Tell someone what's working for you, or help someone who's quitting.", builds: "You've answered the danger thoughts; now you teach what you've learned." },
  21: { title: "Three weeks", about: "Twenty-one days. Withdrawal is mostly behind you; what's left is habit, and habits fade when they're not fed.", task: "Think back to day one. Notice how much quieter the cravings are now.", builds: "Three weeks of building: tools, plan, identity. Time to look back at the climb." },
  22: { title: "Sleep check", about: "Sleep can wobble in the first weeks and then improve. A wind-down routine helps: screens off, 30 minutes of reading.", task: "Read 30 minutes before bed, with your phone in another room.", builds: "You've looked back; now you protect the recovery that happens overnight." },
  23: { title: "Swap the ritual for good", about: "The replacement habits you picked on day five: are they still working, or just new crutches?", task: "Keep the replacements that help, and drop the ones that don't.", builds: "Sleep's protected; now you tidy up the routines you built on day five." },
  24: { title: "High-risk calendar", about: "Look at the week ahead for nights out, deadlines and travel. Those are the hills on the course.", task: "Mark this week's high-risk day and write its plan now.", builds: "Your routines are tidy; now you look ahead at the course." },
  25: { title: "Strength in numbers", about: "Look at your cravings-beaten count on the home page: every one is a rep you've done.", task: "Beat the next craving without the timer. You know how now.", builds: "The week's planned; now you trust the skills you've practised." },
  26: { title: "Breathe for pace", about: "Your circulation and breathing are on their way back. Use them.", task: "Run (or walk) your usual loop and note your time and how your chest feels.", builds: "Cravings are a skill now; time to enjoy what you're getting back." },
  27: { title: "Eve of 28", about: "Tomorrow's day 28, the line that matters. If you make 28 days, you're five times more likely to stay quit for good.", task: "Plan a small celebration for tomorrow.", builds: "You've felt your body come back; tomorrow you hit the milestone that predicts lasting success." },
  28: { title: "Day 28", about: "Twenty-eight days. You're five times more likely to stay quit than on day one. This is a proper finish line. Enjoy it, then keep running.", task: "Celebrate it: tell your crew and buy the thing you promised yourself.", builds: "Every day so far built to this one." },
};

export const WEEKS = {
  5: { title: "Complacency", about: "Cravings are rare, so your guard drops. Most relapses after a month start with 'just one', at a party or a stressful moment.", tasks: ["Remind yourself of your reply to danger thoughts.", "Re-read the plan for drinking in the Toolkit.", "Tell someone you're a month in.", "Delete the vape shop from your maps and favourites.", "Plan the weekend's high-risk moment.", "Do the breathing drill once, for practice.", "Hit SOS for any craving, however small."] },
  6: { title: "Six weeks: mood", about: "Mental-health benefits can be felt in as little as six weeks: lower anxiety and stress than when you used nicotine.", tasks: ["Notice your mood today. Is it steadier than in week one?", "Notice one moment today when you'd normally have reached for it.", "Name one thing that's easier now than on day one.", "Thirty minutes of reading, no phone.", "Move for 20 minutes outside.", "Message your crew with an update.", "Remember how week one felt, and how far you've come."] },
  7: { title: "New defaults", about: "The rituals you built are becoming defaults. Strengthen the ones you like.", tasks: ["Do your coffee ritual the new way.", "Take a break somewhere new.", "Practise guitar instead of a scroll break.", "Swap one evening screen hour for a walk.", "Cook something properly.", "Go to bed 30 minutes earlier.", "Plan next week's run."] },
  8: { title: "Social confidence", about: "Nights out without it are a skill. Each one makes the next easier.", tasks: ["Say 'I don't {thing}' once today.", "Plan the drink you'll order on your next night out.", "Have a conversation without stepping outside.", "Stand with non-users at the next social.", "Leave early if it gets hard. That's allowed.", "Log how the night went.", "Thank someone who's supported you."] },
  9: { title: "Spend it", about: "The money's real. Spending some of it on something you'll remember makes the payoff concrete.", tasks: ["Check how much you've saved on the home page.", "Spend some of it on something you'll remember.", "Pick a bigger reward for month three (about £300).", "Work out a year's savings at this pace.", "Spend £5 on something just for you.", "Put the vape money into running kit or your camera fund.", "Tell someone what you bought with it."] },
  10: { title: "Stress plan", about: "Big stresses still trigger the old reflex. Have a stress plan ready, not just a craving plan.", tasks: ["Write your stress plan: three things that work.", "Use the breathing drill under pressure.", "Take a proper lunch break.", "Run off a bad day.", "Talk to someone instead of stewing.", "Spot one stress trigger and remove it.", "Sleep eight hours."] },
  11: { title: "Engine room", about: "Running and training feel different now. Use them as proof.", tasks: ["Time your regular route.", "Push the pace for one kilometre.", "Run club: notice your breathing on the hills.", "Do a session in The Cut and note how you recover.", "Stretch for ten minutes.", "Take the stairs all day.", "Notice your energy levels compared with month one."] },
  12: { title: "Three months", about: "Twelve weeks. Cravings are short and rare, and you know exactly what to do with them. This is your new normal.", tasks: ["Look at the course: count the markers you've passed.", "Write a letter to day-one you.", "Buy the month-three reward.", "Tell your crew: three months.", "Set a six-month marker.", "Help someone start.", "Keep going: the clock is the story."] },
};

export const MAINTAIN = {
  title: "Long run",
  about: "You're past the hard part. Keep the easy habits that protect it: use SOS for the odd craving, and stay honest about danger thoughts.",
  tasks: ["Notice one moment you'd once have reached for it.", "Notice one thing you can do now that you couldn't before.", "Move outside for 20 minutes.", "Re-read your reasons.", "Plan this week's high-risk moment.", "Treat yourself with this month's pod money.", "Tell someone how long it's been."],
};

// The plan entry for a given day number (1 = quit day; <=0 = prep).
export function planFor(day, product) {
  let e;
  if (day <= 0) e = PREP[Math.min(7, 1 - day)] || PREP[7];
  else if (DAYS[day]) e = DAYS[day];
  else {
    const week = Math.ceil(day / 7);
    const wk = WEEKS[week] || MAINTAIN;
    const i = (day - 1) % 7;
    e = { title: wk.title, about: wk.about, task: wk.tasks[i % wk.tasks.length], builds: week <= 12 && WEEKS[week] ? `Week ${week}: ${wk.title.toLowerCase()}. Each day this week adds one small habit that protects what you've built.` : "Every day you keep checking in is a day the old habit gets weaker." };
  }
  return { title: fill(e.title, product), about: fill(e.about, product), task: fill(e.task, product), builds: fill(e.builds, product) };
}
