// State lives in localStorage (works offline) and syncs to data.json in a private GitHub repo.
// Every record merges field by field (last write wins per field), deletes are tombstones,
// so two devices logging at the same time never lose anything.
const STATE_KEY = "sw.state.v2";
const SETTINGS_KEY = "sw.settings.v1";
export const DEFAULT_REPO = "tomkeogh98/quit-vaping-data";
const MAPS = ["cravings", "slips", "milestones"];

// Tom's numbers, built in so there's nothing to set up: a Lost Mary BM600 with pre-filled pods
// (2 ml of 20 mg/ml nicotine salt, rated up to ~600 puffs each), a 2-pack a day at about £6.50.
export const QUIT_AT = 1792346160000; // Sunday 18 October 2026, 18:56 (UK)
export const DEFAULT_PROFILE = {
  name: "Tom",
  product: "vape", // vape | smoke | both
  device: "Lost Mary BM600",
  quitAt: QUIT_AT, // epoch ms; "I slipped" logs a slip, it doesn't move this
  podsDay: 2,
  vape: { mgml: 20, mlWeek: 28, costWeek: 45.5 },
  smoke: { perDay: 0, packPrice: 0 },
  why: "To breathe properly at run club, sound like myself on camera, and stop being on a leash to a little device.",
};

const blank = () => ({ version: 1, profile: null, ...Object.fromEntries(MAPS.map((k) => [k, {}])) });

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const listeners = new Set();
export const store = {
  state: normalise(readJSON(STATE_KEY, {})),
  settings: Object.assign({ token: "", repo: DEFAULT_REPO, borrowed: "" }, readJSON(SETTINGS_KEY, {})),
  rev: 0, // bumps whenever the data changes, so views know to redraw
  sync: { status: "off", message: "", lastSynced: null },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn()); },
};

function normalise(s) {
  const out = Object.assign(blank(), s || {});
  for (const k of MAPS) out[k] ||= {};
  return out;
}

export const profile = () => {
  const p = store.state.profile || {};
  return { ...DEFAULT_PROFILE, ...p, vape: { ...DEFAULT_PROFILE.vape, ...(p.vape || {}) }, smoke: { ...DEFAULT_PROFILE.smoke, ...(p.smoke || {}) } };
};
export const onboarded = () => true;

export function update(mutator) {
  mutator(store.state);
  store.rev++;
  if (!writeJSON(STATE_KEY, store.state)) console.warn("Couldn't save locally (storage full?)");
  store.emit();
  scheduleSync();
}
export function setProfile(patch) {
  update((s) => { s.profile = { ...(s.profile || {}), ...patch, updatedAt: Date.now() }; });
}
// Every field written through setRec gets its own timestamp (_f), so two devices editing the same
// record (a check-in on the phone, today's task on the laptop) merge instead of overwriting.
export function setRec(map, key, rec) {
  update((s) => {
    const now = Date.now();
    const cur = s[map][key] || {};
    const _f = { ...(cur._f || {}) };
    for (const k of Object.keys(rec)) _f[k] = now;
    s[map][key] = { ...cur, ...rec, _f, updatedAt: now };
  });
}
export const removeRec = (map, key) => setRec(map, key, { deleted: true });

// Tokens and repo names are plain ASCII; pasting (especially on phones) can drag in
// spaces, line breaks or invisible characters that break the request.
export const clean = (v) => String(v ?? "").replace(/[^\x21-\x7e]/g, "");

export function saveSettings(patch) {
  if ("token" in patch) patch.token = clean(patch.token);
  if ("repo" in patch) patch.repo = clean(patch.repo).replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
  Object.assign(store.settings, patch);
  writeJSON(SETTINGS_KEY, store.settings);
  store.emit();
}

// ---------- merge (last write wins per field, tombstones for deletes) ----------
const META = new Set(["_f", "updatedAt"]);
export function mergeRec(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (!a._f && !b._f) return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
  const out = {}, _f = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (META.has(k)) continue;
    const ta = a._f?.[k] ?? (k in a ? a.updatedAt || 0 : -1);
    const tb = b._f?.[k] ?? (k in b ? b.updatedAt || 0 : -1);
    const win = tb > ta ? b : a;
    if (k in win) out[k] = win[k];
    _f[k] = Math.max(ta, tb);
  }
  return { ...out, _f, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = mergeRec(out[k], v);
  return out;
}
export function merge(local, remote) {
  if (!remote) return local;
  remote = normalise(remote);
  const lp = local.profile, rp = remote.profile;
  const out = { version: 1, profile: !lp ? rp : !rp ? lp : (rp.updatedAt || 0) > (lp.updatedAt || 0) ? rp : lp };
  for (const k of MAPS) out[k] = mergeMap(local[k], remote[k]);
  return out;
}

// ---------- GitHub sync ----------
export const configured = () => Boolean(store.settings.token && store.settings.repo);

async function gh(path, opts = {}, token = store.settings.token, repo = store.settings.repo) {
  // Never a trailing slash: api.github.com 404s the CORS preflight for /repos/owner/name/
  const url = `https://api.github.com/repos/${repo}${path ? `/${path}` : ""}`;
  try {
    return await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
        ...(opts.headers || {}),
      },
    });
  } catch {
    throw new Error(navigator.onLine === false
      ? "You're offline. Everything's saved on this device and will sync when you're back online"
      : "Couldn't reach GitHub. Check your connection, or turn off any content blocker for this site");
  }
}

const toB64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64Text = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

let remoteSha = null;

