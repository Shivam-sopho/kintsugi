// Who you're using Kintsugi as. There are no accounts in this prototype: you pick one of the sample
// people, and scans, purchases and the profile follow that choice on this device.
const KEY = "kintsugi.persona";
export const DEFAULT_PERSONA = "ppl_me";

export function loadPersona(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_PERSONA;
  } catch {
    return DEFAULT_PERSONA;
  }
}

export function savePersona(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
}

/** People you can act as: the sample personas, never real businesses found on Google Maps. */
export const PERSONA_ROLES = new Set(["homeowner", "dealer", "buyer", "ngo", "repairer", "upcycler", "recycler"]);
