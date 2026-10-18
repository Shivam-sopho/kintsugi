import { useSyncExternalStore } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { DEMO_CENTER } from "./labels";

/** Where the person is: one place for the whole app (map, distances, search, scans, Ask). Every
 *  page load starts at the demo location in Bengaluru, where all the data is; sharing a location
 *  moves it until the next reload. */
export interface Where {
  lat: number;
  lng: number;
  mine: boolean; // false while it is the demo location
}

const listeners = new Set<() => void>();
const isNative = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

let current: Where = { ...DEMO_CENTER, mine: false };

export function getWhere(): Where {
  return current;
}

function set(next: Where): void {
  current = next;
  listeners.forEach((l) => l());
}

/** Back to the demo location in Bengaluru. */
export const useDemoLocation = () => set({ ...DEMO_CENTER, mine: false });

/** Re-render when the location changes. */
export function useWhere(): Where {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Why the location couldn't be found, in plain words. */
export function locationProblem(err: unknown): string {
  const { code, message = "" } = (err ?? {}) as { code?: number | string; message?: string };
  if (code === 1 || /denied|permission/i.test(message))
    return "Location is blocked for this app. Allow it in your browser's or phone's settings, then try again.";
  if (code === 2 || /disabled|unavailable|services/i.test(message))
    return "Your phone couldn't find its location. Turn on location and try again.";
  if (code === 3 || /timeout|timed out/i.test(message)) return "Finding your location took too long. Try again.";
  return "Location isn't available here.";
}

/** Ask the phone or browser where the person is. Network location is enough (homes are shown to
 *  about 500 m) and, unlike GPS, works indoors. Throws with plain words if it can't. */
export async function locateMe(): Promise<Where> {
  const options = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 };
  try {
    // In the Android app, Capacitor asks for the permission; in a browser, the browser does.
    const pos = isNative
      ? await Geolocation.getCurrentPosition(options)
      : await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("Location isn't available here."));
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, mine: true };
    set(next);
    return next;
  } catch (err) {
    throw new Error(locationProblem(err));
  }
}