async function pull() {
  const res = await gh(`contents/data.json?t=${Date.now()}`);
  if (res.status === 404) {
    // 404 means either "no data yet" or "no access"; tell them apart by asking for the repo itself.
    const repo = await gh("");
    if (!repo.ok) throw new Error(await errText(repo));
    remoteSha = null;
    return null;
  }
  if (!res.ok) throw new Error(await errText(res));
  const body = await res.json();
  remoteSha = body.sha;
  if (!body.content && body.git_url) { // over 1 MB: fetch the raw blob instead
    const raw = await gh(`contents/data.json?t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw" } });
    if (!raw.ok) throw new Error(await errText(raw));
    return JSON.parse(await raw.text());
  }
  return JSON.parse(fromB64Text(body.content));
}

async function push(data) {
  const res = await gh("contents/data.json", {
    method: "PUT",
    body: JSON.stringify({
      message: `Second Wind update ${new Date().toISOString()}`,
      content: toB64(new TextEncoder().encode(JSON.stringify(data))),
      ...(remoteSha ? { sha: remoteSha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) return false; // another device wrote first: pull, merge, retry
  if (!res.ok) throw new Error(await errText(res));
  remoteSha = (await res.json()).content.sha;
  return true;
}

async function errText(res) {
  if (res.status === 401) return "GitHub rejected the token (expired or wrong?)";
  if (res.status === 403) return "The token doesn't have write access to quit-vaping-data";
  if (res.status === 404) return "The token can't see quit-vaping-data. Add that repo to the token's repository access on GitHub";
  try { return (await res.json()).message || res.statusText; } catch { return res.statusText; }
}

let syncing = null, timer = null, again = false;
function scheduleSync() {
  if (!configured()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 1200);
}

export function syncNow() {
  if (!configured()) { store.sync = { status: "off", message: "Not connected", lastSynced: null }; store.emit(); return Promise.resolve(); }
  if (syncing) { again = true; return syncing; }
  store.sync = { ...store.sync, status: "syncing", message: "Syncing…" };
  store.emit();
  syncing = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await pull();
        // A device joining an existing setup defers to the shared profile rather than its own first-run one.
        if (store.settings.joining && remote?.profile && store.state.profile) store.state.profile.updatedAt = 0;
        const merged = merge(store.state, remote);
        if (store.settings.joining) saveSettings({ joining: false });
        if (JSON.stringify(merged) !== JSON.stringify(store.state)) store.rev++;
        store.state = merged;
        writeJSON(STATE_KEY, merged);
        if (JSON.stringify(remote) === JSON.stringify(merged)) break;
        if (await push(merged)) break;
      }
      store.sync = { status: "ok", message: "Synced", lastSynced: new Date() };
    } catch (e) {
      store.sync = { status: "error", message: e.message || String(e), lastSynced: store.sync.lastSynced };
    } finally {
      syncing = null;
      store.emit();
      if (again) { again = false; scheduleSync(); }
    }
  })();
  return syncing;
}

export async function testConnection(token = store.settings.token, repoName = store.settings.repo) {
  const res = await gh("", {}, token, repoName);
  if (!res.ok) throw new Error(await errText(res));
  const repo = await res.json();
  if (!repo.private) throw new Error("That repo is public! Your quit data would be visible to anyone. Use a private repo.");
  if (!repo.permissions?.push) throw new Error("The token can read the repo but not write to it. Give it Contents: Read and write.");
  return repo.full_name;
}

// ---------- borrowing a token from Tom's other sites ----------
// The Cut and Guitar Hero live on the same origin (tomkeogh98.github.io), so their saved sync tokens
// are readable here. If one of them has been given access to quit-vaping-data, this device connects
// itself with no setup at all.
const SIBLINGS = [["cut.settings.v1", "The Cut"], ["gh.settings.v1", "Guitar Hero"]];
export function siblingTokens() {
  const out = [];
  for (const [key, name] of SIBLINGS) {
    const t = clean(readJSON(key, {})?.token);
    if (t && !out.some((o) => o.token === t)) out.push({ token: t, name });
  }
  return out;
}
export async function borrowToken() {
  if (configured()) return false;
  for (const { token, name } of siblingTokens()) {
    try {
      await testConnection(token, store.settings.repo || DEFAULT_REPO);
      saveSettings({ token, borrowed: name, joining: !onboarded() });
      await syncNow();
      return name;
    } catch { /* that token can't see the repo: try the next */ }
  }
  return false;
}

// ---------- backup ----------
export function exportJSON() {
  return new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.cravings !== "object" || typeof data.slips !== "object") throw new Error("That doesn't look like a Second Wind backup.");
  update((s) => Object.assign(s, merge(s, data)));
}

// ---------- pairing another device ----------
// The link carries the repo + token in the URL fragment (#…), which browsers never send to a server.
export function pairLink() {
  const code = btoa(JSON.stringify({ r: store.settings.repo, t: store.settings.token })).replace(/=+$/, "");
  return `${location.origin}${location.pathname}#/pair/${code}`;
}
export function readPairCode(code) {
  try {
    const { r, t } = JSON.parse(atob(decodeURIComponent(code)));
    return r && t ? { repo: r, token: t } : null;
  } catch { return null; }
}
// Connect this device: save, check the repo, then pull everything down.
export async function connectDevice(repo, token) {
  saveSettings({ repo, token, borrowed: "", joining: !store.sync.lastSynced });
  const name = await testConnection();
  await syncNow();
  if (store.sync.status === "error") throw new Error(store.sync.message);
  return name;
}

export function wipeLocal() {
  try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
}
