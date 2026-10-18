"""Generates the video's AI shots with Veo on Vertex AI (labelled "AI-generated" in the video).

Run with the backend's Python (it has google-genai and the project's credentials):
    ../backend/.venv/bin/python scripts/veo.py [01a 01g 01b]        (no names: all)
    REFERENCE=photo.jpg ../backend/.venv/bin/python scripts/veo.py 01g   (start from a photo of your chair)

Each clip is written to Cloud Storage, then downloaded to public/clips/<file>.mp4.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

from google import genai
from google.genai import types

PROJECT = os.environ.get("GCP_PROJECT", "kintsugi-ai-builder-cup-2026")
BUCKET = os.environ.get("GCS_BUCKET", "kintsugi-ai-builder-cup-2026-kintsugi-uploads")
MODEL = os.environ.get("VEO_MODEL", "veo-3.1-generate-001")
CLIPS = Path(__file__).resolve().parent.parent / "public" / "clips"

NEGATIVE = "text, captions, subtitles, watermark, logos, brand names, cartoon, illustration, distorted faces"

SHOTS = {
    "01a": ("01a_landfill_aerial.mp4", 6,
            "Cinematic drone shot slowly rising over a vast open landfill at dusk, garbage trucks unloading, "
            "haze and smoke, birds circling, muted colours, realistic, 4K."),
    "01g": ("01g_chair_landfill.mp4", 6,
            "A single old wooden dining chair with one broken leg falls and tumbles onto a huge mountain of mixed "
            "rubbish in a landfill. The camera slowly pulls up and away until the chair is lost among the waste. "
            "Overcast light, realistic, cinematic, shallow depth of field."),
    "01b": ("01b_street_dump.mp4", 4,
            "Steady street-level shot of a quiet residential lane in Bengaluru, India, in the early evening: an old "
            "broken sofa, a wooden cupboard and a pile of construction rubble dumped beside a compound wall near a "
            "garbage point, an auto-rickshaw passing far in the background. Realistic, natural colours, documentary style."),
}


def remove_black_bars(path: Path) -> None:
    """Veo sometimes letterboxes its output inside the 16:9 frame: crop to the picture, fill 1920×1080."""
    probe = subprocess.run(["ffmpeg", "-i", str(path), "-vf", "cropdetect=limit=0.1:round=2:reset=0", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    crops = [line.split("crop=")[-1].strip() for line in probe.splitlines() if "crop=" in line]
    if not crops:
        return
    w, h, x, y = (int(v) for v in crops[-1].split(":"))
    if h >= 1070:
        return  # no bars
    cw = round(h * 16 / 9 / 2) * 2
    tmp = path.with_suffix(".tmp.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-vf",
                    f"crop={cw}:{h}:{x + (w - cw) // 2}:{y},scale=1920:1080:flags=lanczos",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-an", str(tmp)], check=True)
    tmp.replace(path)


def main() -> None:
    wanted = sys.argv[1:] or list(SHOTS)
    client = genai.Client(vertexai=True, project=PROJECT, location="us-central1")
    reference = os.environ.get("REFERENCE")
    stamp = time.strftime("%Y%m%d-%H%M%S")
    ops = {}
    for key in wanted:
        file, seconds, prompt = SHOTS[key]
        image = None
        if reference and key == "01g":
            data = Path(reference).read_bytes()
            image = types.Image(image_bytes=data, mime_type="image/png" if reference.endswith(".png") else "image/jpeg")
        ops[key] = client.models.generate_videos(
            model=MODEL,
            prompt=prompt,
            image=image,
            config=types.GenerateVideosConfig(
                aspect_ratio="16:9", resolution="1080p", duration_seconds=seconds, number_of_videos=1,
                generate_audio=False, negative_prompt=NEGATIVE, person_generation="allow_adult",
                output_gcs_uri=f"gs://{BUCKET}/video/veo/{stamp}/{key}/",
            ),
        )
        print(f"{key}: started ({seconds} s, {MODEL})", flush=True)

    CLIPS.mkdir(parents=True, exist_ok=True)
    while ops:
        time.sleep(15)
        for key, op in list(ops.items()):
            op = client.operations.get(op)
            if not op.done:
                ops[key] = op
                continue
            del ops[key]
            file = SHOTS[key][0]
            if op.error:
                print(f"{key}: failed: {op.error}", flush=True)
                continue
            videos = op.response.generated_videos if op.response else []
            if not videos:
                print(f"{key}: no video returned (it may have been filtered); try again or reword the prompt", flush=True)
                continue
            uri = videos[0].video.uri
            subprocess.run(["gcloud", "storage", "cp", uri, str(CLIPS / file), "--project", PROJECT], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            remove_black_bars(CLIPS / file)
            print(f"{key}: saved public/clips/{file}", flush=True)


if __name__ == "__main__":
    main()
