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
| „Nicht zugeordnete Wolt-Optionen“ mit gleichem Namen und neuer Menge (02.11.2026: „Hähnchen, 80 g“) + „… fehlt in der Shop-Anzeige“ mit neuer Menge im Namen | Compleat hat Portionen geändert: Schlüssel in `WOLT_MAP` anpassen (Zutat-id bleibt), Schritte 2 und 3 ausführen. Der Crawl meldet es unter „Geänderte Mengen“ (`_meta.portionChanges`). Nennt eine Plattform noch die alte Menge, rechnet ihr Tab damit und die App sagt es in der Config-Karte (`compleatStaleNote`) → dem User nennen |
| „… fehlt in der Shop-Anzeige“ / „… ist im Shop wählbar, wurde aber noch nie abgelesen“ / „Shop zeigt …, die API ergibt …“ | Schritt 2 (Shop-Anzeige neu ablesen). Weicht eine Anzeige danach immer noch ab: dem User melden |
| „Uber-Eats-Optionen ohne Shop-Zutat“ | Schritt 3 (Uber Eats neu erfassen); bleibt eine Option ohne offizielle Werte → `UE_NO_DATA` mit Grund |
| „Halbe Portion … andere Werte je 100 g“ | prüfen; geringe Abweichung → `HALF_DIFF_OK` mit Begründung (der Rechner nutzt die Werte der ganzen Portion), sonst dem User melden |
| „Uber Eats: 2× halbe ≠ ganze“ | `UE_HALF_NOT_DOUBLE` mit Menge und Preis begründen |
| „Kuratierte id fehlt im Shop“ | Zutat gestrichen → Eintrag aus der Tabelle entfernen |
| „Doppelte Zutat-id“ | gleicher Name in zwei Gruppen mit anderen Werten je 100 g → dem User melden |

**Ausverkauft ≠ gestrichen** (User 27.09.2026), das erkennt der Crawl selbst:
- Die Shop-API liefert mit `?forceStockStatus=1` das ganze Sortiment, ohne den Parameter nur das gerade Verfügbare. Was im ersten, aber nicht im zweiten Ergebnis steht, ist **ausverkauft** (`soldOut`, bleibt drin).
- Was in keinem von beiden steht, ist **gestrichen** und fliegt raus (`_meta.removedIngredients`).
- **Eine Zutat verschwindet nie still aus einem Tab** (User 03.11.2026): fehlt eine Plattform-Option, behält der Crawl sie mit Menge, Preis und Nährwerten vom letzten Stand (`carryNotListed`: `notListed` + `notListedSince`, `_meta.notListed`), auch wenn der Shop sie gerade anbietet — Wolt und Uber Eats blenden Ausverkauftes aus und schalten es nicht immer sofort frei. Der `WOLT_MAP`-Eintrag bleibt stehen, sobald die Plattform sie wieder führt, ist die Markierung weg. Neue Menge derselben Zutat ersetzt die alte Option.
- In der App bleiben solche Zutaten wählbar (Baukasten, Must include, Exclude); der Schalter **„Exclude unavailable ingredients“** (Default AN) lässt sie und im Shop ausverkaufte Zutaten aus den Vorschlägen. Dem User nennen, welche es gerade sind (Konsolenzeile „Gerade nicht gelistet“).
- Gesperrte Zutaten (`BLOCKED`, z.B. Quinoa) bleiben gesperrt.

## 2. Shop-Anzeige einzeln anklicken (neue und geänderte Zutaten — am einfachsten alle)

