---
name: compleat-aktualisieren
description: Aktualisiert den Compleat-Tracker (Wolt + Uber Eats) im Macro Optimizer Frankfurt — neue Zutaten aus dem Compleat-Shop einbauen, soweit Wolt sie führt (Werte durch einzelnes Anklicken im Shop bestätigt), dauerhaft gestrichene Zutaten entfernen, gerade ausverkaufte drinlassen, Preise und Menüs nachziehen. Verwenden, wenn der User sagt „aktualisiere Compleat“, „füge neue Compleat-Zutaten hinzu“, „Compleat hat neue Zutaten/Saucen“, „gibt es Neues bei Compleat?“ oder Ähnliches.
---

# Compleat aktualisieren

Grundlage sind die Abschnitte „Compleat: Datenpipeline“, „Compleat: Befunde“ und „Bestellabläufe → Compleat“ in CLAUDE.md. Es gelten
die Datenregeln des Projekts: nur offizielle Werte, keine Schätzungen, Auffälligkeiten dokumentieren statt still korrigieren,
Entscheidungen des Users mit Datum, Antworten und Commits auf Deutsch. Keine Bestellung, nichts in einen Warenkorb, Bot-Prüfungen nie umgehen.

## 1. Bestandsaufnahme

`node compleat-crawl.js` liest den Compleat-Shop (vmos-API), die Wolt-API und die Uber-Eats-Erfassung und gibt
„── Änderungen seit … ──“ aus: neu im Shop, aus dem Shop gestrichen, neu bzw. nicht mehr bei Wolt und Uber Eats, Preise, gerade
ausverkauft. Bei Problemen schreibt er `data/compleat-raw.json` nicht und nennt den Grund:

| Meldung | Was tun |
|---|---|
| „Nicht zugeordnete Wolt-Optionen (WOLT_MAP ergänzen)“ | `WOLT_MAP` in compleat-crawl.js: Wolt-Name exakt (inkl. Wolts Leerzeichen und Anführungszeichen) → Zutat-id = `slugId` des Shop-Namens ohne Menge. Haupt-Protein → `PROTEIN_MAIN`, Nüsse/Kerne/Röstzwiebeln/Sesam/Crunch → `CRUNCH`. Unklare Zuordnung (anderer Name als im Shop) begründen und dem User nennen, nicht raten |
| „… fehlt in der Shop-Anzeige“ / „Shop zeigt …, die API ergibt …“ | Schritt 2 (Shop-Anzeige neu ablesen). Weicht eine Anzeige danach immer noch ab: dem User melden |
| „Uber-Eats-Optionen ohne Shop-Zutat“ | Schritt 3 (Uber Eats neu erfassen); bleibt eine Option ohne offizielle Werte → `UE_NO_DATA` mit Grund |
| „Halbe Portion … andere Werte je 100 g“ | prüfen; geringe Abweichung → `HALF_DIFF_OK` mit Begründung (der Rechner nutzt die Werte der ganzen Portion), sonst dem User melden |
| „Uber Eats: 2× halbe ≠ ganze“ | `UE_HALF_NOT_DOUBLE` mit Menge und Preis begründen |
| „Kuratierte id fehlt im Shop“ | Zutat gestrichen → Eintrag aus der Tabelle entfernen |
| „Doppelte Zutat-id“ | gleicher Name in zwei Gruppen mit anderen Werten je 100 g → dem User melden |

**Ausverkauft ≠ gestrichen** (User 27.09.2026), das erkennt der Crawl selbst:
- Die Shop-API liefert mit `?forceStockStatus=1` das ganze Sortiment, ohne den Parameter nur das gerade Verfügbare. Was im ersten, aber nicht im zweiten Ergebnis steht, ist **ausverkauft** (`soldOut`, bleibt drin).
- Was in keinem von beiden steht, ist **gestrichen** und fliegt raus (`_meta.removedIngredients`).
- Fehlt eine Plattform-Option, deren Shop-Zutat nur ausverkauft ist, übernimmt der Crawl sie aus dem letzten Lauf. Uber Eats blendet Ausverkauftes komplett aus.
- Fehlt eine Option, obwohl die Zutat im Shop verfügbar ist, führt die Plattform sie nicht mehr. Die Zutat bleibt im Datensatz, der `WOLT_MAP`-Eintrag bleibt stehen und greift automatisch, sobald Wolt sie wieder führt.
- Gesperrte Zutaten (`BLOCKED`, z.B. Quinoa) bleiben gesperrt.

## 2. Shop-Anzeige einzeln anklicken (neue und geänderte Zutaten — am einfachsten alle)

