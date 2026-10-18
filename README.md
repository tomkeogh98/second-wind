# Second Wind

Tom's quit-vaping companion, built like race day. Live at https://tomkeogh98.github.io/quit-vaping/

Deliberately low-effort: nothing to fill in, no check-ins. It's tools, motivation, tips and reminders.

- **Today:** a different greeting every visit. The race bib runs a live clock from the start line (Sun 18 Oct 2026, 18:56). Also on the page:
  - money saved, BM600 pods not bought, nicotine not inhaled, cravings beaten;
  - today's tip, from a day-by-day plan (days 1–28 one by one, weekly themes to week 12, then maintenance);
  - what's happening in your body right now;
  - the milestones coming up, with dates and what you'll have saved;
  - your reasons.
- **Craving SOS:** a 5-minute ride-it-out timer with a breathing pacer, rotating your reasons and things to do. One tap when it's gone. "I slipped" restarts the clock.
- **Course:** health markers timed from the last nicotine, plus the withdrawal elevation profile.
- **Toolkit:** the four Ds, a breathing drill, a plan for every trigger, myths answered, and support (Stop for Life Oxon, NHS).
- **Reminders by email** from the private repo `tomkeogh98/quit-vaping-data`: tomorrow's tip each evening for the first two weeks and on the eve of big days, heads-ups when a body marker is due, and a kind word after a slip.

The usage numbers are built into `js/store.js`: a Lost Mary BM600 with pre-filled pods (2 ml, 20 mg/ml), a 2-pack a day at about £6.50. The clock works on every device with no setup. Sync is optional and only carries slips and cravings-beaten. It connects by itself when The Cut's saved token can see `quit-vaping-data`, or via Settings → Sync across devices.

The site is served from the `gh-pages` branch. Bump `?v=N` on every CSS/JS reference and import when releasing.

## Tests

```sh
PY=~/Library/Caches/claude-playwright/venv/bin/python
$PY tests/run_logic.py    # money, pods, clock, slips, course, milestones (incl. clocks change), tips, merge
$PY tests/smoke.py [url]  # fakes day 1 / 10 / 40; every page at 375/1024/1440/1920, light & dark; SOS + slip
$PY tests/sync_test.py    # optional sync against a fake GitHub API: setup link, borrowed Cut token, slip restarts everywhere
```
