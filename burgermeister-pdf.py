# Burgermeister: offizielle Nährwerttabelle (PDF) → Textdatei für den Crawl (Python, pdfplumber)
#   py -3 -I burgermeister-pdf.py "<Nährwert-PDF>"
# Schreibt data/burgermeister-naehrwerte.txt: Seitentext, je Produkt eine Namenszeile und eine Zahlenzeile (ggf. mit Zusatz in Klammern
# davor, z.B. „(PRO STÜCK)“) mit 7 Werten: kcal, Eiweiß, Fett, Kohlenhydrate, davon Zucker, Ballaststoffe, Salz.
# Quelle: „Burgermeister-Nutrition-Facts-2026_DE.pdf“ (Nährwerttabelle, Stand August 2026; vom User bereitgestellt am 20.10.2026,
# verlinkt auf burgermeister.com/menu/). Gesättigte Fettsäuren nennt die Tabelle nicht.
# Die Reihenfolge der Spalten wird über die x-Position der Kopfzeile geprüft (die Kopfzeile steht im Text verschachtelt über drei Zeilen).
import os, sys, unicodedata
import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 2:
    sys.exit('Aufruf: py -3 -I burgermeister-pdf.py "<Nährwert-PDF>"')
pdf_path = sys.argv[1]
HEAD = ["ENERGIE", "EIWEISS", "FETT", "KOHLEN-", "DAVON", "BALLAST-", "SALZ"]   # erwartete Reihenfolge von links nach rechts

with pdfplumber.open(pdf_path) as pdf:
    meta = pdf.metadata or {}
    pages, order = [], None
    for i, p in enumerate(pdf.pages):
        pages.append("=== SEITE %d ===\n%s" % (i + 1, unicodedata.normalize("NFC", p.extract_text() or "")))
        if i == 0:
            xs = {}
            for w in p.extract_words():
                t = unicodedata.normalize("NFC", w["text"])
                if t in HEAD and t not in xs and w["top"] < 120: xs[t] = w["x0"]
            order = sorted(xs, key=lambda t: xs[t])
if order != HEAD:
    sys.exit("Spalten der Kopfzeile nicht wie erwartet: %s" % order)
with open(os.path.join(HERE, "data", "burgermeister-naehrwerte.txt"), "w", encoding="utf-8", newline="\n") as f:
    f.write("# Quelle: " + os.path.basename(pdf_path) + " (Burgermeister, Nährwerttabelle August 2026, PDF erstellt "
            + str(meta.get("CreationDate", "?")) + ") — erzeugt mit burgermeister-pdf.py\n")
    f.write("# Spalten (über die x-Position der Kopfzeile geprüft): kcal, Eiweiß, Fett, Kohlenhydrate, davon Zucker, Ballaststoffe, Salz\n")
    f.write("\n".join(pages) + "\n")
print("burgermeister-naehrwerte.txt: %d Seite(n), Spalten %s" % (len(pages), ", ".join(order)))
