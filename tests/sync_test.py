"""Multi-device sync test against an in-memory fake of the GitHub contents API (same sha/409 behaviour),
so it never touches real data. To hit a real *throwaway* repo instead:
SW_REAL=1 SW_TOKEN=… SW_REPO=owner/scratch-repo (never point it at quit-vaping-data).

Device A: registers, rides out a craving, checks in, then connects from Settings.
Device B: a fresh laptop. Connects from registration ("Already registered?"), so it must skip
          registration and show A's data; then ticks today's plan task.
Device C: a fresh phone (375px). Opens A's setup link (#/pair/…).
Device D: a laptop that only has The Cut's saved token. Must connect by itself on load.
Device E: has a Cut token WITHOUT access. Must stay unconnected, quietly.
Finally everyone must agree on A's check-in + craving and B's tick (field-level merge, same day).
"""
import base64
import hashlib
import json
import os
import sys
from datetime import date
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

from serve import serve

REAL = os.environ.get("SW_REAL") == "1"
TOKEN = os.environ["SW_TOKEN"] if REAL else "github_pat_FAKE_TEST_TOKEN"
REPO = os.environ["SW_REPO"] if REAL else "tomkeogh98/quit-vaping-data"
if REAL and REPO.endswith("/quit-vaping-data"):
    sys.exit("Refusing to run against the real data repo.")
TODAY = date.today().isoformat()
base, httpd = serve()
fails = []
FILES = {}
writes = {"n": 0, "conflicts": 0}


def sha(data):
    return hashlib.sha1(data).hexdigest()


def fake_github(route):
    req = route.request
    url = req.url.split("?")[0]
    prefix = f"https://api.github.com/repos/{REPO}"
    cors = {"Access-Control-Allow-Origin": "*"}
    if req.headers.get("authorization") != f"Bearer {TOKEN}":
        return route.fulfill(status=404 if req.headers.get("authorization") == "Bearer github_pat_CUT_ONLY" else 401, json={"message": "nope"}, headers=cors)
    if url == prefix:
        return route.fulfill(json={"full_name": REPO, "private": True, "permissions": {"push": True}}, headers=cors)
    path = unquote(url[len(prefix) + len("/contents/"):])
    if req.method == "GET":
        if path not in FILES:
            return route.fulfill(status=404, json={"message": "Not Found"}, headers=cors)
        return route.fulfill(json={"sha": sha(FILES[path]), "content": base64.b64encode(FILES[path]).decode()}, headers=cors)
    if req.method == "PUT":
        body = json.loads(req.post_data)
        if path in FILES and body.get("sha") != sha(FILES[path]):
            writes["conflicts"] += 1
            return route.fulfill(status=409, json={"message": "sha mismatch"}, headers=cors)
        FILES[path] = base64.b64decode(body["content"])
        writes["n"] += 1
        return route.fulfill(status=201, json={"content": {"sha": sha(FILES[path])}}, headers=cors)
    return route.fulfill(status=405, headers=cors)


def device(browser, **kw):
    ctx = browser.new_context(**kw)
    if not REAL:
        ctx.route("https://api.github.com/**", fake_github)
    page = ctx.new_page()
    page.on("pageerror", lambda e: fails.append(f"pageerror: {e}"))
    return ctx, page


def close_overlays(page):
    for _ in range(4):
        if page.locator(".finish").count():
            page.locator(".finish").first.click(force=True)
            page.wait_for_timeout(100)


def state(page):
    return page.evaluate("() => window.__sw.store.state")


def wait_synced(page, ms=8000):
    page.wait_for_function("() => window.__sw.store.sync.status === 'ok' && !document.querySelector('.loading')", timeout=ms)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    # A
    ctxA, A = device(b, viewport={"width": 1440, "height": 900})
    A.goto(base + "/")
    A.wait_for_selector("#regForm")
    A.click("label.big-choice:has-text('I already quit')")
    A.fill("input[name=quitAt]", "2026-10-10T09:00")
    A.click("#regForm button.btn.primary")
    A.wait_for_timeout(300)
    close_overlays(A)
    A.click(".hero-cta [data-act=sos]")
    A.click("[data-trig='coffee']")
    A.click("#sosBeat")
    close_overlays(A)
    A.click("label.big-choice.yes")
    A.fill("#checkinForm textarea", "Synced from A")
    A.click("#checkinForm button.btn.primary")
    A.goto(base + "/#/settings")
    A.wait_for_selector("#devices")
    A.locator("#devices details summary").first.click()
    A.fill("#connectForm input[name=token]", TOKEN)
    A.click("#connectForm button")
    wait_synced(A)
    link = A.evaluate("() => window.__sw.pairLink()")

    # B: connect from registration
    ctxB, B = device(b, viewport={"width": 1280, "height": 900})
    B.goto(base + "/")
    B.wait_for_selector(".join #connectForm")
    B.fill(".join input[name=token]", TOKEN)
    B.click(".join #connectForm button")
    wait_synced(B)
    B.wait_for_selector(".bib", timeout=8000)
    if B.input_value("#checkinForm textarea") != "Synced from A":
        fails.append("B doesn't show A's check-in")
    B.click("[data-tick=plan]")
    B.wait_for_timeout(2000)
    wait_synced(B)

    # C: phone via setup link
    ctxC, C = device(b, viewport={"width": 375, "height": 812})
    C.goto(link)
    C.wait_for_selector(".bib", timeout=10000)
    if "#/pair" in C.url:
        fails.append("token left in the address bar")

    # D: only The Cut's token on this origin
    ctxD, D = device(b, viewport={"width": 1280, "height": 900})
    D.goto(base + "/tests/blank.html")
    D.evaluate("t => localStorage.setItem('cut.settings.v1', JSON.stringify({ token: t, repo: 'tomkeogh98/the-cut-data' }))", TOKEN)
    D.goto(base + "/")
    D.wait_for_selector(".bib", timeout=10000)
    if D.evaluate("() => window.__sw.store.settings.borrowed") != "The Cut":
        fails.append("D didn't borrow The Cut's token")

    # E: Cut token without access stays quiet
    ctxE, E = device(b, viewport={"width": 1280, "height": 900})
    E.goto(base + "/tests/blank.html")
    E.evaluate("() => localStorage.setItem('cut.settings.v1', JSON.stringify({ token: 'github_pat_CUT_ONLY' }))")
    E.goto(base + "/")
    E.wait_for_selector("#regForm")
    E.wait_for_timeout(800)
    if E.evaluate("() => window.__sw.store.settings.token"):
        fails.append("E saved a token that can't see the repo")
    if "connect with the cut" not in E.inner_text(".join").lower():
        fails.append("E doesn't offer the Cut token button")

    # everyone agrees
    for page in (A, C, D):
        page.evaluate("() => window.__sw.syncNow()")
        wait_synced(page)
    for name, page in (("A", A), ("B", B), ("C", C), ("D", D)):
        s = state(page)
        ci = s["checkins"].get(TODAY, {})
        t = s["tasks"].get(TODAY, {})
        beat = [c for c in s["cravings"].values() if c.get("trigger") == "coffee"]
        if ci.get("note") != "Synced from A" or not t.get("plan") or len(beat) != 1:
            fails.append(f"{name} disagrees: note={ci.get('note')!r} plan={t.get('plan')} cravings={len(beat)}")
    b.close()
httpd.shutdown()
print(f"writes={writes['n']} conflicts={writes['conflicts']}")
for f in fails:
    print("FAIL", f)
print(f"sync: {len(fails)} failures")
sys.exit(1 if fails else 0)
