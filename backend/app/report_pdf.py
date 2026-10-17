"""Downloadable PDFs: the impact report (everyone, or one person) and each deal's certificate.

Built with fpdf2 and one bundled font, KintsugiSans: Noto Sans, Noto Sans Devanagari and Noto Sans
Kannada merged with fontTools (SIL Open Font License, `app/fonts/OFL.txt`), because the Indic Noto
fonts have no Latin letters and mixed lines must render in one font. Text shaping joins Hindi and
Kannada correctly. Like the API, these never include a seller's lowest
price or a buyer's highest price.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Iterable, Optional

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from .certificate import LABELS, MATERIALS, RUNGS
from .ledger import totals
from .models import Deal, Item, LedgerEntry, Participant

FONTS = Path(__file__).parent / "fonts"

INK, SLATE, LINE = (30, 43, 74), (91, 100, 114), (223, 227, 223)
GOLD, GOLD_INK, CELADON, PORCELAIN = (184, 137, 43), (138, 101, 20), (110, 158, 138), (245, 246, 243)

RUNG_ORDER = ["reuse", "repair", "upcycle", "harvest_parts", "recycle", "compost", "recover_energy", "safe_disposal"]
RUNG_EN = {"reuse": "Reuse", "repair": "Repair", "upcycle": "Upcycle", "harvest_parts": "Harvest parts",
           "recycle": "Recycle", "compost": "Compost or biogas", "recover_energy": "Recover energy",
           "safe_disposal": "Safe disposal"}
RUNG_RGB = {"reuse": (138, 101, 20), "repair": (162, 122, 34), "upcycle": (184, 137, 43),
            "harvest_parts": (94, 142, 122), "recycle": (110, 158, 138), "compost": (126, 154, 91),
            "recover_energy": (140, 147, 158), "safe_disposal": (177, 181, 188)}

# The same seven stages the app shows for every item's second life.
STAGES = ["Scanned", "Checked by a person", "Valued", "Next life chosen", "Taker found", "Handed over", "Impact recorded"]


class _Doc(FPDF):
    def __init__(self, footer_text: str):
        super().__init__(format="A4")
        self.footer_text = footer_text
        self.add_font("Noto", "", str(FONTS / "KintsugiSans-Regular.ttf"))
        self.add_font("Noto", "B", str(FONTS / "KintsugiSans-Bold.ttf"))
        self.set_text_shaping(True)
        self.set_margins(16, 16, 16)
        self.set_auto_page_break(True, margin=18)

    def footer(self) -> None:
        self.set_y(-13)
        self.set_font("Noto", "", 7.5)
        self.set_text_color(*SLATE)
        self.cell(0, 5, f"{self.footer_text}   ·   page {self.page_no()}", align="C")

    # -------------------------------------------------------------- drawing helpers

    def mark(self, x: float, y: float, size: float) -> None:
        """The Kintsugi loop: a green ring with a gold seam."""
        self.set_draw_color(*CELADON)
        self.set_line_width(size * 0.09)
        self.ellipse(x, y, size, size)
        self.set_draw_color(*GOLD)
        self.set_line_width(size * 0.05)
        cx = x + size / 2
        self.line(cx - size * 0.05, y + size * 0.18, cx + size * 0.06, y + size * 0.45)
        self.line(cx + size * 0.06, y + size * 0.45, cx - size * 0.04, y + size * 0.62)
        self.line(cx - size * 0.04, y + size * 0.62, cx + size * 0.03, y + size * 0.82)

    def brand(self, right: list[str]) -> None:
        y = self.get_y()
        self.mark(self.l_margin, y, 9)
        self.set_xy(self.l_margin + 12, y + 0.5)
        self.set_font("Noto", "B", 15)
        self.set_text_color(*INK)
        self.cell(60, 8, "Kintsugi")
        self.set_font("Noto", "", 8.5)
        self.set_text_color(*SLATE)
        for i, line in enumerate(right):
            self.set_xy(self.w - self.r_margin - 80, y + i * 4.4)
            self.cell(80, 4.4, line, align="R")
        self.set_y(y + max(12, len(right) * 4.4 + 2))

    def ribbon(self, text: str) -> None:
        self.set_font("Noto", "", 8)
        w = self.get_string_width(text) + 8
        x = (self.w - w) / 2
        self.set_fill_color(*PORCELAIN)
        self.set_draw_color(*SLATE)
        self.set_line_width(0.2)
        self.rect(x, 7, w, 5.5, style="DF", round_corners=True, corner_radius=2.7)
        self.set_text_color(*SLATE)
        self.set_xy(x, 7)
        self.cell(w, 5.5, text, align="C")

    def heading(self, text: str, size: float = 12) -> None:
        if self.get_y() > self.h - 45:
            self.add_page()
        self.ln(3)
        self.set_font("Noto", "B", size)
        self.set_text_color(*INK)
        self.cell(0, 7, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.l_margin + 18, self.get_y())
        self.ln(2.5)

    def para(self, text: str, size: float = 9.5, color=SLATE) -> None:
        self.set_font("Noto", "", size)
        self.set_text_color(*color)
        self.multi_cell(0, size * 0.52, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def stats(self, cells: list[tuple[str, str]]) -> None:
        y = self.get_y() + 1
        w = (self.w - self.l_margin - self.r_margin - 6 * (len(cells) - 1)) / len(cells)
        for i, (num, label) in enumerate(cells):
            x = self.l_margin + i * (w + 6)
            self.set_draw_color(*GOLD)
            self.set_line_width(0.9)
            self.line(x, y, x + w, y)
            self.set_xy(x, y + 2)
            self.set_font("Noto", "B", 17)
            self.set_text_color(*INK)
            self.cell(w, 9, num)
            self.set_xy(x, y + 11)
            self.set_font("Noto", "", 8.5)
            self.set_text_color(*SLATE)
            self.multi_cell(w, 4, label)
        self.set_y(y + 21)

    def rows(self, head: list[str], body: list[list[str]], widths: list[float], right: Iterable[int] = ()) -> None:
        right = set(right)
        self.set_fill_color(255, 255, 255)
        self.set_text_color(*INK)
        aligns = tuple("RIGHT" if i in right else "LEFT" for i in range(len(head)))
        self.set_font("Noto", "", 8.5)
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        with self.table(col_widths=widths, text_align=aligns, line_height=4.6, padding=1.4, borders_layout="HORIZONTAL_LINES",
                        headings_style=_heading_style(), first_row_as_headings=True) as table:
            for r in [head, *body]:
                row = table.row()
                for cell in r:
                    row.cell(cell)
        self.ln(2)


def _heading_style():
    from fpdf.fonts import FontFace
    return FontFace(family="Noto", emphasis="BOLD", color=SLATE, fill_color=PORCELAIN)


def _kg(n: float | None) -> str:
    if n is None:
        return "–"
    return f"{n:,.0f} kg" if n >= 100 else f"{n:,.1f} kg"


def _inr(n: float | None) -> str:
    return "–" if n is None else f"₹{n:,.0f}"


def _date(ts: float) -> str:
    return time.strftime("%d %b %Y", time.localtime(ts))


def _cert_number(deal: Deal) -> str:
    return f"KIN-{deal.id.split('_')[-1].upper()}"


def _weight(it: Item) -> float:
    return sum(c.est_weight_kg for c in it.components) * max(it.count, 1)


def stage_reached(it: Item, deals: list[Deal]) -> int:
    """How many of the seven stages this item has completed (the app's journey, in Python)."""
    deal = next((d for d in deals if it.id in d.item_ids and d.status != "no_deal"), None)
    finished = it.status in ("sold", "routed") or (deal is not None and deal.status == "settled")
    done = [True, it.verified, bool(it.value_max_inr) or bool(it.hazards), it.next_life is not None,
            bool(it.destination_id or any(c.destination_id for c in it.components)), bool(deal) or finished, finished]
    return len(done) if finished else next((i for i, d in enumerate(done) if not d), len(done))


# ------------------------------------------------------------------ impact report

def impact_report(items: list[Item], deals: list[Deal], entries: list[LedgerEntry], people: dict[str, Participant],
                  scope: str, factor_source: str) -> bytes:
    """Recorded impact, what's still waiting, where things went, and every item's second life."""
    synthetic = any(i.synthetic for i in items) or any(p.synthetic for p in people.values() if p.id in {d.buyer_id for d in deals})
    pdf = _Doc("Kintsugi impact report · " + ("contains sample data · " if synthetic else "") + "settlement is sandboxed")
    pdf.add_page()
    if synthetic:
        pdf.ribbon("Sample data")
    pdf.brand(["Impact report", f"Issued {_date(time.time())}", scope])

    pdf.set_font("Noto", "B", 22)
    pdf.set_text_color(*INK)
    pdf.cell(0, 12, "Impact report", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.para(f"{scope}: what was kept out of landfill, the CO2e avoided, and where each thing is on its way to a next life.")

    t = totals(entries)
    pdf.heading("Recorded impact")
    pdf.stats([(_kg(t["mass_diverted_kg"]), "kept out of landfill"), (_kg(t["co2_avoided_kg"]), "CO2e avoided"),
               (_inr(t["value_recovered_inr"]), "recovered by sellers")])
    if t["mass_total_kg"]:
        pdf.para(f"{round(t['diverted_fraction'] * 100)}% of {_kg(t['mass_total_kg'])} handled so far stayed out of landfill. "
                 "Impact is recorded only when a hand-over or deal settles.")
    else:
        pdf.para("Nothing has been handed over or sold yet, so no impact is recorded.")

    waiting = [i for i in items if i.status == "available"]
    if waiting:
        pdf.heading("Waiting for a next life")
        pdf.para(f"{len(waiting)} {'item is' if len(waiting) == 1 else 'items are'} listed, {_kg(sum(_weight(i) for i in waiting))} in all. "
                 f"When each reaches its next life, about {_kg(sum(i.co2_avoided_kg or 0 for i in waiting))} CO2e is avoided.")

    if t["by_rung_kg"]:
        pdf.heading("Where it went, by weight")
        y = pdf.get_y() + 1
        x, full = pdf.l_margin, pdf.w - pdf.l_margin - pdf.r_margin
        total = sum(t["by_rung_kg"].values()) or 1
        for r in RUNG_ORDER:
            w = full * t["by_rung_kg"].get(r, 0) / total
            if w:
                pdf.set_fill_color(*RUNG_RGB[r])
                pdf.rect(x, y, w, 6, style="F")
                x += w
        pdf.set_y(y + 9)
        pdf.rows(["Next life", "Weight", "Share"],
                 [[RUNG_EN[r], _kg(t["by_rung_kg"][r]), f"{t['by_rung_kg'][r] / total:.0%}"] for r in RUNG_ORDER if t["by_rung_kg"].get(r)],
                 [70, 40, 30], right=(1, 2))

    if items:
        pdf.heading("Each item's second life")
        pdf.para("Stages: " + ", ".join(STAGES).lower().capitalize() + ".", size=8.5)
        pdf.ln(1)
        body = []
        for it in sorted(items, key=lambda i: (-stage_reached(i, deals), i.type)):
            n = stage_reached(it, deals)
            takers = [people[d].name for d in dict.fromkeys([it.destination_id, *[c.destination_id for c in it.components]]) if d and d in people]
            stage = "Done: impact recorded" if n == len(STAGES) else f"{n} of {len(STAGES)}; next: {STAGES[n].lower()}"
            body.append([f"{it.type[:1].upper()}{it.type[1:]} × {it.count}", RUNG_EN.get(it.next_life.value, "–") if it.next_life else "–",
                         ", ".join(takers[:2]) + (f" and {len(takers) - 2} more" if len(takers) > 2 else "") or "No taker yet",
                         stage, _kg(it.co2_avoided_kg)])
        pdf.rows(["Item", "Next life", "Goes to", "Stage", "CO2e"], body, [42, 28, 50, 38, 20], right=(4,))

    settled = [d for d in deals if d.status == "settled"]
    if settled:
        pdf.heading("Hand-overs and sales")
        body = []
        for d in sorted(settled, key=lambda d: d.created_at, reverse=True):
            de = totals([e for e in entries if e.source_id == d.id])
            body.append([_cert_number(d), _date(d.created_at), people[d.buyer_id].name if d.buyer_id in people else d.buyer_id,
                         "Hand-over, free" if d.kind == "handover" else _inr(d.final_price_inr),
                         _kg(de["mass_diverted_kg"]), _kg(de["co2_avoided_kg"])])
        pdf.rows(["Certificate", "Date", "To", "Money", "Kept", "CO2e"], body, [27, 22, 55, 30, 22, 22], right=(4, 5))

    pdf.heading("Sources", size=10)
    pdf.para(f"Emission factors: {factor_source}. Every CO2e figure is the weight of each material times its factor and a "
             "credit for its next life. Prices come with their sources in the app. Settlement is a sandbox: no real money moved. "
             + ("Rows marked as sample data are illustrative." if synthetic else ""), size=8.5)
    return bytes(pdf.output())


# ------------------------------------------------------------------ certificate

def certificate(deal: Deal, entries: list[LedgerEntry], seller: Optional[Participant], buyer: Optional[Participant], lang: str) -> bytes:
    """The deal's hallmarked certificate as a PDF, in English, Hindi or Kannada."""
    lang = lang if lang in LABELS else "en"
    L = LABELS[lang]
    t = totals(entries)
    handover = deal.kind == "handover"
    sample = any(p is not None and p.synthetic for p in (seller, buyer))
    number = _cert_number(deal)
    issued = max([e.created_at for e in entries], default=deal.created_at)

    pdf = _Doc(f"{L['title']} {number}")
    pdf.add_page()
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.8)
    pdf.rect(8, 8, pdf.w - 16, pdf.h - 16)
    pdf.set_line_width(0.3)
    pdf.rect(10.5, 10.5, pdf.w - 21, pdf.h - 21)
    if sample:
        pdf.ribbon(L["sample"])
    pdf.set_y(20)
    pdf.brand([f"{L['number']} {number}", f"{L['date']} {time.strftime('%d-%m-%Y', time.localtime(issued))}", f"{L['deal']} {deal.id}"])

    pdf.ln(6)
    pdf.set_font("Noto", "B", 24)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 12, L["title"], new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.para(f"{L['from_to']}: {seller.name if seller else deal.seller_id} – {buyer.name if buyer else deal.buyer_id}", size=10.5)
    pdf.ln(4)

    # Two figures, then the gold seal with the CO2e avoided
    y = pdf.get_y()
    price = L["handed"] if handover else _inr(deal.final_price_inr)
    for i, (num, label) in enumerate(((f"{t['mass_diverted_kg']:,.0f}", L["reused"]), (price, L["handover"] if handover else L["value"]))):
        x = pdf.l_margin + i * 58
        pdf.set_draw_color(*GOLD)
        pdf.set_line_width(0.9)
        pdf.line(x, y, x + 50, y)
        pdf.set_xy(x, y + 2)
        pdf.set_font("Noto", "B", 20)
        pdf.set_text_color(*INK)
        pdf.cell(50, 10, num)
        pdf.set_xy(x, y + 13)
        pdf.set_font("Noto", "", 9)
        pdf.set_text_color(*SLATE)
        pdf.multi_cell(50, 4.5, label)
    sx, size = pdf.w - pdf.r_margin - 46, 44
    pdf.set_draw_color(*GOLD)
    pdf.set_fill_color(253, 248, 236)
    pdf.set_line_width(1.2)
    pdf.ellipse(sx, y - 6, size, size, style="DF")
    pdf.set_line_width(0.3)
    pdf.ellipse(sx + 3, y - 3, size - 6, size - 6)
    pdf.set_xy(sx, y + 6)
    pdf.set_font("Noto", "B", 17)
    pdf.set_text_color(*GOLD_INK)
    pdf.cell(size, 8, f"{t['co2_avoided_kg']:,.1f}", align="C")
    pdf.set_xy(sx + 4, y + 15)
    pdf.set_font("Noto", "", 7.5)
    pdf.multi_cell(size - 8, 3.6, L["co2"], align="C")
    pdf.set_y(y + 44)

    def rung(r: str) -> str:
        return RUNGS.get(lang, {}).get(r, RUNG_EN.get(r, r))

    def mat(m: str) -> str:
        return MATERIALS.get(lang, {}).get(m, m.capitalize())

    pdf.rows([L["material"], L["next"], L["kg"], L["factor"], L["avoided"]],
             [[mat(e.material), rung(e.rung.value), f"{e.mass_kg:,.1f}", f"{e.factor_kg_per_kg}", f"{e.co2_avoided_kg:,.1f}"] for e in entries],
             [38, 46, 22, 36, 36], right=(2, 3, 4))

    pdf.ln(4)
    y = pdf.get_y()
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.2)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.mark(pdf.l_margin, y + 4, 9)
    pdf.set_xy(pdf.l_margin + 13, y + 3)
    pdf.set_font("Noto", "", 8.5)
    pdf.set_text_color(*SLATE)
    # One script per line: shaping a Hindi or Kannada run that follows English breaks its joins.
    pdf.multi_cell(0, 4.4, f"{L['hallmark']} {L['settlement']}: {L['handover'] if handover else L['sandbox']}.",
                   new_x=XPos.LEFT, new_y=YPos.NEXT)
    pdf.multi_cell(0, 4.4, f"{L['factors']}: {t['factor_source']}.")
    return bytes(pdf.output())