Im eingebauten Browser die Shop-Seite aus dem Kopf von `compleat-shop-capture.js` öffnen (Bundle „Selbst zusammenstellen“).
`node compleat-shop-capture.js` gibt ein Snippet aus. Dieses Snippet per `javascript_tool` in der Seite ausführen; es definiert `window.CAPTURE` und
`window.__compleatShopJSON`. Dann:
1. `window.__compleatShop = []; await window.CAPTURE(0, 20)`, danach `await window.CAPTURE(20, 20)` usw., bis „fertig“ zurückkommt. Mehr als 20 Karten je Aufruf überschreiten das 45-s-Limit des Werkzeugs.
2. `window.__shopExport = await window.__compleatShopJSON()` ausführen, `sha256` und `length` merken, dann `window.__shopExport.json` holen.
3. Den JSON-Text unverändert in eine Scratch-Datei schreiben und mit `node verify-compleat-shop.js --save <Scratch-Datei> <sha256>` übernehmen. Das Skript prüft die Prüfsumme (muss gleich sein), schreibt `data/compleat-shop-anzeige.json` und behält für heute ausverkaufte Karten die letzte frühere Ablesung als `lastRead` (sie wird weiter gegen die API geprüft).

Je Karte wählt das Snippet die Zutat (Menge 1), liest „Nutrition facts per serving“ und wählt sie über „Remove …“ wieder ab. Ausverkaufte
Karten sind gesperrt und bekommen keine Werte. Zutaten mit lauter 0-Werten (Chili Gewürz) zeigen auch ausgewählt überall „--“; das Snippet
übernimmt das nach 3 s, wenn die Karte wirklich ausgewählt ist. Nie „Zur Bestellung hinzufügen“ klicken.

Der Änderungsbericht des Crawls vergleicht mit dem letzten Lauf. Läuft der Crawl in einer Sitzung mehrmals, vor dem letzten Lauf
`git checkout HEAD -- data/compleat-raw.json` (generierte Datei), damit `_meta.lastChanges` die Änderungen seit dem veröffentlichten Stand nennt.

## 3. Uber Eats neu erfassen (wenn sich Shop oder Menü geändert haben)

Die Seite aus `ubereats-capture.js` öffnen, das Cookie-Banner mit „Reject“ ablehnen; eine Adresse ist nicht nötig. Erscheint eine Cloudflare- oder Bot-Prüfung:
abbrechen und den User fragen. `node ubereats-capture.js` gibt das Snippet aus, das per `javascript_tool` ausführen. `await window.UE_CAPTURE()`
liefert `{ sha256, length, options, json }` (kompakt: je Gruppe title und min/maxPermitted, je Option title, price, maxPermitted, defaultQuantity, isSoldOut und subtitle).
JSON unverändert in eine Scratch-Datei schreiben, sha256 lokal vergleichen und mit `_source` davor als `data/compleat-ubereats-menu.json` speichern.
Prüfen, ob sich nichts geändert hat: `await window.UE_CAPTURE("<capturedAt der bisherigen Datei>")`. Gleiche sha256 = unverändert, dann die Datei lassen.

## 3b. Wolt-Bestellfenster ansehen (User 03.11.2026: die Wolt-Mengen zählen)

Die Wolt-Seite aus dem Kopf von `compleat-crawl.js` öffnen (`WOLT_PAGE`), „Build your Bowl“ anklicken und die Texte des Fensters gegen den Wolt-Tab
vergleichen: Namen, Mengen, Preise, Dips. Nichts in den Warenkorb. Option mit neuer Menge → Schritt 1. Dips ohne Mengenangabe rechnet der Tab mit der
Shop-Portion (`_meta.portionAssumed`): dem User nennen. Wolts „Produktinfo“ im Fenster nennt für einige Optionen eigene Nährwerte (teils mit „pro 100 g“,
die Zahlen gelten aber für die Portion); der Crawl vergleicht sie automatisch (`_meta.woltProductInfo`) und bricht bei mehr als 1 kcal bzw. 0,15 g Abweichung ab.

Bei Zutaten, deren Shop-Anzeige mit einer anderen Menge rechnet (`_meta.displayBugs`: Walnusskerne, Crunch, Röstzwiebeln, Granatapfelkerne, Sojasauce), zeigt
die einzelne Karte nicht die Wolt-Menge: Fertig-Bowls mit dieser Zutat öffnen (Reiter „Nährwerte“) und mit der Shop-Rechnung vergleichen. Dem User ehrlich
sagen, was direkt abgelesen wurde und was nicht (gesperrte Karten, Plattform-Mengen nur aus der API).

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
