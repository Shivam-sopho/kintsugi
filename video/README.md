# Kintsugi demo video (Remotion)

## The published video: `Cut`

The video on YouTube (https://www.youtube.com/watch?v=DXN9g5Fb7hI) is the `Cut` composition: the narrated opening (the problem, the chair, Kintsugi and the Gemini models), the short intro, then the screen recordings of the live app, trimmed to the narration, sped up 1.25×, with camera zooms, step labels and captions.

```bash
npm run render:cut      # → out/kintsugi-cut.mp4
npm run thumbnail       # → out/thumbnail.png (YouTube thumbnail, 1280×720)
npm run readme-hero     # → ../docs/hero.png (the README image)
npm run captions:rec    # word timings for the recordings, for the captions
```

- Every trim, speed and camera move is in `src/cut/edl.ts`; the scenes are in `src/cut/Cut.tsx`.
- The recordings go in `public/rec/`, outside git: `v1`–`v3.mp4` (the demo), `v4.mp4` (the short intro), `v5.mp4` (the narration), `chair.mp4` and `problem.png`. Re-encode a new recording with a keyframe every second (`ffmpeg -i in.mp4 -r 30 -c:v libx264 -crf 18 -g 30 -c:a aac out.mp4`) so seeking stays fast.

## The scripted video: `Main`

The first plan, the 3:00 video from [`docs/video/script.md`](../docs/video/script.md): 1920×1080, 30 fps, eight scenes on the script's timeline, burned-in captions, in the app's colours and fonts. Every clip that isn't there yet shows as a labelled placeholder saying what to film, so the video always plays and renders.

## Commands

```bash
cd video
npm install
npm run studio          # preview and scrub in the browser (Remotion Studio)
npm run render          # → out/kintsugi.mp4 (full quality)
npx remotion render Main out/preview.mp4 --scale=0.5   # a quick half-size preview
```

Each scene is also its own composition (in Studio, under Scenes) to work on one at a time.

## What goes where

| File | Where | What |
|---|---|---|
| Clips from the shot list | `public/clips/<name>.mp4` | Exactly the names in the script's shot list (`01a_landfill_aerial.mp4` …). `.mov`, `.mkv` and `.webm` are converted by `npm run clips:prepare` |
| Voiceover | `public/voiceover.wav` | The whole voiceover, one file, starting at 0:00 |
| Sound effects | `public/audio/sfx_crack.wav`, `public/audio/sfx_rewind.wav` | Optional |
| Music | `public/audio/music.mp3` | Optional; plays quietly under the voice, silent while the chair breaks |

Footage and audio are kept out of git (they're large); share them separately.

## After adding footage or the voiceover

```bash
npm run clips:prepare   # converts recordings to .mp4 and builds the scene-1 rewind (01g → 01f → 01d, backwards, fast)
npm run captions:voice  # times the captions to public/voiceover.wav with whisper.cpp (first run builds it: needs Xcode's command-line tools)
```

Until the voiceover is transcribed, captions follow the script's timings (`src/data/voiceover.ts`). After transcription, the captions, and the architecture diagram in scene 7 (each Gemini model lights up on its word), follow the real recording.

## Things to set after recording

- `src/scenes/S1Planet.tsx` → `FREEZE_01D_SEC`: the second in `01d_chair_breaks.mp4` where the chair is broken and still (the rewind freezes there).
- `src/scenes/S5Deal.tsx` → `GUARDRAIL`: where the "limit held" note is in `05b_deal_hi.mp4` (fraction from the top) and when it shows.
- `src/data/voiceover.ts` → `SUBTITLES`: the real Hindi agent line in scene 5 and its English subtitle.
- `src/clips.ts` → set `ai: true` on `01a_landfill_aerial.mp4` if it's AI-generated (it then gets the "AI-generated" label; `01g` always has it).
- If the scan's result is "harvest parts" rather than reuse or repair, change the line in `src/data/voiceover.ts` (the script gives the alternative).

## Screen recordings from the live site

`node scripts/capture-screens.mjs [shot …]` records some [SCREEN] shots from the live app with headless Chrome (viewing only, no data changes): `02a_home`, `06a_ledger`, `06b_certificate`, `07_run_demo`. Google's map tiles don't draw in headless Chrome, so record the map shots (`03b_map_zoom`, `08b_city_picker`) on the phone with scrcpy, like the rest.
