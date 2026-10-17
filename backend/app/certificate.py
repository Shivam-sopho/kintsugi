"""Printable impact certificate in the reader's language (browser Print → PDF).

Hindi and Kannada strings were written without a native-speaker review: have one checked
before the demo (see NEXT_STEPS.md).
"""

from __future__ import annotations

import time
from html import escape

from .ledger import totals
from .models import Deal, LedgerEntry, Participant

LABELS = {
    "en": {
        "title": "Kintsugi impact certificate", "reused": "kg kept in use", "co2": "kg CO2e avoided",
        "material": "Material", "next": "Next life", "kg": "kg", "factor": "kg CO2e per kg", "avoided": "kg CO2e avoided",
        "factors": "Emission factors", "settlement": "Settlement", "deal": "Deal",
        "sandbox": "SANDBOX: no real money moved",
        "number": "Certificate", "date": "Issued", "value": "agreed value", "from_to": "From seller to buyer",
        "seal": "Kintsugi Ledger · recorded impact · ", "hallmark": "Recorded by the Kintsugi Ledger from this deal's settled items.",
        "sample": "Sample data", "print": "Print or save as PDF",
        "handover": "Hand-over: no money involved", "handed": "handed over",
    },
    "hi": {
        "title": "किंत्सुगी प्रभाव प्रमाणपत्र", "reused": "किलो सामान फिर से इस्तेमाल में", "co2": "किलो CO2e की बचत",
        "material": "सामग्री", "next": "अगला जीवन", "kg": "किलो", "factor": "kg CO2e प्रति किलो", "avoided": "बचा CO2e (किलो)",
        "factors": "उत्सर्जन कारक", "settlement": "भुगतान", "deal": "सौदा",
        "sandbox": "सैंडबॉक्स: कोई असली पैसा नहीं गया",
        "number": "प्रमाणपत्र", "date": "जारी", "value": "तय कीमत", "from_to": "विक्रेता से खरीदार तक",
        "seal": "किंत्सुगी लेजर · दर्ज प्रभाव · ", "hallmark": "इस सौदे की निपटाई गई चीज़ों से किंत्सुगी लेजर द्वारा दर्ज।",
        "sample": "नमूना डेटा", "print": "प्रिंट करें या PDF सहेजें",
        "handover": "सौंपना: कोई पैसा नहीं", "handed": "सौंपा गया",
    },
    "kn": {
        "title": "ಕಿಂತ್ಸುಗಿ ಪರಿಣಾಮ ಪ್ರಮಾಣಪತ್ರ", "reused": "ಕೆಜಿ ಮತ್ತೆ ಬಳಕೆಗೆ", "co2": "ಕೆಜಿ CO2e ಉಳಿತಾಯ",
        "material": "ವಸ್ತು", "next": "ಮುಂದಿನ ಬಳಕೆ", "kg": "ಕೆಜಿ", "factor": "ಪ್ರತಿ ಕೆಜಿಗೆ kg CO2e", "avoided": "ಉಳಿಸಿದ CO2e (ಕೆಜಿ)",
        "factors": "ಹೊರಸೂಸುವಿಕೆ ಅಂಶಗಳು", "settlement": "ಪಾವತಿ", "deal": "ವ್ಯವಹಾರ",
        "sandbox": "ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್: ನಿಜವಾದ ಹಣ ವರ್ಗಾವಣೆ ಆಗಿಲ್ಲ",
        "number": "ಪ್ರಮಾಣಪತ್ರ", "date": "ನೀಡಿದ ದಿನಾಂಕ", "value": "ಒಪ್ಪಿದ ಬೆಲೆ", "from_to": "ಮಾರಾಟಗಾರರಿಂದ ಖರೀದಿದಾರರಿಗೆ",
        "seal": "ಕಿಂತ್ಸುಗಿ ಲೆಡ್ಜರ್ · ದಾಖಲಾದ ಪರಿಣಾಮ · ", "hallmark": "ಈ ವ್ಯವಹಾರದ ಇತ್ಯರ್ಥವಾದ ವಸ್ತುಗಳಿಂದ ಕಿಂತ್ಸುಗಿ ಲೆಡ್ಜರ್ ದಾಖಲಿಸಿದೆ.",
        "sample": "ಮಾದರಿ ಡೇಟಾ", "print": "ಮುದ್ರಿಸಿ ಅಥವಾ PDF ಆಗಿ ಉಳಿಸಿ",
        "handover": "ಹಸ್ತಾಂತರ: ಹಣ ಇಲ್ಲ", "handed": "ಹಸ್ತಾಂತರಿಸಲಾಗಿದೆ",
    },
}

