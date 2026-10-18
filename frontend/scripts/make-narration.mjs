// Bundles the demo's chapter voices with the site as small MP3s, so the story's narration plays at
// once from the CDN. Fetches each chapter's Gemini voice from the live API (cached there), in English
// and Hindi, and writes public/narration/<lang>-<n>.mp3 plus manifest.json (the exact words of each).
// Run after changing a chapter's words:   node scripts/make-narration.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const API = process.env.API ?? "https://kintsugi-ai-builder-cup-2026.web.app";
const root = path.resolve(import.meta.dirname, "..");
const src = readFileSync(path.join(root, "src/components/DemoStory.tsx"), "utf8");
const chapters = [...src.matchAll(/title: "([^"]+)",[\s\S]*?says: "([^"]+)"/g)].map((m) => `${m[1]}. ${m[2]}`);
const out = path.join(root, "public/narration");
const tmp = mkdtempSync(path.join(os.tmpdir(), "narration-"));
const manifest = [];

for (const [lang, translate] of [["en", false], ["hi", true]]) {
  for (const [i, text] of chapters.entries()) {
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(`${API}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang, translate }) });
      if (res.status === 200) break;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
    if (res.status !== 200) throw new Error(`No voice for ${lang} chapter ${i + 1} (${res.status})`);
    const wav = path.join(tmp, `${lang}-${i + 1}.wav`);
    writeFileSync(wav, Buffer.from(await res.arrayBuffer()));
    const file = `${lang}-${i + 1}.mp3`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-b:a", "64k", path.join(out, file)]);
    manifest.push({ lang, translate, text, spoken: decodeURIComponent(res.headers.get("X-Spoken-Text") ?? text), file });
    console.log(`${file}  ${text.slice(0, 50)}`);
  }
}
writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${manifest.length} voices and manifest.json`);