Im eingebauten Browser die Shop-Seite aus dem Kopf von `compleat-shop-capture.js` öffnen (Bundle „Selbst zusammenstellen“).
`node compleat-shop-capture.js` gibt ein Snippet aus. Dieses Snippet per `javascript_tool` in der Seite ausführen; es definiert `window.CAPTURE` und
`window.__compleatShopJSON`. Dann:
1. `window.__compleatShop = []; await window.CAPTURE(0, 20)`, danach `await window.CAPTURE(20, 20)` usw., bis „fertig“ zurückkommt. Mehr als 20 Karten je Aufruf überschreiten das 45-s-Limit des Werkzeugs.
2. `window.__shopExport = await window.__compleatShopJSON()` ausführen, `sha256` und `length` merken, dann `window.__shopExport.json` holen.
3. Den JSON-Text unverändert in eine Scratch-Datei schreiben, sha256 lokal prüfen (`crypto.createHash("sha256")`, muss gleich sein) und als `data/compleat-shop-anzeige.json` speichern (`_source` wie bisher davor, `JSON.stringify(…, null, 1)`).

Je Karte wählt das Snippet die Zutat (Menge 1), liest „Nutrition facts per serving“ und wählt sie über „Remove …“ wieder ab. Ausverkaufte
Karten sind gesperrt und bekommen keine Werte. Nie „Zur Bestellung hinzufügen“ klicken.

## 3. Uber Eats neu erfassen (wenn sich Shop oder Menü geändert haben)

Die Seite aus `ubereats-capture.js` öffnen, das Cookie-Banner mit „Reject“ ablehnen; eine Adresse ist nicht nötig. Erscheint eine Cloudflare- oder Bot-Prüfung:
abbrechen und den User fragen. `node ubereats-capture.js` gibt das Snippet aus, das per `javascript_tool` ausführen. `await window.UE_CAPTURE()`
liefert `{ sha256, length, options, json }` (kompakt: je Gruppe title und min/maxPermitted, je Option title, price, maxPermitted, defaultQuantity, isSoldOut und subtitle).
JSON unverändert in eine Scratch-Datei schreiben, sha256 lokal vergleichen und mit `_source` davor als `data/compleat-ubereats-menu.json` speichern.
Prüfen, ob sich nichts geändert hat: `await window.UE_CAPTURE("<capturedAt der bisherigen Datei>")`. Gleiche sha256 = unverändert, dann die Datei lassen.

## 4. Daten bauen und prüfen

`node compleat-crawl.js` → `node compleat-update.js` → `node verify-compleat.js` (Word-Export 15.09.2026; gestrichene Zutaten werden nur
gemeldet) → `node verify-compleat-presets.js` (Fertig-Bowls 16.09.2026; ein neuer Effekt wie „fehlt|<gestrichene Zutat>“ kommt mit
Kommentar in `EXPECTED`) → `node verify-compleat-shop.js` → `node tests.js`. Die Compleat-Tests auf die neuen Zahlen anpassen
(Gruppengrößen, Grundpreise, Auffälligkeiten, Anzeige-Bugs, Mengenabweichungen) und für neue Zutaten Werte und Preise prüfen. Tests nie an
den gerade ausverkauften Artikeln festmachen, das wechselt täglich.

Dabei melden und in `_meta` belassen:
- Schalentier (Allergene „Krebstiere“/„Weichtiere“) → raus.
- Koriander und Minze in den Zutaten.
- Plausibilität (`checkItem`).
- Anzeige-Bugs des Shops (Anzeige-Menge ≠ Portion).
- Mengenabweichungen Wolt ↔ Shop: es gilt die Wolt-Menge.
- Neue Fragen, z.B. eine Sperre, stellt man dem User, statt still zu entscheiden.

## 5. App, Doku, Veröffentlichung

- **App-Texte:** in index.html Hinweistext (`note`) und Fußzeile (`footer`) der beiden Compleat-Einträge prüfen: Datenstand, Grundpreis, Sonderfälle. Der Hinweis auf eine Vorauswahl entsteht automatisch über `bowlPreselectNote`.
- **Preview:** bei 375×700 prüfen. Im Compleat-Tab müssen die neuen Zutaten in Vorschlägen und „Must include“ auftauchen, die Konsole muss fehlerfrei sein.
- **CLAUDE.md:** Datenquellen-Zeile, Pipeline, Befunde (neue Zutaten mit Wolt-Preis und Werten, gestrichen, ausverkauft, Preise), Bestellabläufe, Tests und Entscheidungen (mit Datum).
- **Commit:** auf Deutsch, Nachricht per Datei (`git commit -F`), Dateien einzeln adden: compleat-crawl.js, data/compleat-raw.json, data/compleat-shop-anzeige.json, data/compleat-ubereats-menu.json, index.html, tests.js, CLAUDE.md und geänderte verify-Skripte. Danach push und live prüfen.
- **Zusammenfassung an den User** (Tabellen): neue Zutaten (Wolt-Name, Preis, kcal und Eiweiß je Portion), was raus ist, was nur ausverkauft ist, Preisänderungen, Auffälligkeiten und offene Fragen.
