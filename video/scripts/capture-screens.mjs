// Records [SCREEN] shots from the live app with headless Chrome, as real app footage:
//   node scripts/capture-screens.mjs [shot ...]      (no names: all of them)
// Each shot is a short scripted walk through the app; frames are captured as they render and
// encoded at their real timing into public/clips/<shot>.mp4. Viewing the app changes no data.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SITE = process.env.SITE ?? "https://kintsugi-ai-builder-cup-2026.web.app";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.resolve(import.meta.dirname, "..", "public", "clips");
const PORT = 9440;
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
// Google's map tiles don't draw in headless Chrome: record map shots (03b, 08b) on the phone instead.
const PHONE_MAP = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };
const LAPTOP = { width: 1500, height: 800, deviceScaleFactor: 1.28, mobile: false };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const profile = mkdtempSync(path.join(os.tmpdir(), "kintsugi-cap-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await wait(250); }
  }
  const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
    if (d.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true });
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Runtime.enable");
  return {
    send,
    close: async () => {
      ws.close();
      chrome.kill();
      await wait(1000);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still letting go of its cache */ }
    },
  };
}

/** Runs `steps` while capturing frames for `seconds`, then encodes them at their real timing. */
async function record(cdp, name, viewport, url, seconds, steps, prep) {
  const ev = (expression) => cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  if (process.env.DEBUG) console.log(name, "navigating");
  await cdp.send("Page.navigate", { url });
  if (process.env.DEBUG) console.log(name, "navigated");
  await wait(5000);
  await ev("try { localStorage.setItem('kintsugi.voiceReplies','off') } catch {}");
  if (prep) await prep(ev, cdp); // set up the screen first, unrecorded
  const dir = mkdtempSync(path.join(os.tmpdir(), `kintsugi-${name}-`));
  const frames = [];
  let stop = false;
  const grab = (async () => {
    while (!stop) {
      const t = Date.now();
      const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
      const file = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
      writeFileSync(file, Buffer.from(r.data, "base64"));
      frames.push({ file, t });
    }
  })();
  const start = Date.now();
  if (process.env.DEBUG) console.log(name, "steps");
  await steps(ev, cdp);
  if (process.env.DEBUG) console.log(name, "steps done");
  await wait(Math.max(0, seconds * 1000 - (Date.now() - start)));
  stop = true;
  await grab;
  // Encode with each frame shown for as long as it was on screen.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.t ?? f.t + 66) - f.t) / 1000).toFixed(3)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(path.join(dir, "list.txt"), list);
  mkdirSync(OUT, { recursive: true });
  const w = Math.round(viewport.width * viewport.deviceScaleFactor / 2) * 2, h = Math.round(viewport.height * viewport.deviceScaleFactor / 2) * 2;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
    "-vf", `scale=${w}:${h},fps=30`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", path.join(OUT, `${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}.mp4: ${frames.length} frames in ${((Date.now() - start) / 1000).toFixed(1)} s`);
}

const tab = (label) => `[...document.querySelectorAll('.bottom-nav button')].find(b => b.textContent.includes('${label}'))?.click()`;
const scrollBy = (sel, y) => `document.querySelector('${sel}')?.scrollBy({ top: ${y}, behavior: 'smooth' })`;
const pick = (city) => `(() => { const s = document.querySelector('.layer-toggles .city-picker select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, '${city}'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`;

// Open a sample person's item in its sheet (the demo's broken chair belongs to Priya).
const openItem = (persona, type) => async (ev, cdp) => {
  await ev(`localStorage.setItem('kintsugi.persona','${persona}')`);
  await cdp.send("Page.reload");
  await wait(5000);
  await ev(`document.querySelector('.avatar').click()`); await wait(1200);
  await ev(`[...document.querySelectorAll('.sheet button')].find(b => b.textContent.toLowerCase().includes('${type}'))?.click()`);
  await wait(2500);
};
const slowScroll = async (ev, sel, steps, px, gap) => { for (let i = 0; i < steps; i++) { await ev(scrollBy(sel, px)); await wait(gap); } };
// The demo's settled deal between Ramesh (Hindi) and Ananya (English).
const openDeal = (side) => async (ev) => {
  await ev(tab("Handovers")); await wait(1500);
  await ev(`[...document.querySelectorAll('.conn')].find(b => b.textContent.includes('Ramesh') && b.textContent.toLowerCase().includes('teak'))?.click()`);
  await wait(1500);
  if (side === "buyer") { await ev(`document.querySelectorAll('.phone-switch button')[1]?.click()`); await wait(800); }
};

