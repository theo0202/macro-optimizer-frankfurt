# Dean & David: offizielle PDFs → Textdateien für den Crawl (Python, pdfplumber)
#   py -3 deandavid-pdf.py "<Nährwert-PDF>" "<Allergen-PDF>"
# Schreibt data/deandavid-naehrwerte.txt (Seitentext der Nährwerttabelle, eine Zeile je Produkt) und data/deandavid-allergene.json
# (Allergen-Overview: je Zeile die angekreuzten Spalten, zugeordnet über die x-Position der Kopfzeile). Quellen (Stand 16.09.2026):
#   https://deananddavid.com/wp-content/uploads/2026/09/2026-08-dd-Naehrwertuebersicht.pdf
#   https://deananddavid.com/wp-content/uploads/2026/09/2026-08-dd-Allergenliste-DE-gueltig-bis-Dezember-2026.pdf
import json, os, sys
import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 3:
    sys.exit('Aufruf: py -3 deandavid-pdf.py "<Nährwert-PDF>" "<Allergen-PDF>"')
nutri_pdf, allergen_pdf = sys.argv[1], sys.argv[2]

# 1) Nährwerttabelle: reiner Seitentext (pdfplumber hält die Zeilen zusammen)
with pdfplumber.open(nutri_pdf) as pdf:
    pages = ["=== SEITE %d ===\n%s" % (i + 1, p.extract_text() or "") for i, p in enumerate(pdf.pages)]
with open(os.path.join(HERE, "data", "deandavid-naehrwerte.txt"), "w", encoding="utf-8", newline="\n") as f:
    f.write("# Quelle: " + os.path.basename(nutri_pdf) + " (dean&david, Nährwerte Stand August 2026) — erzeugt mit deandavid-pdf.py\n")
    f.write("\n".join(pages) + "\n")

# 2) Allergen-Overview: Häkchen sind Symbolzeichen (Private Use Area); Spalte = nächste Kopfzeilen-Spalte, Zeile = nächste Produktzeile
SKIP = {"Sc", "d", "h", "i", "w", "ox", "e", "f", "el-"}  # senkrecht gesetztes „Schwefeldioxid“
rows = []
with pdfplumber.open(allergen_pdf) as pdf:
    for pi in range(1, len(pdf.pages)):
        page = pdf.pages[pi]
        words = page.extract_words()
        kr = [w for w in words if w["text"] == "Krebstiere"]
        if not kr:
            continue
        hy = kr[0]["top"]
        cols, seen = [], {}
        for w in sorted([w for w in words if abs(w["top"] - hy) < 3], key=lambda w: w["x0"]):
            t = w["text"]
            if t in SKIP:
                continue
            if t in ("Hinweis", "Kürzel"):
                seen[t] = seen.get(t, 0) + 1
                t = ("Gluten " if seen[t] == 1 else "Nüsse ") + t
            cols.append((t, (w["x0"] + w["x1"]) / 2))
        names = dict(cols)
        if "Weichtiere" in names and "Knoblauch" in names:
            cols.append(("Schwefeldioxid", (names["Weichtiere"] + names["Knoblauch"]) / 2))
        left = sorted([w for w in words if w["top"] > hy + 8 and w["x0"] < 230], key=lambda w: (round(w["top"]), w["x0"]))
        lines = []
        for w in left:
            if lines and abs(lines[-1]["top"] - w["top"]) < 2.5:
                lines[-1]["words"].append(w)
            else:
                lines.append({"top": w["top"], "words": [w]})
        for L in lines:
            L["name"] = " ".join(w["text"] for w in sorted(L["words"], key=lambda w: w["x0"]))
            L["mid"] = (L["top"] + max(w["bottom"] for w in L["words"])) / 2
            L["marks"], L["codes"] = [], []
        if not lines:
            continue
        for c in page.chars:
            if c["top"] <= hy + 8 or ord(c["text"][0]) < 0xE000:
                continue
            mid = (c["top"] + c["bottom"]) / 2
            L = min(lines, key=lambda L: abs(L["mid"] - mid))
            if abs(L["mid"] - mid) > 7:
                continue
            xm = (c["x0"] + c["x1"]) / 2
            col = min(cols, key=lambda k: abs(k[1] - xm))
            if abs(col[1] - xm) > 8:
                raise SystemExit("Häkchen ohne eindeutige Spalte: Seite %d, %s (%.1f pt daneben)" % (pi + 1, L["name"], abs(col[1] - xm)))
            L["marks"].append(col[0])
        for w in words:
            if w["top"] <= hy + 8 or w["x0"] < 230 or ord(w["text"][0]) >= 0xE000:
                continue
            mid = (w["top"] + w["bottom"]) / 2
            L = min(lines, key=lambda L: abs(L["mid"] - mid))
            if abs(L["mid"] - mid) <= 7:
                L["codes"].append(w["text"].strip(","))
        for L in lines:
            rows.append({"page": pi + 1, "name": L["name"], "marks": L["marks"], "codes": L["codes"]})

with open(os.path.join(HERE, "data", "deandavid-allergene.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump({"source": os.path.basename(allergen_pdf), "note": "Allergen-Overview (gültig für DE/AT/LU/CH bis Dezember 2026); marks = angekreuzte Spalten, codes = Kürzel (A1 = Weizen …, H3 = Walnüsse)", "rows": rows}, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("deandavid-naehrwerte.txt: %d Seiten · deandavid-allergene.json: %d Zeilen" % (len(pages), len(rows)))
