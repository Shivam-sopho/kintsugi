import type { Component, Item } from "./types";

/**
 * What a person can do themselves before a part ends up burned or in landfill: general steps that
 * work anywhere in India, by material. Written here, not looked up or generated, so they are always
 * safe to follow; no organisations are named.
 */
const BY_MATERIAL: Record<string, string[]> = {
  plastic: [
    "Rinse and dry it, and give it with dry waste, not wet waste: clean, sorted plastic gets recycled.",
    "Hard plastic like buckets, chairs and crates has scrap value: ask your local kabadiwala.",
    "Look on the pack or product for a brand take-back or collection point.",
  ],
  foam: [
    "Reuse clean foam as stuffing for cushions or pet beds, or as packing.",
    "Upholsterers and mattress makers sometimes take clean foam: ask nearby.",
    "Keep it dry and away from wet waste; wet foam can only be burned.",
  ],
  textile: [
    "Cut it into cleaning cloths, bags or stuffing.",
    "Tailors and quilt makers use scraps, and clothes collection drives take clean, dry cloth.",
    "Keep it dry and separate: wet or dirty cloth can't be reused or recycled.",
  ],
  electronics: [
    "Never put it in the regular bin: it holds metals that can be recovered, and some that are harmful.",
    "Give it to an authorised e-waste collection point or a brand's take-back; many repair shops also buy working parts.",
    "Take out batteries first and keep them separate.",
  ],
  glass: [
    "Whole bottles and jars have scrap value: give them to a kabadiwala.",
    "Wrap broken glass in paper, mark it 'glass', and give it separately so no one gets hurt.",
  ],
  ceramic: [
    "Broken tiles and pots make garden edging, drainage under plants or mosaic.",
    "Builders and construction-waste collection take rubble as fill; ask your city's construction and demolition waste service.",
  ],
  brick: ["Use whole bricks again for garden beds or steps; broken ones make fill or drainage."],
  concrete: ["Builders and construction-waste collection take broken concrete as fill or for crushing into new aggregate."],
  stone: ["Stone is almost always reusable: offer it for garden paths, steps or edging."],
  wood: [
    "Carpenters use good pieces; smaller bits work for shelves, boxes or plant stands.",
    "Don't burn painted, varnished or laminated wood at home: the smoke is harmful.",
  ],
  paper: ["Keep it dry and give it to the kabadiwala: paper and cardboard are always recycled."],
  steel: ["Every kabadiwala buys metal: it should never reach landfill."],
  copper: ["Copper has high scrap value: a kabadiwala or scrap dealer will buy it."],
  aluminium: ["Aluminium has good scrap value: a kabadiwala or scrap dealer will buy it."],
  organic: ["Compost it at home, or give it with wet waste to your ward's collection: it becomes compost or biogas."],
  mixed: [
    "Take it apart if you can: most things are a mix, and the separate pieces each have a next life.",
    "Ask a kabadiwala which parts they will take; what's left is far less to throw away.",
  ],
};

const HAZARD = [
  "Don't break, cut or burn it, and keep it sealed and away from children.",
  "Only a licensed hazardous-waste handler should take it, after professional testing.",
];

const KNOWN = new Set(Object.keys(BY_MATERIAL));

/** Material names as Scout writes them, mapped to the ones above. */
function materialKey(material: string): string {
  const m = material.toLowerCase();
  if (KNOWN.has(m)) return m;
  if (/plastic|pvc|abs|poly|acrylic|nylon|laminate/.test(m)) return "plastic";
  if (/foam|sponge|rubber/.test(m)) return "foam";
  if (/fabric|cloth|textile|cotton|leather|jute/.test(m)) return "textile";
  if (/electr|circuit|wire|cable|battery|motor/.test(m)) return "electronics";
  if (/glass|mirror/.test(m)) return "glass";
  if (/tile|ceramic|porcelain/.test(m)) return "ceramic";
  if (/wood|teak|ply|mdf|bamboo/.test(m)) return "wood";
  if (/paper|card/.test(m)) return "paper";
  if (/steel|iron|metal/.test(m)) return "steel";
  if (/garden|food|organic|leaf/.test(m)) return "organic";
  return "mixed";
}

/** Whether this part, on its current route, would end up burned or in landfill. */
export function headedForLandfill(c: Component, item: Item): boolean {
  const rung = c.next_life ?? item.next_life;
  return rung === "recover_energy" || rung === "safe_disposal" || !(c.destination_id ?? item.destination_id);
}

/** What the person can do for this part before it is burned or landfilled. */
export function beforeLandfill(c: Component, item: Item): string[] {
  return item.hazards.length ? HAZARD : BY_MATERIAL[materialKey(c.material)];
}
