import { loadFont as loadDisplay } from "@remotion/google-fonts/ShipporiMincho";
import { loadFont as loadSans } from "@remotion/google-fonts/NotoSans";

// The app's own colours (frontend/src/styles.css) and fonts.
export const C = {
  ink: "#1e2b4a",
  night: "#141d33",
  porcelain: "#f5f6f3",
  paper: "#ffffff",
  gold: "#b8892b",
  goldInk: "#8a6514",
  goldLight: "#f3dfb2",
  celadon: "#6e9e8a",
  slate: "#5b6472",
  line: "#dfe3df",
  lacquer: "#b23a2b",
};

export const FONT_DISPLAY = loadDisplay("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily;
export const FONT_SANS = loadSans("normal", { weights: ["400", "600", "700"], subsets: ["latin", "devanagari"] }).fontFamily;

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const s = (seconds: number) => Math.round(seconds * FPS);
