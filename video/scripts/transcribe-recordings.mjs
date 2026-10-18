// Word timings for the screen recordings: public/rec/v<n>.mp4 → public/rec/v<n>.words.json
// (whisper.cpp). The cut (src/cut/) places each word on the final timeline. Run: npm run captions:rec
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";

const root = path.resolve(import.meta.dirname, "..");
const whisperPath = path.join(root, "whisper.cpp");
const version = "1.5.5";
const model = process.env.WHISPER_MODEL ?? "small.en";
await installWhisperCpp({ to: whisperPath, version });
await downloadWhisperModel({ model, folder: whisperPath });

for (const n of (process.argv.slice(2).length ? process.argv.slice(2) : [1, 2, 3, 4, 5, "intro"])) {
  const input = path.join(root, "public", "rec", `v${n}.mp4`);
  if (!existsSync(input)) continue;
  const wav = path.join(root, "out", `v${n}-16k.wav`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  const output = await transcribe({ inputPath: wav, whisperPath, whisperCppVersion: version, model, tokenLevelTimestamps: true, language: "en", printOutput: false });
  const { captions } = toCaptions({ whisperCppOutput: output });
  writeFileSync(path.join(root, "public", "rec", `v${n}.words.json`), JSON.stringify(captions));
  console.log(`v${n}: ${captions.length} words`);
}
