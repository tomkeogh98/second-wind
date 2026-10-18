"""Phone-sized viewport screenshots (375×812) of each page at a few scroll positions, for eyeballing.

    ~/Library/Caches/claude-playwright/venv/bin/python tests/phone_shots.py [theme]
"""
import sys

from playwright.sync_api import sync_playwright

from serve import serve
from smoke import OUT, close_overlays, load_state, seed

theme = sys.argv[1] if len(sys.argv) > 1 else "light"
base, httpd = serve()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    page = b.new_page(viewport={"width": 375, "height": 812}, device_scale_factor=2)
    page.goto(base + "/")
    load_state(page, seed(), theme)
    for r in ["", "course", "splits", "medals", "aid"]:
        page.goto(base + f"/#/{r}")
        page.wait_for_timeout(1000)
        close_overlays(page)
        h = page.evaluate("document.documentElement.scrollHeight")
        for i, y in enumerate(range(0, min(h, 812 * 4), 760)):
            page.evaluate(f"window.scrollTo(0, {y})")
            page.wait_for_timeout(150)
            page.screenshot(path=f"{OUT}/phone-{r or 'today'}-{theme}-{i}.png")
    b.close()
httpd.shutdown()
