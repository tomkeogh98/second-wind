// Devices & sync: connect this device (borrowed token, setup link or pasted token) and pair new ones (link / QR).
import { esc } from "./util.js?v=1";
import { borrowToken, configured, connectDevice, pairLink, siblingTokens, store, syncNow } from "./store.js?v=1";
import { $, toast } from "./ui.js?v=1";

const QR_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const QR_SRI = "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1";

const ago = (d) => {
  if (!d) return "not yet";
  const m = Math.round((Date.now() - d) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
};

export function connectForm(st, { intro = "", submit = "Connect this device" } = {}) {
  return `<form class="connect-form" id="connectForm">
    ${intro}
    <label>Token <input name="token" type="password" autocomplete="off" value="${esc(st.borrowed ? "" : st.token)}" placeholder="github_pat_…"></label>
    <details class="fine"><summary>Data repo (${esc(st.repo)})</summary><label>Repo <input name="repo" value="${esc(st.repo)}"></label></details>
    <button class="btn primary">${esc(submit)}</button>
    <p class="fine" id="connectMsg" role="status"></p>
  </form>`;
}

const STEPS = `<ol class="fine steps">
  <li><b>Easiest:</b> open <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a>, edit the token The Cut uses, and add <b>quit-vaping-data</b> under Repository access. Save. Every device that already runs The Cut then connects here by itself.</li>
  <li><b>Or</b> make a new fine-grained token: Only select repositories → <b>quit-vaping-data</b>, Permissions → <b>Contents: Read and write</b>, and paste it below.</li>
</ol>`;

export function devicesCard(st) {
  const on = configured() && store.sync.status !== "error";
  const sibs = siblingTokens();
  return `<section class="panel devices" id="devices">
    <h2>Devices & sync</h2>
    ${on ? `<p class="sync-ok"><i></i> <b>This device is connected</b> to ${esc(st.repo)}${st.borrowed ? ` (using ${esc(st.borrowed)}'s token)` : ""} · synced ${ago(store.sync.lastSynced)}</p>
      <h3 class="label">Add another laptop or phone</h3>
      <p>Devices that already run The Cut connect by themselves. For any other device, scan this code with its camera or open the setup link. It connects in one tap.</p>
      <div class="pair">
        <div class="qr" id="qr" aria-label="QR code with a setup link for another device"><button class="btn" type="button" id="showQr">Show QR code</button></div>
        <div class="pair-actions">
          <button class="btn primary" type="button" id="copyLink">Copy setup link</button>
          ${navigator.share ? `<button class="btn" type="button" id="shareLink">Send to my other device…</button>` : ""}
          <button class="btn ghost" type="button" id="syncNowBtn">Sync now</button>
          <p class="fine">The link contains your sync token. Anyone with it can read and edit your Second Wind data, so only open it on your own devices. If it leaks, delete the token on GitHub and make a new one.</p>
        </div>
      </div>
      <details><summary class="fine">Change token or repo</summary>${connectForm(st, { submit: "Save & reconnect" })}</details>`
    : `<p class="warn-line"><b>${configured() ? "Sync isn't working on this device." : "This device isn't syncing yet."}</b> ${configured() ? esc(store.sync.message) : "Anything you log here stays here until you connect it."}</p>
      ${sibs.length ? `<p>This browser has a token from ${esc(sibs.map((x) => x.name).join(" and "))}. Once that token can see quit-vaping-data, it connects automatically. <button class="btn" type="button" id="tryBorrow">Try it now</button></p>` : ""}
      <p><b>Connected on another device?</b> Open Settings there and use <i>Copy setup link</i> or the QR code.</p>
      <details ${configured() ? "open" : ""}><summary><b>Set up a token</b></summary>${STEPS}${connectForm(st)}</details>`}
  </section>`;
}

export function wireConnectForm(root, after) {
  const form = $("#connectForm", root);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const msg = $("#connectMsg", root);
    msg.textContent = "Connecting…";
    try {
      const name = await connectDevice(String(f.get("repo") || store.settings.repo), String(f.get("token") || ""));
      toast(`Connected to ${name}. Everything's in sync.`);
      after?.();
    } catch (err) { msg.textContent = err.message; }
  });
}

function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = QR_SRC; s.integrity = QR_SRI; s.crossOrigin = "anonymous";
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => reject(new Error("Couldn't load the QR code generator. Use the setup link instead."));
    document.head.append(s);
  });
}

export function wireDevices(root, after) {
  wireConnectForm(root, after);
  $("#tryBorrow", root)?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    const name = await borrowToken();
    if (name) { toast(`Connected using ${name}'s token.`); after?.(); }
    else { e.target.disabled = false; toast("That token can't see quit-vaping-data yet. Add the repo to it on GitHub (step 1).", "bad"); }
  });
  $("#copyLink", root)?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pairLink()); toast("Setup link copied. Open it on your other device."); }
    catch { prompt("Copy this setup link:", pairLink()); }
  });
  $("#shareLink", root)?.addEventListener("click", () => navigator.share({ title: "Second Wind setup link", url: pairLink() }).catch(() => {}));
  $("#syncNowBtn", root)?.addEventListener("click", async () => { await syncNow(); after?.(); });
  $("#showQr", root)?.addEventListener("click", async () => {
    const box = $("#qr", root);
    try {
      const qrcode = await loadQr();
      const qr = qrcode(0, "M");
      qr.addData(pairLink());
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (err) { box.textContent = err.message; }
  });
}
