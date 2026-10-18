"""End-to-end smoke test in headless Chrome.

Registers a fresh user, rides out a craving with the SOS timer, checks in, ticks the list and logs a slip;
then seeds ~3.5 weeks of realistic history (cravings, slips, check-ins, rewards) and screenshots every
page at 375/1024/1440/1920 in light and dark mode, failing on console errors or horizontal overflow.

    ~/Library/Caches/claude-playwright/venv/bin/python tests/smoke.py [base_url]
"""
import json
import os
import random
import sys
from datetime import date, datetime, timedelta

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
random.seed(7)


TODAY = date.today()
TRIGS = ["coffee", "coffee", "food", "alcohol", "stress", "editing", "break", "bored"]


def ms(d, h=12, m=0):
    return int(datetime(d.year, d.month, d.day, h, m).timestamp() * 1000)


def seed(days_in=24, product="vape"):
    quit_day = TODAY - timedelta(days=days_in - 1)
    s = {"version": 1, "checkins": {}, "cravings": {}, "slips": {}, "tasks": {}, "plans": {}, "reasons": {}, "rewards": {}, "milestones": {}, "attempts": {}}
    s["profile"] = {"name": "Tom", "product": product, "quitAt": ms(quit_day, 9), "method": "cold",
                    "vape": {"mgml": 20, "mlWeek": 6, "costWeek": 15}, "smoke": {"perDay": 10, "packPrice": 17},
                    "why": "To breathe properly at run club, sound like myself on camera, and stop being on a leash to a little device.", "updatedAt": 1}
    slip_day = quit_day + timedelta(days=9)
    n = 0
    for i in range(days_in):
        d = quit_day + timedelta(days=i)
        k = d.isoformat()
        intensity = max(0, round(5 * (1 if i < 3 else 0.6 ** ((i - 2) / 3)) + random.uniform(-0.6, 0.6)))
        for _ in range(max(0, 6 - i // 3) if i < 18 else random.randint(0, 1)):
            n += 1
            h = random.choice([8, 10, 13, 15, 20, 21, 21, 22])
            s["cravings"][f"c{n}"] = {"at": ms(d, h, random.randint(0, 59)), "date": k, "intensity": random.randint(1, 5), "trigger": random.choice(TRIGS),
                                      "outcome": "slip" if d == slip_day and h >= 20 and not any(v["date"] == k and v["outcome"] == "slip" for v in s["cravings"].values()) else "beat", "updatedAt": 1}
        if d == TODAY:
            continue
        if d == slip_day:
            s["slips"]["s1"] = {"at": ms(d, 22, 30), "date": k, "trigger": "alcohol", "spent": 0, "note": "Third pint, mate offered. Leave earlier next time.", "updatedAt": 1}
        if random.random() < 0.85 or i < 5:
            s["checkins"][k] = {"clean": d != slip_day, "cravings": min(5, intensity), "mood": random.randint(2, 5), "sleep": random.randint(2, 5),
                                "note": random.choice(["Coffee was the hard bit. Walked round the block and it passed.", "Grumpy all afternoon but got through it.",
                                                       "Run club felt easier on the hills. Chest feels clearer.", "Barely thought about it today.",
                                                       "Edited for four hours and reached for it twice out of habit. Gum helped."]) if random.random() < 0.7 else "", "updatedAt": 1}
        s["tasks"][k] = {"plan": random.random() < 0.8, "move": d.weekday() == 2 or random.random() < 0.5, "updatedAt": 1}
    s["rewards"]["r1"] = {"name": "New running shoes", "price": 110, "createdAt": 1, "updatedAt": 1}
    s["rewards"]["r2"] = {"name": "Takeaway with Cat", "price": 30, "createdAt": 0, "updatedAt": 1, "claimed": (quit_day + timedelta(days=8)).isoformat()}
    s["reasons"]["x1"] = {"text": "Breathe easy on the long runs at Oxford Run Club", "updatedAt": 1}
    s["reasons"]["x2"] = {"text": "A clear voice on camera: no dry throat, no clearing it every take", "updatedAt": 1}
    s["plans"]["p1"] = {"trigger": "coffee", "then": "Different mug, glass of water first, then coffee by the window.", "updatedAt": 1}
    s["attempts"]["a1"] = {"quitAt": ms(quit_day, 9), "product": product, "updatedAt": 1}
    return s


errors = []


def watch(page):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text} @ {m.location.get('url')}")
            if m.type == "error" and "api.github.com" not in (m.location.get("url") or "") and "favicon" not in (m.location.get("url") or "") and "401" not in m.text else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def close_overlays(page):
    for _ in range(5):
        if page.locator(".finish").count():
            page.locator(".finish").first.click(force=True)
            page.wait_for_timeout(120)


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")


def load_state(page, state, theme=None):
    page.evaluate("""([s, t]) => { localStorage.setItem('sw.state.v1', JSON.stringify(s)); if (t) localStorage.setItem('sw.theme', t); else localStorage.removeItem('sw.theme'); }""", [state, theme])
    page.reload()
    page.wait_for_selector("main#view > *")
    page.wait_for_timeout(900)
    close_overlays(page)


def main():
    if len(sys.argv) > 1:
        BASE, httpd = sys.argv[1].rstrip("/"), None
    else:
        BASE, httpd = serve()
    fails = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        # ---------- 1. fresh registration → SOS → check-in → slip ----------
        ctx = b.new_context(viewport={"width": 1440, "height": 1000})
        page = ctx.new_page()
        watch(page)
        page.goto(BASE + "/")
        page.wait_for_selector("#regForm")
        page.screenshot(path=f"{OUT}/register-1440.png", full_page=True)
        page.check("input[name=product][value=vape]", force=True)
        page.fill("input[name=costWeek]", "14")
        page.click("#regForm button.btn.primary")
        page.wait_for_selector(".finish")
        page.screenshot(path=f"{OUT}/start-celebration.png")
        close_overlays(page)
        page.wait_for_selector(".bib")
        t1 = page.inner_text("#clockT")
        page.wait_for_timeout(1300)
        if page.inner_text("#clockT") == t1:
            fails.append("clean clock isn't ticking")
        # SOS
        page.click(".hero-cta [data-act=sos]")
        page.wait_for_selector(".sos")
        page.click("[data-int='4']")
        page.click("[data-trig='coffee']")
        page.wait_for_timeout(2200)
        page.screenshot(path=f"{OUT}/sos-1440.png")
        if page.inner_text("#sosClock") not in ("4:58", "4:57", "4:59"):
            fails.append(f"SOS clock not counting: {page.inner_text('#sosClock')}")
        page.click("#sosBeat")
        page.wait_for_selector(".finish")
        close_overlays(page)
        n = page.evaluate("() => Object.values(window.__sw.store.state.cravings).filter(c => c.outcome === 'beat' && c.trigger === 'coffee').length")
        if n != 1:
            fails.append(f"craving not logged ({n})")
        # check in
        page.click("label.big-choice.yes")
        page.click(".scale:nth-of-type(1) label.chip:has-text('2')")
        page.fill("#checkinForm textarea", "First day. Coffee was rough but the timer helped.")
        page.click("#checkinForm button.btn.primary")
        page.wait_for_timeout(300)
        if not page.locator(".item[data-item=checkin].done").count() or not page.locator(".item[data-item=journal].done").count():
            fails.append("check-in didn't tick check-in + journal")
        page.click("[data-tick=plan]")
        page.wait_for_timeout(200)
        if not page.locator(".item[data-item=plan].done").count():
            fails.append("plan tick didn't stick")
        # slip
        page.click("[data-act=slip]")
        page.wait_for_selector(".slip-form")
        page.click(".slip-form [data-trig='stress']")
        page.click(".slip-form button.btn.primary")
        page.wait_for_timeout(400)
        if page.locator(".slip-form").count():  # quit time is "now"; a slip at the same minute may predate it
            page.locator("dialog .x").first.click()
        # medals, aid, course, splits all render
        for r in ["course", "splits", "medals", "aid", "settings"]:
            page.goto(BASE + f"/#/{r}")
            page.wait_for_timeout(250)
            close_overlays(page)
        # reward + reason + plan
        page.goto(BASE + "/#/medals")
        page.fill("#rewardForm input[name=name]", "Camera lens")
        page.fill("#rewardForm input[name=price]", "200")
        page.click("#rewardForm button")
        page.wait_for_timeout(200)
        if "Camera lens" not in page.inner_text(".reward-fund"):
            fails.append("reward not added")
        page.goto(BASE + "/#/aid")
        page.fill("#reasonForm input", "Wake up without reaching for anything")
        page.click("#reasonForm button")
        page.wait_for_timeout(200)
        if "Wake up without" not in page.inner_text(".reasons"):
            fails.append("reason not added")
        # bad token: friendly error
        page.route("https://api.github.com/**", lambda r: r.fulfill(status=401, json={"message": "Bad credentials"}, headers={"Access-Control-Allow-Origin": "*"}))
        page.goto(BASE + "/#/settings")
        page.wait_for_selector("#devices")
        page.locator("#devices details summary").first.click()
        page.fill("#connectForm input[name=token]", " github_pat_bad​token \n")
        page.click("#connectForm button")
        page.wait_for_timeout(600)
        msg = page.inner_text("#connectMsg")
        if "rejected the token" not in msg:
            fails.append(f"bad-token message: {msg!r}")
        tok = page.evaluate("() => window.__sw.store.settings.token")
        if tok != "github_pat_badtoken":
            fails.append(f"token not sanitised: {tok!r}")
        ctx.close()

        # ---------- 2. seeded history, every page, every width, both themes ----------
        state = seed()
        routes = ["", "course", "splits", "medals", "aid", "settings"]
        for theme in ["light", "dark"]:
            for w in [375, 1024, 1440, 1920]:
                ctx = b.new_context(viewport={"width": w, "height": 900 if w > 400 else 812}, device_scale_factor=1 if w > 400 else 2)
                page = ctx.new_page()
                watch(page)
                page.goto(BASE + "/")
                load_state(page, state, theme)
                for r in routes:
                    page.goto(BASE + f"/#/{r}")
                    page.wait_for_timeout(1100 if r == "" else 800)
                    close_overlays(page)
                    if overflow(page):
                        fails.append(f"overflow: {r or 'today'} @ {w} {theme}")
                    page.screenshot(path=f"{OUT}/{r or 'today'}-{w}-{theme}.png", full_page=True)
                if w == 375 and theme == "light":
                    page.goto(BASE + "/#/")
                    page.click(".tab-sos")
                    page.wait_for_selector(".sos")
                    page.wait_for_timeout(300)
                    page.screenshot(path=f"{OUT}/sos-375.png")
                    if overflow(page):
                        fails.append("overflow: SOS @ 375")
                    page.locator("dialog .x").first.click()
                    page.click("#moreBtn")
                    page.wait_for_timeout(200)
                    page.screenshot(path=f"{OUT}/more-375.png")
                    page.locator("dialog .x").first.click()
                    page.goto(BASE + "/#/splits")
                    page.wait_for_timeout(300)
                    page.locator(".day.st-slip").first.click()
                    page.wait_for_timeout(250)
                    page.screenshot(path=f"{OUT}/daypanel-375.png")
                ctx.close()

        # ---------- 3. nudges and special states ----------
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        watch(page)
        page.goto(BASE + "/")
        s2 = seed(6)
        yday = (TODAY - timedelta(days=1)).isoformat()
        s2["checkins"].pop(yday, None)
        s2["slips"] = {}
        load_state(page, s2)
        if "coach's note" not in page.inner_text("main").lower() or "check in" not in page.inner_text(".coach").lower():
            fails.append("confirm-yesterday note missing")
        page.click("[data-confirm=clean]")
        page.wait_for_timeout(300)
        if page.evaluate(f"() => window.__sw.store.state.checkins['{yday}']?.clean") is not True:
            fails.append("confirm yesterday didn't save")
        page.screenshot(path=f"{OUT}/nudge-confirm.png", full_page=True)
        # wobble
        s3 = seed(12)
        for i in range(1, 4):
            d = TODAY - timedelta(days=i)
            s3["slips"][f"w{i}"] = {"at": ms(d, 21), "date": d.isoformat(), "trigger": "alcohol", "updatedAt": 1}
        load_state(page, s3)
        if "three times more likely" not in page.inner_text(".coach").lower() and "backup" not in page.inner_text(".coach").lower():
            fails.append("wobble note missing")
        page.screenshot(path=f"{OUT}/nudge-wobble.png")
        # pre-quit countdown
        s4 = seed(1)
        s4["profile"]["quitAt"] = ms(TODAY + timedelta(days=3), 9)
        s4["cravings"], s4["checkins"], s4["slips"], s4["tasks"] = {}, {}, {}, {}
        load_state(page, s4)
        if "starts in" not in page.inner_text(".bib").lower() or "tell your crew" not in page.inner_text(".brief").lower():
            fails.append(f"pre-quit countdown/prep plan missing: {page.inner_text('.brief')[:200]}")
        page.screenshot(path=f"{OUT}/prequit-1440.png", full_page=True)
        # smoker
        load_state(page, seed(30, "smoke"))
        page.goto(BASE + "/#/course")
        page.wait_for_timeout(300)
        if "carbon monoxide gone" not in page.inner_text("main").lower():
            fails.append("smoker course missing CO marker")
        page.goto(BASE + "/#/")
        page.wait_for_timeout(300)
        if "not smoked" not in page.inner_text(".hero-stats").lower():
            fails.append("smoker stats missing")
        page.screenshot(path=f"{OUT}/smoker-today.png")
        ctx.close()
        b.close()

    if httpd:
        httpd.shutdown()
    for e in errors:
        print("ERR", e)
    for f in fails:
        print("FAIL", f)
    print(f"smoke: {len(fails)} failures, {len(errors)} errors · screenshots in tests/out/")
    sys.exit(1 if fails or errors else 0)


if __name__ == "__main__":
    main()
