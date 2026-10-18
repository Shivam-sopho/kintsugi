// Times the captions to the real voiceover: public/voiceover.wav → public/voiceover.captions.json
// (word timings from whisper.cpp). Run: npm run captions:voice   (WHISPER_MODEL=medium.en for more accuracy)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";

const root = path.resolve(import.meta.dirname, "..");
const input = path.join(root, "public", "voiceover.wav");
if (!existsSync(input)) {
  console.error("Put the voiceover at public/voiceover.wav first.");
  process.exit(1);
}
const whisperPath = path.join(root, "whisper.cpp");
const version = "1.5.5";
const model = process.env.WHISPER_MODEL ?? "small.en";

await installWhisperCpp({ to: whisperPath, version });
await downloadWhisperModel({ model, folder: whisperPath });

// whisper.cpp wants 16 kHz mono WAV
mkdirSync(path.join(root, "out"), { recursive: true });
const wav16 = path.join(root, "out", "voiceover-16k.wav");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav16]);

const output = await transcribe({ inputPath: wav16, whisperPath, whisperCppVersion: version, model, tokenLevelTimestamps: true, language: "en" });
const { captions } = toCaptions({ whisperCppOutput: output });
writeFileSync(path.join(root, "public", "voiceover.captions.json"), JSON.stringify(captions, null, 1));
console.log(`Wrote ${captions.length} timed words to public/voiceover.captions.json`);
