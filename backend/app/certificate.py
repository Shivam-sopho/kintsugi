"""Printable impact certificate in the reader's language (browser Print → PDF).

Hindi and Kannada strings were written without a native-speaker review: have one checked
before the demo (see NEXT_STEPS.md).
"""

from __future__ import annotations

from html import escape

from .ledger import totals
from .models import Deal, LedgerEntry, Participant

LABELS = {
    "en": {
        "title": "Kintsugi impact certificate", "reused": "kg kept in use", "co2": "kg CO2e avoided",
        "material": "Material", "next": "Next life", "kg": "kg", "factor": "kg CO2e per kg", "avoided": "kg CO2e avoided",
        "factors": "Emission factors", "settlement": "Settlement", "deal": "Deal",
        "sandbox": "SANDBOX: no real money moved",
    },
    "hi": {
        "title": "किंत्सुगी प्रभाव प्रमाणपत्र", "reused": "किलो सामान फिर से इस्तेमाल में", "co2": "किलो CO2e की बचत",
        "material": "सामग्री", "next": "अगला जीवन", "kg": "किलो", "factor": "kg CO2e प्रति किलो", "avoided": "बचा CO2e (किलो)",
        "factors": "उत्सर्जन कारक", "settlement": "भुगतान", "deal": "सौदा",
        "sandbox": "सैंडबॉक्स: कोई असली पैसा नहीं गया",
    },
    "kn": {
        "title": "ಕಿಂತ್ಸುಗಿ ಪರಿಣಾಮ ಪ್ರಮಾಣಪತ್ರ", "reused": "ಕೆಜಿ ಮತ್ತೆ ಬಳಕೆಗೆ", "co2": "ಕೆಜಿ CO2e ಉಳಿತಾಯ",
        "material": "ವಸ್ತು", "next": "ಮುಂದಿನ ಬಳಕೆ", "kg": "ಕೆಜಿ", "factor": "ಪ್ರತಿ ಕೆಜಿಗೆ kg CO2e", "avoided": "ಉಳಿಸಿದ CO2e (ಕೆಜಿ)",
        "factors": "ಹೊರಸೂಸುವಿಕೆ ಅಂಶಗಳು", "settlement": "ಪಾವತಿ", "deal": "ವ್ಯವಹಾರ",
        "sandbox": "ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್: ನಿಜವಾದ ಹಣ ವರ್ಗಾವಣೆ ಆಗಿಲ್ಲ",
    },
}

RUNGS = {
    "hi": {"reuse": "फिर से इस्तेमाल", "repair": "मरम्मत", "upcycle": "अपसाइक्लिंग", "harvest_parts": "पुर्ज़े निकालना",
           "recycle": "रीसाइक्लिंग", "recover_energy": "ऊर्जा प्राप्ति", "safe_disposal": "सुरक्षित निपटान"},
    "kn": {"reuse": "ಮರುಬಳಕೆ", "repair": "ದುರಸ್ತಿ", "upcycle": "ಅಪ್‌ಸೈಕ್ಲಿಂಗ್", "harvest_parts": "ಭಾಗಗಳ ಮರುಪಡೆಯುವಿಕೆ",
           "recycle": "ಮರುಸಂಸ್ಕರಣೆ", "recover_energy": "ಶಕ್ತಿ ಮರುಪಡೆಯುವಿಕೆ", "safe_disposal": "ಸುರಕ್ಷಿತ ವಿಲೇವಾರಿ"},
}

MATERIALS = {
    "hi": {"wood": "लकड़ी", "steel": "स्टील", "copper": "तांबा", "aluminium": "एल्युमिनियम", "glass": "काँच",
           "ceramic": "सिरेमिक", "plastic": "प्लास्टिक", "textile": "कपड़ा", "foam": "फ़ोम", "paper": "कागज़"},
    "kn": {"wood": "ಮರ", "steel": "ಉಕ್ಕು", "copper": "ತಾಮ್ರ", "aluminium": "ಅಲ್ಯೂಮಿನಿಯಂ", "glass": "ಗಾಜು",
           "ceramic": "ಸೆರಾಮಿಕ್", "plastic": "ಪ್ಲಾಸ್ಟಿಕ್", "textile": "ಬಟ್ಟೆ", "foam": "ಫೋಮ್", "paper": "ಕಾಗದ"},
}


def render(deal: Deal, entries: list[LedgerEntry], seller: Participant | None, buyer: Participant | None, lang: str) -> str:
    lang = lang if lang in LABELS else "en"
    L = LABELS[lang]
    t = totals(entries)

    def rung(r: str) -> str:
        return RUNGS.get(lang, {}).get(r, r.replace("_", " "))

    def mat(m: str) -> str:
        return MATERIALS.get(lang, {}).get(m, m)

    rows = "".join(
        f"<tr><td>{escape(mat(e.material))}</td><td>{escape(rung(e.rung.value))}</td><td>{e.mass_kg:,.1f}</td>"
        f"<td>{e.factor_kg_per_kg}</td><td>{e.co2_avoided_kg:,.1f}</td></tr>"
        for e in entries
    )
    names = f"{escape(seller.name if seller else deal.seller_id)} → {escape(buyer.name if buyer else deal.buyer_id)}"
    switch = " ".join(
        f'<a href="?lang={code}"{" aria-current=page" if code == lang else ""}>{label}</a>'
        for code, label in (("en", "English"), ("hi", "हिन्दी"), ("kn", "ಕನ್ನಡ"))
    )
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{L['title']}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600&family=Noto+Serif+Devanagari&family=Noto+Serif+Kannada&display=swap" rel="stylesheet">
<style>body{{font-family:"Noto Serif","Noto Serif Devanagari","Noto Serif Kannada",Georgia,serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1e2b4a}}
h1{{font-weight:600}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ccc;padding:6px;text-align:left}}
.big{{font-size:26px}}.note{{color:#5b6472;font-size:13px}}.lang{{float:right;font-size:14px}}.lang a{{margin-left:8px;color:#8a6514}}
.lang a[aria-current]{{font-weight:600;text-decoration:none}}@media print{{.lang{{display:none}}}}</style></head><body>
<nav class="lang">{switch}</nav>
<h1>{L['title']}</h1>
<p>{names}. {L['deal']} {escape(deal.id)}</p>
<p class="big">{t['mass_diverted_kg']:,.0f} {L['reused']}. {t['co2_avoided_kg']:,.0f} {L['co2']}.</p>
<table><tr><th>{L['material']}</th><th>{L['next']}</th><th>{L['kg']}</th><th>{L['factor']}</th><th>{L['avoided']}</th></tr>{rows}</table>
<p class="note">{L['factors']}: {escape(t['factor_source'])}. {L['settlement']}: {L['sandbox']}.</p>
</body></html>"""
