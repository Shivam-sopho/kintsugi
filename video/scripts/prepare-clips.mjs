// Gets the footage ready: converts .mov/.mkv/.webm recordings in public/clips/ to 30 fps H.264 .mp4,
// and builds the scene-1 rewind (01g → 01f → 01d played backwards, fast) as public/clips/rewind.mp4.
// Run: npm run clips:prepare
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const clips = path.resolve(import.meta.dirname, "..", "public", "clips");
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

for (const f of readdirSync(clips)) {
  const ext = path.extname(f).toLowerCase();
  if (![".mov", ".mkv", ".webm", ".m4v"].includes(ext)) continue;
  const out = path.join(clips, path.basename(f, ext) + ".mp4");
  if (existsSync(out)) continue;
  console.log(`Converting ${f}`);
  ff("-i", path.join(clips, f), "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", out);
}

// The rewind: each clip reversed and sped up 4×, about 0.8 s each, joined (2.5 s in all).
const parts = ["01g_chair_landfill.mp4", "01f_drag_to_bin.mp4", "01d_chair_breaks.mp4"];
if (parts.every((p) => existsSync(path.join(clips, p)))) {
  const inputs = parts.flatMap((p) => ["-i", path.join(clips, p)]);
  const chains = parts.map((_, i) => `[${i}:v]reverse,setpts=PTS/4,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,trim=duration=0.84[v${i}]`).join(";");
  ff(...inputs, "-filter_complex", `${chains};[v0][v1][v2]concat=n=3:v=1:a=0[out]`, "-map", "[out]", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(clips, "rewind.mp4"));
  console.log("Built clips/rewind.mp4");
} else {
  console.log(`The rewind needs ${parts.join(", ")} in public/clips/ (placeholders roll backwards until then).`);
}
