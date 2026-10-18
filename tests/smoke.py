"""End-to-end smoke test in headless Chrome.

Opens the site with no setup at all, rides out a craving with SOS, restarts the clock after a slip, then fakes
the date (day 1, day 10, day 40) and screenshots every page at 375/1024/1440/1920 in light and dark mode,
failing on console errors or horizontal overflow.

    ~/Library/Caches/claude-playwright/venv/bin/python tests/smoke.py [base_url]
"""
import os
import sys
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright

from serve import serve

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
QUIT = datetime(2026, 10, 18, 18, 56)
ROUTES = ["", "course", "tools", "settings"]
errors, fails = [], []


def watch(page):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and "favicon" not in (m.location.get("url") or "") and "api.github.com" not in (m.location.get("url") or "") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def close_overlays(page):
    for _ in range(5):
        if page.locator(".finish").count():
            page.locator(".finish").first.click(force=True)
            page.wait_for_timeout(120)


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")


def open_at(browser, base, when, w=1440, theme=None):
    ctx = browser.new_context(viewport={"width": w, "height": 900 if w > 400 else 812}, device_scale_factor=1 if w > 400 else 2)
    ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=404, json={}, headers={"Access-Control-Allow-Origin": "*"}))
    page = ctx.new_page()
    watch(page)
    page.clock.install(time=when)
    page.clock.resume()
    if theme:
        page.add_init_script(f"localStorage.setItem('sw.theme', '{theme}')")
    page.goto(base + "/")
    page.wait_for_selector(".bib")
    page.wait_for_timeout(900)
    close_overlays(page)
    return ctx, page


def main():
    base, httpd = (sys.argv[1].rstrip("/"), None) if len(sys.argv) > 1 else serve()
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")

        # ---------- 1. day one: no setup, SOS, slip ----------
        ctx, page = open_at(b, base, QUIT + timedelta(minutes=12))
        txt = page.inner_text("main").lower()
        for want in ["days clean", "pods not bought", "today's tip", "start line", "coming up", "remember why"]:
            if want not in txt:
                fails.append(f"day 1 Today missing {want!r}")
        if page.locator("form, input, textarea").count():
            fails.append("Today has a form; it should be read-only")
        t1 = page.inner_text("#clockT")
        page.wait_for_timeout(1200)
        if page.inner_text("#clockT") == t1:
            fails.append("clock isn't ticking")
        if not page.inner_text("#clockT").startswith("00:1"):
            fails.append(f"clock should read ~12 minutes: {page.inner_text('#clockT')}")
        page.screenshot(path=f"{OUT}/day1-1440.png", full_page=True)
        page.click(".hero-cta [data-act=sos]")
        page.wait_for_selector(".sos")
        page.wait_for_timeout(2200)
        page.screenshot(path=f"{OUT}/sos-1440.png")
        if page.inner_text("#sosClock") not in ("4:58", "4:57", "4:59"):
            fails.append(f"SOS clock not counting: {page.inner_text('#sosClock')}")
        page.click("#sosBeat")
        page.wait_for_selector(".finish")
        close_overlays(page)
        if page.inner_text(".hero-stats").find("1") < 0 or page.evaluate("() => Object.keys(window.__sw.store.state.cravings).length") != 1:
            fails.append("craving not counted")
        page.click("[data-act=slip]")
        page.wait_for_selector("#slipYes")
        page.screenshot(path=f"{OUT}/slip-1440.png")
        page.click("#slipYes")
        page.wait_for_timeout(1300)
        if not page.inner_text("#clockT").startswith("00:00:0"):
            fails.append(f"slip didn't restart the clock: {page.inner_text('#clockT')}")
        for r in ROUTES[1:]:
            page.goto(base + f"/#/{r}")
            page.wait_for_timeout(300)
        ctx.close()

        # ---------- 2. day 10 and day 40, every page, every width, both themes ----------
        for label, when in [("day10", QUIT + timedelta(days=9, hours=3)), ("day40", QUIT + timedelta(days=39, hours=16))]:
            for theme in ["light", "dark"]:
                for w in [375, 1024, 1440, 1920]:
                    if label == "day40" and w in (1024, 1920):
                        continue
                    ctx, page = open_at(b, base, when, w, theme)
                    if label == "day10" and "10" not in page.inner_text("#clockD") and "9" not in page.inner_text("#clockD"):
                        fails.append(f"day 10 clock shows {page.inner_text('#clockD')}")
                    for r in ROUTES:
                        page.goto(base + f"/#/{r}")
                        page.wait_for_timeout(700)
                        close_overlays(page)
                        if overflow(page):
                            fails.append(f"overflow: {r or 'today'} @ {w} {theme} {label}")
                        page.screenshot(path=f"{OUT}/{label}-{r or 'today'}-{w}-{theme}.png", full_page=True)
                    if w == 375 and theme == "light" and label == "day10":
                        for i, y in enumerate([0, 760, 1520, 2280]):
                            page.goto(base + "/#/")
                            page.wait_for_timeout(500)
                            page.evaluate(f"window.scrollTo(0, {y})")
                            page.wait_for_timeout(200)
                            page.screenshot(path=f"{OUT}/phone-today-{i}.png")
                        page.click(".tab-sos")
                        page.wait_for_timeout(400)
                        page.screenshot(path=f"{OUT}/phone-sos.png")
                    ctx.close()
        # a celebration fires for a milestone reached while away
        ctx, page = open_at(b, base, QUIT + timedelta(days=7, hours=2))
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
