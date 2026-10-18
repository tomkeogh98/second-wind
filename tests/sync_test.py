"""Optional sync, tested against an in-memory fake of the GitHub contents API (same sha/409 behaviour).

Device A: beats a craving, then connects from Settings → Sync across devices.
Device B: opens A's setup link (#/pair/…) on a phone.
Device C: a laptop that only has The Cut's saved token: connects by itself on load, silently.
Device D: has a Cut token WITHOUT access: stays unconnected, no errors, no nagging.
Then B restarts the clock after a slip, and A and C must see the clock restart and A's craving.
"""
import base64
import hashlib
import json
import sys
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

from serve import serve

TOKEN = "github_pat_FAKE_TEST_TOKEN"
REPO = "tomkeogh98/second-wind-data"
base, httpd = serve()
fails = []
FILES = {}


def sha(data):
    return hashlib.sha1(data).hexdigest()


def fake_github(route):
    req = route.request
    url = req.url.split("?")[0]
    prefix = f"https://api.github.com/repos/{REPO}"
    cors = {"Access-Control-Allow-Origin": "*"}
    if req.headers.get("authorization") != f"Bearer {TOKEN}":
        return route.fulfill(status=404, json={"message": "Not Found"}, headers=cors)
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
            return route.fulfill(status=409, json={"message": "sha mismatch"}, headers=cors)
        FILES[path] = base64.b64decode(body["content"])
        return route.fulfill(status=201, json={"content": {"sha": sha(FILES[path])}}, headers=cors)
    return route.fulfill(status=405, headers=cors)


def device(browser, cut_token=None, **kw):
    ctx = browser.new_context(**kw)
    ctx.route("https://api.github.com/**", fake_github)
    if cut_token:
        ctx.add_init_script(f"localStorage.setItem('cut.settings.v1', JSON.stringify({{ token: '{cut_token}' }}))")
    page = ctx.new_page()
    page.on("pageerror", lambda e: fails.append(f"pageerror: {e}"))
    page.on("console", lambda m: fails.append(f"console: {m.text}") if m.type == "error" and "404" not in m.text else None)
    return ctx, page


def close_overlays(page):
    for _ in range(4):
        if page.locator(".finish").count():
            page.locator(".finish").first.click(force=True)
            page.wait_for_timeout(100)


def synced(page):
    page.wait_for_function("() => window.__sw.store.sync.status === 'ok'", timeout=8000)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctxA, A = device(b, viewport={"width": 1440, "height": 900})
    A.goto(base + "/")
    A.wait_for_selector(".bib")
    close_overlays(A)
    A.click(".hero-cta [data-act=sos]")
    A.click("#sosBeat")
    close_overlays(A)
    A.goto(base + "/#/settings")
    A.click(".optional-sync summary")
    A.locator("#devices details summary").first.click()
    A.fill("#connectForm input[name=token]", TOKEN)
    A.click("#connectForm button")
    synced(A)
    link = A.evaluate("() => window.__sw.pairLink()")

    ctxB, B = device(b, viewport={"width": 375, "height": 812})
    B.goto(link)
    B.wait_for_selector(".bib")
    synced(B)
    if "#/pair" in B.url:
        fails.append("token left in the address bar")
    close_overlays(B)
    if B.evaluate("() => Object.keys(window.__sw.store.state.cravings).length") != 1:
        fails.append("B didn't get A's craving")

    ctxC, C = device(b, cut_token=TOKEN, viewport={"width": 1280, "height": 900})
    C.goto(base + "/")
    C.wait_for_function("() => window.__sw.store.settings.borrowed === 'The Cut'", timeout=8000)
    synced(C)

    ctxD, D = device(b, cut_token="github_pat_CUT_ONLY", viewport={"width": 1280, "height": 900})
    D.goto(base + "/")
    D.wait_for_selector(".bib")
    D.wait_for_timeout(1000)
    if D.evaluate("() => window.__sw.store.settings.token"):
        fails.append("D saved a token that can't see the repo")
    if D.locator(".sync-banner").count():
        fails.append("D shows a sync banner")

    # B slips → everyone's clock restarts
    close_overlays(B)
    B.click("[data-act=slip]")
    B.click("#slipYes")
    B.wait_for_timeout(1600)
    synced(B)
    for name, page in (("A", A), ("C", C)):
        page.evaluate("() => window.__sw.syncNow()")
        synced(page)
        page.goto(base + "/#/course")
        page.goto(base + "/#/")
        page.wait_for_timeout(1200)
        close_overlays(page)
        if not page.inner_text("#clockT").startswith("00:00:"):
            fails.append(f"{name} clock didn't restart: {page.inner_text('#clockT')}")
        if page.evaluate("() => Object.keys(window.__sw.store.state.cravings).length") != 1:
            fails.append(f"{name} lost the craving")
    b.close()
httpd.shutdown()
for f in fails:
    print("FAIL", f)
print(f"sync: {len(fails)} failures")
sys.exit(1 if fails else 0)
