# Subway Deutschland: offizielle Nährwertinformation (PDF) → Textdatei für den Crawl (Python, pdfplumber)
#   py -3 subway-pdf.py "<Nährwert-PDF>"
# Schreibt data/subway-naehrwerte.txt: Seitentext, eine Zeile je Produkt (Name, Serviergröße, 9 Werte pro Portion, „100“, 9 Werte pro 100 g).
# Quelle: „Germany Nutritional Information Full Menu C4 2026“ (Nährwertinformationen September 2026, vom User bereitgestellt am 16.09.2026).
# Die PDF setzt Umlaute teils zerlegt (u + U+0308) → Text wird auf NFC normalisiert.
import os, sys, unicodedata
import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 2:
    sys.exit('Aufruf: py -3 subway-pdf.py "<Nährwert-PDF>"')
pdf_path = sys.argv[1]

with pdfplumber.open(pdf_path) as pdf:
    meta = pdf.metadata or {}
    pages = ["=== SEITE %d ===\n%s" % (i + 1, unicodedata.normalize("NFC", p.extract_text() or "")) for i, p in enumerate(pdf.pages)]
with open(os.path.join(HERE, "data", "subway-naehrwerte.txt"), "w", encoding="utf-8", newline="\n") as f:
    f.write("# Quelle: " + os.path.basename(pdf_path) + " (Subway Deutschland, Nährwertinformationen September 2026, PDF erstellt "
            + str(meta.get("CreationDate", "?")) + ") — erzeugt mit subway-pdf.py\n")
    f.write("\n".join(pages) + "\n")
print("subway-naehrwerte.txt: %d Seiten" % len(pages))
