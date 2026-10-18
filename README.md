# Second Wind

Tom's quit-vaping (and smoking) tracker, built like race day. Live at https://tomkeogh98.github.io/quit-vaping/

- **Today:** a different greeting every visit. The race bib shows a live clock from your last puff, plus money saved, nicotine left in the bottle, cravings beaten and your check-in streak. A coach's note appears when it helps. "Previously → Today → How it builds" follows a day-by-day plan: a prep week, days 1–28 one by one, weekly themes to week 12, then maintenance. Then today's splits (check in, today's task, move 20 minutes, journal) and the daily check-in.
- **Craving SOS:** a 5-minute ride-it-out timer with a breathing pacer, your reasons and distraction ideas. It logs strength, trigger and outcome.
- **Course:** health markers timed from your last nicotine (the NHS timeline for smoking, nicotine and withdrawal markers for vaping), plus the withdrawal elevation profile with your own craving ratings on top.
- **Splits:** green = clean, grey = before the start, red = slip, outlined = not checked in. Also craving patterns (by hour and by trigger), slips and the journal.
- **Medals:** distance, cravings beaten, money, check-in streak, full days, active days, and trigger medals built from your own log. A reward fund fills from your savings.
- **Aid station:** the four Ds, the breathing drill, if-then plans (ordered by your triggers), reasons, myths, and support (Stop for Life Oxon, NHS).

Plain HTML, CSS and ES modules, no build step. Data saves locally first, then syncs to the **private** repo `tomkeogh98/quit-vaping-data` through the GitHub API, merging field by field. If The Cut's or Guitar Hero's saved token (same origin) can see that repo, a device connects on its own. Otherwise use Settings → Devices & sync (setup link / QR / token). The data repo also sends the evening email nudges.

The site is served from the `gh-pages` branch. Bump `?v=N` on every CSS/JS reference and import when releasing.

## Tests

```sh
PY=~/Library/Caches/claude-playwright/venv/bin/python
$PY tests/run_logic.py    # clock, money, statuses, streaks, course, nudges, plan, medals, merge
$PY tests/smoke.py        # end to end in Chrome + screenshots (tests/out/) at 375/1024/1440/1920, light & dark
$PY tests/sync_test.py    # five devices against a fake GitHub API (setup link, borrowed Cut token, field merge)
$PY tests/phone_shots.py  # phone viewport screenshots for eyeballing
```
