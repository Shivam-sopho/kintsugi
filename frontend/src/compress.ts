// Shrinks phone videos and photos before a scan is uploaded. Requests to Cloud Run (and through
// Firebase Hosting) are capped at 32 MB, and a minute of 1080p phone video is often 80 MB or more.
// Scout samples video at about one frame a second, so 720p at 1.5 Mbps loses nothing it needs.
// Videos use the browser's own encoder (WebCodecs) through Mediabunny, loaded only when needed.

const VIDEO_LONG_SIDE = 1280;
const VIDEO_BITRATE = 1_500_000;
const VIDEO_FRAME_RATE = 24;
const AUDIO_BITRATE = 64_000;
const MAX_VIDEO_SECONDS = 60;
const PHOTO_LONG_SIDE = 2048;
const PHOTO_QUALITY = 0.85;
const PHOTO_MIN_BYTES = 1_500_000;

/** Total size the API accepts in one scan, leaving room for the form fields. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

const baseName = (name: string) => name.replace(/\.[^.]+$/, "") || "upload";

/** Returns a smaller copy of a video or photo, or the original if it can't be made smaller here. */
export async function compressForUpload(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (file.type.startsWith("video/")) return compressVideo(file, onProgress);
  if (file.type.startsWith("image/") && file.type !== "image/gif") return compressPhoto(file);
  return file;
}

async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (typeof VideoEncoder === "undefined") return file;
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const duration = await input.computeDuration();
    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: async (track) => {
        const w = await track.getDisplayWidth();
        const h = await track.getDisplayHeight();
        const size = w >= h ? { width: Math.min(w, VIDEO_LONG_SIDE) } : { height: Math.min(h, VIDEO_LONG_SIDE) };
        return { ...size, frameRate: VIDEO_FRAME_RATE, quality: new mb.Quality({ bitrate: VIDEO_BITRATE }) };
      },
      audio: { numberOfChannels: 1, quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) },
      ...(duration > MAX_VIDEO_SECONDS ? { trim: { end: MAX_VIDEO_SECONDS } } : {}),
    });
    // Keep the original if this browser can't encode the picture or the narration.
    if (!conversion.isValid || conversion.discardedTracks.length) return file;
    if (onProgress) conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength >= file.size) return file;
    return new File([buffer], `${baseName(file.name)}.mp4`, { type: "video/mp4" });
  } catch {
    return file;
  }
}

async function compressPhoto(file: File): Promise<File> {
  if (file.size < PHOTO_MIN_BYTES || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file); // applies the photo's EXIF orientation
    const scale = Math.min(1, PHOTO_LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // for example HEIC photos the browser can't decode; the server still accepts them
  }
}

export const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