RUNGS = {
    "hi": {"reuse": "फिर से इस्तेमाल", "repair": "मरम्मत", "upcycle": "अपसाइक्लिंग", "harvest_parts": "पुर्ज़े निकालना",
           "recycle": "रीसाइक्लिंग", "compost": "खाद या बायोगैस", "recover_energy": "ऊर्जा प्राप्ति", "safe_disposal": "सुरक्षित निपटान"},
    "kn": {"reuse": "ಮರುಬಳಕೆ", "repair": "ದುರಸ್ತಿ", "upcycle": "ಅಪ್‌ಸೈಕ್ಲಿಂಗ್", "harvest_parts": "ಭಾಗಗಳ ಮರುಪಡೆಯುವಿಕೆ",
           "recycle": "ಮರುಸಂಸ್ಕರಣೆ", "compost": "ಗೊಬ್ಬರ ಅಥವಾ ಬಯೋಗ್ಯಾಸ್", "recover_energy": "ಶಕ್ತಿ ಮರುಪಡೆಯುವಿಕೆ", "safe_disposal": "ಸುರಕ್ಷಿತ ವಿಲೇವಾರಿ"},
}

MATERIALS = {
    "hi": {"wood": "लकड़ी", "steel": "स्टील", "copper": "तांबा", "aluminium": "एल्युमिनियम", "glass": "काँच",
           "ceramic": "सिरेमिक", "plastic": "प्लास्टिक", "textile": "कपड़ा", "foam": "फ़ोम", "paper": "कागज़", "organic": "जैविक कचरा", "electronics": "इलेक्ट्रॉनिक्स"},
    "kn": {"wood": "ಮರ", "steel": "ಉಕ್ಕು", "copper": "ತಾಮ್ರ", "aluminium": "ಅಲ್ಯೂಮಿನಿಯಂ", "glass": "ಗಾಜು",
           "ceramic": "ಸೆರಾಮಿಕ್", "plastic": "ಪ್ಲಾಸ್ಟಿಕ್", "textile": "ಬಟ್ಟೆ", "foam": "ಫೋಮ್", "paper": "ಕಾಗದ", "organic": "ಜೈವಿಕ ತ್ಯಾಜ್ಯ", "electronics": "ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್"},
}