const SHOTS = {
  "02d_passport": [PHONE, SITE, 11, async (ev) => { await wait(1200); await slowScroll(ev, ".sheet-body", 6, 260, 1500); }, openItem("ppl_home_priya", "chair")],
  "03a_takers": [PHONE, SITE, 6, async (ev) => { await wait(800); await slowScroll(ev, ".sheet-body", 3, 200, 1500); },
    async (ev, cdp) => { await openItem("ppl_home_priya", "chair")(ev, cdp); await ev(`[...document.querySelectorAll('.sheet h3')].find(h => h.textContent.includes('Who can take it'))?.scrollIntoView({ block: 'start' })`); await wait(1000); }],
  "04b_search_result": [PHONE, SITE, 8, async (ev, cdp) => {
    await ev(`document.querySelector('.search-row input').focus()`);
    for (const ch of "wooden chairs") { await cdp.send("Input.insertText", { text: ch }); await wait(90); }
    await wait(400);
    await ev(`document.querySelector('.search-row button').click()`); await wait(3500);
    await ev(`document.querySelector('.panel-body').scrollBy({ top: 420, behavior: 'smooth' })`);
  }, async (ev) => { await ev(`[...document.querySelectorAll('.mode-switch button')].find(b => b.textContent.includes('I need something'))?.click()`); await wait(1200); }],
  "05b_deal_hi": [PHONE, SITE, 26, async (ev) => { await wait(1500); await slowScroll(ev, ".panel-body", 10, 160, 2300); }, openDeal("seller")],
  "05c_deal_en": [PHONE, SITE, 26, async (ev) => { await wait(1500); await slowScroll(ev, ".panel-body", 10, 160, 2300); }, openDeal("buyer")],
  "02a_home": [PHONE, SITE, 4, async (ev) => { await wait(1500); await ev(scrollBy(".panel-body", 160)); }],
  "06a_ledger": [LAPTOP, SITE, 11, async (ev) => {
    await ev(tab("Ledger")); await wait(2500);
    await ev(`[...document.querySelectorAll('.feed-actions button')].find(b => b.textContent.includes('counted'))?.click()`); await wait(2500);
    await ev(scrollBy(".panel-body", 300)); await wait(2500);
  }],
  "06b_certificate": [LAPTOP, SITE, 1, async () => {}], // replaced below: needs the certificate URL
  "07_run_demo": [LAPTOP, SITE, 10, async (ev) => { await ev(`document.querySelector('.demo-btn').click()`); }],
  "08b_city_picker": [PHONE_MAP, SITE, 13, async (ev) => {
    await ev(tab("Map")); await wait(3000);
    for (const c of ["sg", "tyo", "jkt", "bkk"]) { if (process.env.DEBUG) console.log("city", c); await ev(pick(c)); await wait(2500); }
  }],
};

const cdp = await connect();
try {
  const wanted = process.argv.slice(2);
  for (const [name, [viewport, url, seconds, steps]] of Object.entries(SHOTS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    if (name === "06b_certificate") {
      // The certificate of the newest settled deal, in English, then Hindi, then Kannada.
      const state = await (await fetch(`${SITE}/api/state`)).json();
      console.log("state loaded");
      const deal = state.deals.filter((d) => d.status === "settled").sort((a, b) => b.created_at - a.created_at)[0];
      if (!deal) { console.log("No settled deal for 06b_certificate"); continue; }
      const cert = `${SITE}/api/certificate/${deal.id}`;
      await record(cdp, name, LAPTOP, `${cert}?lang=en`, 7, async (_ev, c) => {
        await wait(2300); await c.send("Page.navigate", { url: `${cert}?lang=hi` }); await wait(2300); await c.send("Page.navigate", { url: `${cert}?lang=kn` });
      });
      continue;
    }
    await record(cdp, name, viewport, url, seconds, steps, SHOTS[name][4]);
  }
} finally {
  await cdp.close();
}