def render(deal: Deal, entries: list[LedgerEntry], seller: Participant | None, buyer: Participant | None, lang: str) -> str:
    lang = lang if lang in LABELS else "en"
    L = LABELS[lang]
    t = totals(entries)

    def rung(r: str) -> str:
        return RUNGS.get(lang, {}).get(r, r.replace("_", " ").capitalize())

    def mat(m: str) -> str:
        return MATERIALS.get(lang, {}).get(m, m.capitalize())

    rows = "".join(
        f"<tr><td>{escape(mat(e.material))}</td><td>{escape(rung(e.rung.value))}</td><td class=num>{e.mass_kg:,.1f}</td>"
        f"<td class=num>{e.factor_kg_per_kg}</td><td class=num>{e.co2_avoided_kg:,.1f}</td></tr>"
        for e in entries
    )
    issued = max([e.created_at for e in entries], default=deal.created_at)
    number = f"KIN-{deal.id.split('_')[-1].upper()}"
    sample = any(p is not None and p.synthetic for p in (seller, buyer))
    names = f"{escape(seller.name if seller else deal.seller_id)} → {escape(buyer.name if buyer else deal.buyer_id)}"
    switch = " ".join(
        f'<a href="?lang={code}"{" aria-current=page" if code == lang else ""}>{label}</a>'
        for code, label in (("en", "English"), ("hi", "हिन्दी"), ("kn", "ಕನ್ನಡ"))
    )
    handover = deal.kind == "handover"
    price = L["handed"] if handover else (f"₹{deal.final_price_inr:,.0f}" if deal.final_price_inr else "–")
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{L['title']} {number}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Noto+Serif+Devanagari:wght@400;600&family=Noto+Serif+Kannada:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{{--ink:#1e2b4a;--gold:#b8892b;--gold-ink:#8a6514;--celadon:#6e9e8a;--slate:#5b6472;--porcelain:#f5f6f3;--line:#dfe3df}}
@page{{size:A4;margin:12mm}}
body{{font-family:"Noto Serif","Noto Serif Devanagari","Noto Serif Kannada",Georgia,serif;color:var(--ink);background:var(--porcelain);margin:0;padding:24px 12px}}
.cert{{max-width:760px;margin:0 auto;background:#fff;border:2px solid var(--gold);outline:6px double var(--gold);outline-offset:-14px;padding:44px 48px;position:relative}}
.top{{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}}
.brand{{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;letter-spacing:.02em}}
.meta{{text-align:right;font-size:13px;color:var(--slate);line-height:1.6}}.meta b{{color:var(--ink)}}
h1{{font-size:30px;font-weight:600;margin:28px 0 6px}}
.parties{{color:var(--slate);margin:0 0 24px}}
.hero{{display:grid;grid-template-columns:1fr 1fr 170px;gap:16px;align-items:center;margin:8px 0 28px}}
.stat{{border-top:3px solid var(--gold);padding-top:8px}}.stat .n{{font-size:34px;font-weight:700;line-height:1.1}}.stat .l{{font-size:13px;color:var(--slate)}}
.seal{{width:170px;height:170px}}
table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{border-bottom:1px solid var(--line);padding:7px 6px;text-align:left}}th{{color:var(--slate);font-weight:600}}
td.num,th.num{{text-align:right;font-variant-numeric:tabular-nums}}
.hallmark{{display:flex;gap:12px;align-items:center;margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:13px;color:var(--slate)}}
.ribbon{{position:absolute;top:18px;left:50%;transform:translateX(-50%);background:var(--porcelain);border:1px solid var(--slate);color:var(--slate);border-radius:999px;padding:2px 12px;font-size:12px}}
.tools{{max-width:760px;margin:0 auto 12px;display:flex;justify-content:space-between;font-size:14px}}
.tools a,.tools button{{color:var(--gold-ink);margin-left:10px;background:none;border:0;font:inherit;cursor:pointer;text-decoration:underline}}
.tools a[aria-current]{{font-weight:600;text-decoration:none}}
@media (max-width:640px){{.cert{{padding:32px 22px}}.hero{{grid-template-columns:1fr 1fr}}.seal{{grid-column:1/-1;justify-self:center}}h1{{font-size:24px}}}}
@media print{{body{{background:#fff;padding:0}}.tools{{display:none}}.cert{{max-width:none}}}}
</style></head><body>
<div class="tools"><span>{switch}</span><button onclick="print()">{L['print']}</button></div>
<main class="cert">
{f'<span class="ribbon">{L["sample"]}</span>' if sample else ''}
<div class="top">
  <div class="brand">{_mark(34)}Kintsugi</div>
  <div class="meta">{L['number']} <b>{number}</b><br>{L['date']} <b>{time.strftime('%d-%m-%Y', time.localtime(issued))}</b><br>{L['deal']} {escape(deal.id)}</div>
</div>
<h1>{L['title']}</h1>
<p class="parties">{L['from_to']}: {names}</p>
<section class="hero">
  <div class="stat"><div class="n">{t['mass_diverted_kg']:,.0f}</div><div class="l">{L['reused']}</div></div>
  <div class="stat"><div class="n">{price}</div><div class="l">{L['handover'] if handover else L['value']}</div></div>
  {_seal(t['co2_avoided_kg'], L['co2'], L['seal'], latin=lang == 'en')}
</section>
<table><tr><th>{L['material']}</th><th>{L['next']}</th><th class="num">{L['kg']}</th><th class="num">{L['factor']}</th><th class="num">{L['avoided']}</th></tr>{rows}</table>
<div class="hallmark">{_mark(28)}<span>{L['hallmark']} {L['factors']}: {escape(t['factor_source'])}. {L['settlement']}: {L['handover'] if handover else L['sandbox']}.</span></div>
</main></body></html>"""


_LOOP = ('<path d="M26.4 10.2A14 14 0 0 1 37.7 26.9M34.7 33.0A14 14 0 0 1 14.6 34.4M10.8 28.8A14 14 0 0 1 19.7 10.7" '
         'fill="none" stroke="#6e9e8a" stroke-width="4" stroke-linecap="round"/>'
         '<path d="M42.1 27.8L36.6 32.3L33.3 26.0z M11.6 37.7L10.5 30.7L17.6 31.1z M18.3 6.4L24.9 9.0L21.1 15.0z" fill="#6e9e8a"/>'
         '<path d="M23.4 12.5 21.6 17.8l3.4 3.6-2.3 4.4 1.9 3.2" fill="none" stroke="#b8892b" stroke-width="1.8" '
         'stroke-linecap="round" stroke-linejoin="round"/>')


def _mark(size: int) -> str:
    """The Kintsugi mark (green recycling loop with a gold seam), as in the app."""
    return f'<svg viewBox="0 0 48 48" width="{size}" height="{size}" aria-hidden="true">{_LOOP}</svg>'


def _seal(co2_kg: float, label: str, ring: str, latin: bool = True) -> str:
    """A gold hallmark seal: the CO2e avoided in the middle, the ledger's name around the edge."""
    # Latin text is spread evenly round the ring; Devanagari and Kannada keep natural spacing so
    # their letters stay joined.
    text = escape(ring * 2) if latin else escape(ring)
    fit = 'letter-spacing="1"' if latin else ""
    length = 'textLength="480"' if latin else ""
    return f"""<svg class="seal" viewBox="0 0 200 200" role="img" aria-label="{co2_kg:,.0f} {escape(label)}">
<defs><path id="ring" d="M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0"/></defs>
<circle cx="100" cy="100" r="96" fill="#fbf6ea" stroke="#b8892b" stroke-width="3"/>
<circle cx="100" cy="100" r="66" fill="none" stroke="#b8892b" stroke-width="1.5"/>
<text font-size="12.5" fill="#8a6514" {fit}><textPath href="#ring" {length}>{text}</textPath></text>
<g transform="translate(82 40) scale(0.75)">{_LOOP}</g>
<text x="100" y="120" text-anchor="middle" font-size="34" font-weight="700" fill="#1e2b4a">{co2_kg:,.0f}</text>
<text x="100" y="141" text-anchor="middle" font-size="11.5" fill="#5b6472">{escape(label)}</text>
</svg>"""
