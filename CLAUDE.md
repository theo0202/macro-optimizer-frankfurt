# Macro Optimizer Frankfurt (FRA Macros)

## Projektübersicht
Standalone-PWA (eine einzige `index.html`), die Restaurant-Bestellungen in **Frankfurt am Main** auf Makro-Ziele optimiert. Zielplattform: iPhone-Homescreen („Zum Home-Bildschirm" in Safari, Titel **FRA Macros**). Aufbau, Optik und Optimizer-Logik stammen aus dem London-Tool (`C:\Users\theod\OneDrive\Desktop\Bewerbungen\HSBC SA 2026 Zeug\Essen bestellen Claude Tool\`, Repo `theo0202/macro-optimizer`), **ohne** dessen Restaurants, Waitrose, Pre-selected Meals, Corn Cakes, Ghee, Nuss-Toppings und restaurant-spezifische Sonderlogik.

Verbesserung gegenüber London: **eine Restaurant-Registry** (`RESTAURANTS`) statt `resto==="…"`-Ketten. Ein neues Restaurant = Datenblock + ein Registry-Eintrag. Tab, Config-UI, Karten, Detail-Panel, Order Guide, All/Accurate, Such-Index und Ausschluss-Liste entstehen automatisch.

Restaurants (Stand 15.09.2026): **Compleat** (Frankfurt Nordend) mit je einem Tab für **Wolt** („Build your Bowl") und **Uber Eats** („Selbst zusammenstellen"), beide auf demselben offiziellen Shop-Datensatz. Das Demo Bistro aus dem Gerüst ist entfernt.

## Deployment / Sync
- Live: **https://theo0202.github.io/macro-optimizer-frankfurt/** (Repo `theo0202/macro-optimizer-frankfurt`, public, GitHub Pages aus `main` / Root)
- Nach **jeder getesteten Änderung**: commit (Deutsch) + `git push`. Das iPhone zeigt die neue Version nach ~1 Min + App-Neustart
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (nicht im PATH), User `theo0202`. Git-Identität lokal im Repo: `theo0202 <theo0202@users.noreply.github.com>` (wie London)
- Beim Committen Dateien **explizit** adden (nicht `git add -A`): `Compleat Daten manuell in Word.docx` liegt bewusst unversioniert im Ordner (User-Arbeitsdatei, oft in Word geöffnet/gesperrt; ihr Inhalt steckt als Text in `data/compleat-word.txt`)
- Commit-Messages mit Anführungszeichen nicht per PowerShell-`-m` übergeben (PowerShell 5.1 zerlegt sie in Pfadangaben) → Nachricht in eine Datei schreiben und `git commit -F <datei>`
- London-Tool und dieses Tool laufen auf derselben Origin `theo0202.github.io` → **alle localStorage-Keys mit Präfix `fra_`**, Zugriff nur über `lsGet`/`lsSet` (tests.js prüft das statisch). Aktuell: `fra_own_order`, `fra_excluded`

## Sprache
- **UI-Strings Englisch** (wie London). Code-Kommentare, CLAUDE.md, Commit-Messages und Antworten an den User: **Deutsch (Du-Form)**
- Produktnamen exakt wie auf der Lieferplattform (nicht übersetzen), z.B. „Sojasoße , 20ml" (Wolt, mit Wolts Leerzeichen) bzw. „Sojasauce (20ml)" (Uber Eats)

## Tech Stack
- Eine `index.html` mit genau **einem attributlosen Inline-`<script>`** (tests.js findet es per Regex; die Zeichenfolge des Script-Tags darf nirgends im Code/Kommentar stehen)
- React 18.2.0 UMD via cdnjs, `const { useState, useMemo, useEffect, createElement: h } = React;`, kein JSX, kein Bundler, kein Build-Step. Render via `ReactDOM.createRoot`
- Inline-Styles; Fonts DM Sans (UI) + DM Mono (Zahlen/Labels) via Google Fonts
- Tesseract.js 5.1.1 via jsDelivr (`defer`) für den Screenshot-Import
- iPhone: `apple-mobile-web-app-capable` (+ `mobile-web-app-capable`), `black-translucent`, `viewport-fit=cover`, `padding-top: env(safe-area-inset-top)`, SVG-`apple-touch-icon` als data-URI: **rotes Quadrat (#c8102e) mit „FRA"** (London: grün mit „M"), `theme-color` #c8102e, dasselbe SVG als Favicon

## Dev-Umgebung (Windows 11)
- Git Bash + PowerShell; Python nur über `py -3` (pdfplumber, pypdf, openpyxl installiert; **kein** python-docx, **kein** pandoc); Node 24 (globales `fetch`, `performance`)
- Poppler fehlt → PDFs lassen sich nicht als Bild ansehen: Text/Tabellen mit pdfplumber lesen, eingebettete Bilder mit pypdf extrahieren
- `.docx` lesen: ist ein ZIP → `word/document.xml` per Python `zipfile` + `xml.etree` auslesen. Ist die Datei in Word geöffnet, schlägt normales Öffnen fehl („von einem anderen Prozess verwendet") → vorher kopieren mit `[System.IO.File]::Open(pfad, Open, Read, ReadWrite|Delete)`
- Zeilenenden können CRLF sein (Git `core.autocrlf=true`) → Skript-Edits müssen `\r\n` berücksichtigen (`update-lib.js` übernimmt das Zeilenende der Datei). Die Arbeitskopien sind aktuell LF
- Unsichtbare Zeichen (BOM, NBSP, kombinierende Akzente) in Regexen immer als `\u`-Escape schreiben, nie als Literal
- Lange Heredocs in Git Bash können am Parser scheitern → Hilfsskripte lieber mit dem Write-Tool ins Scratchpad schreiben und dann ausführen. Größere Umbauten von index.html/tests.js am zuverlässigsten per Patch-Skript mit eindeutigen Markern (Edit-Tool scheiterte an langen Mehrzeilen-Strings)
- Tests: `node tests.js`
- Preview: `.claude/launch.json` → „macro-optimizer-frankfurt" (`py -3 -m http.server 8421`; London läuft auf 8321). Browser-Cache: mit `?v=…` neu laden. Mobil-Ansicht mit 375×700 prüfen (375×812 wird im Pane skaliert → Klicks per Koordinate treffen daneben). Zahlenfelder lassen sich im Test-Browser nicht per Tastatur leeren → `form_input` mit leerem Wert
- Compleat-Daten neu holen: (bei Uber-Eats-Menüänderungen zuerst neu erfassen, siehe unten) → `node compleat-crawl.js` → `node compleat-update.js` → `node verify-compleat.js` → `node tests.js`
- **Uber Eats blockt Skript-Abrufe seiner API** (Cloudflare „Just a moment…"). Bot-Prüfungen/CAPTCHAs nie umgehen. Stattdessen die Produktseite normal im Browser öffnen (Cookie-Banner „Reject", keine Adresse nötig), `node ubereats-capture.js` gibt ein Snippet für die Entwicklerkonsole aus → JSON als `data/compleat-ubereats-menu.json` speichern. Die Seite enthält die Menüdaten im Script-Tag `__REACT_QUERY_STATE__` (Anführungszeichen als `\u0022`, Backslashes als `%5C`)

## Datenquellen
| Restaurant | key | Plattform | Quelle | Stand | accurate |
|---|---|---|---|---|---|
| Compleat (Wolt) | `compleat` | Wolt | offizieller Compleat-Onlineshop `compleat.vmos.io` (vmos-API, Werte pro 100 g) + Wolt-API (Menü „Build your Bowl" inkl. Preise) | 15.09.2026 | ja |
| Compleat (Uber Eats) | `compleatuber` | Uber Eats | derselbe Shop-Datensatz + Uber-Eats-Menü „Selbst zusammenstellen" inkl. Preise (im Browser erfasst: `data/compleat-ubereats-menu.json`, 15.09.2026 13:46 UTC) | 15.09.2026 | ja |

### Regeln für Nährwertdaten (User 13.09.2026)
- Nur **offizielle, verifizierte** Nährwerte, **keine Schätzungen**. Fehlt etwas Wesentliches (z.B. Portionsgewicht bei per-100g-Werten) → Item weglassen und dem User Bescheid geben
- Nur Produkte, die auf der Plattform des Restaurants **bestellbar** sind; Namen exakt wie dort
- `data/<key>-raw.json` ist die **Quelle der Wahrheit**; `_meta` enthält Quelle, Stand, Anomalien (`anomalies`) und Ausschlüsse
- `<key>-update.js` schreibt den Block zwischen `// __<KEY>_DATA_START__` und `// __<KEY>_DATA_END__` in index.html. **Den Block nie von Hand ändern**
- Websites: `<key>-crawl.js`. Zuerst nach eingebettetem JSON bzw. einer API suchen (`__NEXT_DATA__`, `__NUXT__`, `__REACT_QUERY_STATE__`, XHR im Browser-Netzwerk), erst dann HTML scrapen
- Aktualität der Quelle prüfen (Stichprobe gegen die Live-Seite). Die Live-Seite schlägt Dritt-Datenbanken (OpenFoodFacts, FatSecret)
- Plausibilitäts-Check je Item: kcal ≈ 4·C + 4·P + 9·F, sat ≤ fat, sugars ≤ carbs. Auffälligkeiten **nicht still korrigieren**, sondern in `_meta.anomalies` dokumentieren und dem User nennen
- Beim Entfernen von Items prüfen, ob sie anderswo verwendet werden, und Nebenwirkungen melden

### Deutsche Nährwerttabellen (LMIV)
- Energie → `kcal` (nicht kJ) · Fett → `fat` · davon gesättigte Fettsäuren → `sat` · Kohlenhydrate → `carbs` · davon Zucker → `sugars` · Ballaststoffe → `fibre` · Eiweiß → `protein` · Salz → `salt`
- Ballaststoffe sind freiwillig: fehlen sie → 0 eintragen und in `_meta` dokumentieren
- Nur Natrium angegeben → Salz = Natrium × 2,5 (`saltFromSodium`, Eingabe in g)
- „12,5" → 12.5 · Tausenderpunkt („1.234" → 1234) · „<0,5" → 0.5 · „-"/„--" → 0 (`parseNum`; Leeres/Unlesbares wirft einen Fehler statt still 0)
- per-100g-Werte mit dem Portionsgewicht umrechnen (`scalePer100`; ohne Gewicht → Fehler)

### update-lib.js (gemeinsame Helfer für alle Update-Skripte)
`parseNum`, `saltFromSodium`, `scalePer100`, `slugId` (ASCII-ids, ä→ae …), `checkItem` / `reportAnomalies` (Plausibilität), `buildAcItems` + `acDataLines` (à-la-carte-Blöcke), `wrapBlock`, `replaceBlock` / `writeBlock` (CRLF-sicher, `$` im Inhalt bleibt wörtlich), `readJSON` (BOM-tolerant).

### Compleat: Datenpipeline
1. **`node compleat-crawl.js`** (Node-`fetch`, keine Dependencies) holt bzw. liest:
   - **vmos-API** `https://vmos2.vmos.io` mit den Headern `tenant` (Compleat), `store` (Frankfurt Nordend), `menu`, `x-requested-from: online`, `locale` — ohne sie antwortet die API mit HTTP 500 „Please select menu first!". Ablauf: `/catalog/v2/menu` (Menü finden) → `/catalog/v2/menu/categories/skeleton` + `/catalog/categories/{cat}/bundles` (Bundle „Selbst zusammenstellen" finden; beides mit Fallback-UUIDs) → `/catalog/bundles/{bundle}/item-types` (Zutaten: `nutritionalMeta` **pro 100 g/ml**, `defaultQuantity`, Allergen-UUIDs, Zutatenliste, Anzeige-Menge `customizations[0].variations[0].value`, halbe Portionen) → `/catalog/diets` (offizielle Allergen-Namen inkl. **Krebstiere** und **Weichtiere**)
   - **Wolt-API** `consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/compleat-nordend/assortment` → Item „Build your Bowl" (Grundpreis) → Optionsgruppen mit `multi_choice_config` (Gruppen-`total_range`; je Option `total_range.max` = maximale Menge, **0 = Häkchen = 1×**; am 15.09.2026 im Wolt-UI per Stepper verifiziert), Preise in Cent
   - **Uber-Eats-Erfassung** `data/compleat-ubereats-menu.json` (siehe Dev-Umgebung): Item-Preis, Gruppen (`minPermitted`/`maxPermitted`), je Option Titel, Preis (Cent), Stepper-Maximum und die kcal-Angabe von Uber Eats („adds 330 Cal."). Uber-Eats-Namen = Shop-Namen (inkl. „… - Halbe Portion (125g)") → Zuordnung automatisch über `slugId`, keine Tabelle
   - **Bricht ab** bei unbekannter Wolt-Option (→ `WOLT_MAP` ergänzen), Uber-Eats-Option ohne Shop-Zutat (→ Namen prüfen oder in `UE_NO_DATA` begründen), unbekannter Allergen-UUID, fehlender Mengenangabe, fehlender kuratierter id oder wenn 2 halbe Portionen ≠ 1 ganze (Menge oder Preis). Meldet `WOLT_MAP`-Einträge, die Wolt nicht mehr anbietet
   - Kuratierung im Skript: `WOLT_MAP` (Wolt-Name → Zutat-id), `PROTEIN_MAIN` (Haupt-Proteine → Rolle `protein`), `UE_NO_DATA` (Uber-Eats-Optionen ohne offizielle Werte), `CRUNCH`, `BLOCKED`, `MANUAL_ANOMALIES`
   - Rollen je Option: `base` · `protein` (nur `PROTEIN_MAIN`, auch halbe Portionen) · `extra` (Wolt-Extras; bei Uber Eats Ei/Edamame/Erbsen/Feta aus „Proteine" sowie Vitamine + Toppings) · `dip`
   - Schreibt `data/compleat-raw.json`: `ingredients` (45 Shop-Zutaten: `per100`, `portion`, `perPortion`, Allergene, Zutatentext, `halfPortion`, `vmos.displayAmount`, Flags), `wolt` (`itemPrice`, Gruppen mit Optionen: Wolt-Name, Zutat, `role`, Menge, `maxQty`, Preis), `ubereats` (dasselbe + `half`, `capturedAt`), `_meta` (Quellen, Rechenbasis, Wolt-/Uber-Eats-Regeln, Entscheidungen, Mengenabweichungen, Anzeige-Bugs, Anomalien, fehlende Angaben, nicht bei Wolt, `ubereats.noData/portionDiffs/kcalDiffs/notOnUberEats`, Koriander/Minze, Schalentier)
2. **`node compleat-update.js`** → COMPLEAT-Block: `ingredients` (kompletter Datensatz pro 100 g) + je Plattform (`wolt`, `ubereats`) `item`, `page`, `basePrice` und Gruppen mit fertigen Portionswerten je Option (pro 100 × Plattform-Menge / 100), `price`, `role`, `half`, Kurzname (Wolt: Text vor dem Komma; Uber Eats: ohne Mengenangabe, halbe als „½ …"). **Gesperrte Zutaten werden aus allen Plattform-Menüs weggelassen** (`buildMenu`)
3. **`node verify-compleat.js`** gleicht `data/compleat-word.txt` (Word-Copy-Paste des Users = Anzeige des Shops) gegen die Rohdaten ab: **42 Produkte, 336 Werte, alle identisch** (der Shop rundet wie `Number.toFixed` inkl. Gleitkomma-Effekt, z.B. 0,15 → „0,1"). tests.js führt den Abgleich mit aus

### Compleat: Befunde (Stand 15.09.2026)
- **Rechenbasis**: Shop-Werte pro 100 g × Portion laut Name (= `defaultQuantity`)
- **Anzeige-Bugs im Shop** (Anzeige rechnet mit `variations[0].value` statt Portion; auch das Word-Dokument enthält diese falschen Werte): Walnusskerne 1 g statt 20 g (**7 statt 140,8 kcal**), Röstzwiebeln 18 g statt 20 g (106 statt 118 kcal), Granatapfelkerne 20 g statt 15 g (15 statt 11,1 kcal), Sojasauce 40 ml statt 20 ml (8 statt 4,2 kcal, Salz 5,74 statt 2,87 g). Die App rechnet mit der Portion laut Name
- **Mengen Wolt ↔ Shop**: identisch außer **Salat-Mix** (Wolt 100 g, Shop 80 g → ×1,25; Wolts eigene Bowl-Beschreibungen nennen weiterhin 80 g). Neun Dips/Dressings ohne Mengenangabe bei Wolt → Shop-Portion (80 g; Protein Tzatziki + Guacamole 100 g; Olivenöl 20 ml)
- **Mengen Uber Eats ↔ Shop**: identisch (Salatmix 80 g, halbe Portionen = `halfPortion` des Shops). Jede Shop-Zutat ist bei Uber Eats bestellbar
- **Nicht bei Wolt**: Süßkartoffel (250 g), Gemüsemix (100 g) und alle halben Portionen
- **Uber Eats ohne offizielle Werte**: „Halbe Limette (50g)" (1,00 €; Uber Eats nennt nur „adds 20 Cal.", im Shop nicht vorhanden) → nicht im Rechner (`_meta.ubereats.noData`)
- **kcal-Angaben von Uber Eats** gegen die eigene Rechnung (`_meta.ubereats.kcalDiffs`, Rundung toleriert): nur zwei Abweichungen — „Protein-Pasta - Halbe Portion (100g)" nennt 238 kcal (Shop-Werte: 190,5) und „Granatapfelkerne (15g)" nennt 15 kcal (= der Shop-Anzeige-Bug, richtig 11,1). Walnusskerne (141), Röstzwiebeln (118) und Sojasauce (4) zeigt Uber Eats korrekt
- **Uber-Eats-Liste des Users vs. Live-Seite**: live zusätzlich „Hart gekochtes Ei (50g)" (Proteine, 1,00 €) und „Guacamole (100g)" (Dips, 3,00 €); alle übrigen Namen und Preise identisch
- **Neu bei Wolt am 15.09.2026**: „Hart gekochtes Ei, 50 g" (Extra) → offizielle Shop-Werte (77,5 kcal, 6,55 g P, 5,6 g F) statt der generischen Tabellenwerte aus dem Word-Dokument
- **Gesperrt**: Bunter Bio Quinoa (siehe Entscheidungen) — bei Uber Eats ganze und halbe Portion
- **Anomalien** (unverändert übernommen, in `_meta.anomalies`): Quinoa (130 kcal je 250 g unplausibel niedrig) · Pulled Salmon (6 g Ballaststoffe je 100 g bei „LACHS, Speisesalz, Rauch") · Honey Muscle Mustard (35 g Ballaststoffe je 100 g) · Avocado (kcal passen nicht zu den Makros, 10 von 12,5 g Fett gesättigt) · Edamame (Fett 0, kcal passen nicht) · Olivenöl, Salz & halbe Zitrone (Salz 0) · Chili Gewürz (alles 0). Ballaststoffe nicht angegeben (→ 0): Power Peanut, Sexy Sesame, Sojasauce
- **Fertige Wolt-Bowls** (Classic Bowl, Mango Fire …) sind nicht modelliert: Es sind Build-your-Bowl-Vorlagen (Base/Protein/Dip nach Wahl + feste Extras). Build your Bowl deckt sie ab, bis auf Zutaten, die es nur dort gibt (Kirschtomaten, Tzatziki Gewürz, Joghurt Dressing Zero)

## Restaurant-Registry (`RESTAURANTS` in index.html)
```js
{ key, name, kind:"ac"|"byo", data, gradient:[von,bis], label, platform, accurate, maxN:5, switches:[…], note?, footer?, exclusionKey?, menu? }
```
- `key`: `[a-z][a-z0-9]*`, eindeutig, nicht `search`/`all`/`accurate` · `label`: Mono-Label im Header (GROSSBUCHSTABEN) · `platform`: Lieferando / Wolt / Uber Eats · `accurate:true` = verifizierte offizielle Daten · `note` = Hinweistext in der Config-Karte · `footer` = Fußzeile („Data: …")
- `exclusionKey` (optional): gemeinsame Ausschluss-Liste mehrerer Einträge (ein Restaurant auf mehreren Plattformen; Default `key`) · `menu`: Bowl-Menü eines BYO-Eintrags (für `bowlCombos`)
- **À la carte (`kind:"ac"`)**: `data = { cats:[{id,name,on,drink?}], items:[{id,name,cat,kcal,fat,sat,carbs,sugars,fibre,protein,salt,…Flags}] }`. `optimizeAC(r,t,mode,p,st,ex)`: Pool = Items der aktiven Kategorien (**nie** `drink:true`, nie ausgeschlossene ids) → aktive `filter`-Schalter → `require`-Schalter als `resultFilter` → `alaCarteCombos`. Config-UI, Karte, Panel und Order Guide werden generisch gerendert
- **Schalter** (deklarativ): `{ id, label, def, filter?(item), require?(items), overridesCats?, group?, inAll?, hint? }`
  - `filter` wirkt auf den Pool (bei BYO auf die Menü-Optionen) · `require` wirkt aufs Ergebnis („must include X")
  - `overridesCats` = restriktiver „only X"-Modus, ignoriert die Kategorie-Chips (andere aktive Filter wirken weiter; die UI dimmt die Chips und nennt den Schalter)
  - `group` = UI-exklusiv (`toggleSwitch`: einer an → die anderen derselben Gruppe aus)
  - `inAll` = Wert in All/Accurate (Default: `def`) · `hint` = kursiver Erklärtext unter dem Schalter
- **Build-Your-Own (`kind:"byo"`)** — Pflicht-Methoden:
  - `optimize(t, mode, p, st, ex, r)` → sortierte Ergebnisse, max 20, je `{items | key, nutrition, score, price?}` — **`isShellfish` im eigenen Pool anwenden**, `ex` = Set ausgeschlossener ids, `t.maxPrice` = Preislimit in € oder `null`; ein Ergebnis-Array mit `approx = true` = Suche vorzeitig beendet (UI-Hinweis)
  - `renderConfig(ctx)` · `renderCard(res, ctx)` (nutzt `ctx.selected` / `ctx.onSelect`) · `renderPanel(sel, ctx)` (nur der Mittelteil: Titel, MacroBars und Order Guide rendert die App) · `orderSteps(sel)` → `[{l, v}]` · `searchEntries()` → Items für den Such-Index
  - optional: `summary(res)`, `panelSubtitle(sel)`, `inputHint(st)`, `initState()` → `st.extra`, `excludables()` → `[{id, name, group}]`, `validate()` → Datenprobleme (von `validateRegistry` gemeldet)
  - `ctx = {R, st, tg, targets, mode, prefs, selKey, toggleSel, update}`
  - Für Gruppen-Menüs gibt es die generische Engine `bowlCombos` + Renderer `bowlConfigCard`/`bowlCard`/`bowlPanel`/`bowlSubtitle`, Helfer `bowlSummary`/`bowlOrderSteps`/`bowlSearchEntries`/`bowlExcludables`/`bowlValidate`/`bowlRole`/`bowlEuro`/`switchPass`. Compleat-Einträge entstehen über `compleatEntry({ key, menuKey, name, platform, label, gradient, footer, note })` (gleiche Regeln/Schalter, eigenes Menü)
- **State** pro Restaurant: `rs[key] = {cats, maxN, sw, sel, extra}` (`defaultRestoState`), bleibt beim Tab-Wechsel erhalten; die Ziele (inkl. Preislimit) sind global. Ergebnisse werden nur für den aktiven Tab gerechnet (`sel` ist bewusst keine Memo-Abhängigkeit)
- Die ausgewählte Karte wird über den stabilen Key `resultKey` markiert (sortierte Item-IDs bzw. BYO-`key`), auch nach Neuberechnung und beim Sprung aus All/Accurate
- Spezial-Tabs (`SPECIAL_TABS`: search / accurate / all) sind **keine** Registry-Einträge. Restaurant-Blöcke rendern nur, wenn `RESTO_BY_KEY[tab]` existiert
- `validateRegistry(restos)` prüft Keys, Pflichtfelder, Schalter (Wirkung, Gruppen), Kategorien, eindeutige Item-ids, 8 numerische Makros und `r.validate()`; tests.js erwartet `[]`
- **Keine Restaurant-Sonderlogik per Tab-Vergleich** im App-Code (tests.js prüft, dass kein `==="<registry-key>"` vorkommt)

## Bestellabläufe (je Restaurant)
### Compleat (`compleat`, Wolt, Build your Bowl)
- Wolt-Item **„Build your Bowl"** (Compleat Nordend, Glauburgstraße 5), **Grundpreis 2,00 €** + Optionspreise laut Wolt:
  - **Deine Basis** 0–5 Portionen: Basmatireis, 250 g · Salat-Mix, 100 g · (Bunter Quinoa, 250 g — gesperrt) je per Stepper bis 4× · Protein Nudeln, 200 g 1×
  - **Deine Proteine** 0–10 Portionen: Hähnchen, 100 g · Veganes Hähnchen, 80 g · Vegane Hackbällchen, 100 g · Rinderhackbällchen, 100 g je per Stepper bis 10× · Pulled Salmon, 100 g 1×
  - **Deine Extras** 0–30, je 1× (Häkchen): die vier Proteine erneut + Hart gekochtes Ei, Erbsen, Babyspinat, Tomaten, Edamame, Brokkoli, Avocado, Karotten, Mais, Gurken, Mango, Feta, Rote Beete-Falafel, Rotkohl, Schwarzer Sesam, Granatapfelkerne, Erdnüsse, Walnusskerne, Röstzwiebeln, Chili Gewürz, Grana Padano
  - **Dein Dip** genau 1: 13 Dips/Dressings oder „Ohne Dip"
- Regeln im Tool: **jede Bowl ≥1 Base + ≥1 Protein** (User 15.09.2026), Dip 0 oder 1, Proteine laufen nur über „Deine Proteine" (Stepper; die Duplikate unter Extras werden nicht genutzt), Quinoa nie
- Order Guide (Wolt), eine Zeile je Gruppe: `Item: Build your Bowl` → `Deine Basis: 1× Basmatireis, 250 g · 1× Salat-Mix, 100 g` → `Deine Proteine: 2× Hähnchen, 100 g` → `Deine Extras: Edamame, 50 g · Walnusskerne, 20 g` (ohne Menge = Häkchen) → `Dein Dip: Ohne Dip`

### Compleat (`compleatuber`, Uber Eats, Selbst zusammenstellen)
- Uber-Eats-Item **„Selbst zusammenstellen"** (Compleat Frankfurt Nordend), **Grundpreis 1,00 €** + Optionspreise laut Uber Eats; jede Option hat einen Stepper:
  - **Base** (bis 100 Auswahlen, je Option bis 10×): Basmati Reis (250g), Salatmix (80g), Süßkartoffel (250g), Protein-Pasta (200g), jeweils auch als „… - Halbe Portion" · (Bunter Bio Quinoa ganz + halb — gesperrt)
  - **Proteine** (je Option bis 5×): Hühnchen (100g), Veganes Hühnchen planted.chicken (80g), Rinderhackbällchen (100g), Vegane Hackbällchen (100g), Pulled Salmon (100g), jeweils auch halb · Hart gekochtes Ei (50g), Edamame (50g), Erbsen (50g), Feta Käse (50g)
  - **Vitamine** (11 + Halbe Limette ohne Werte) · **Toppings** (7 inkl. Chili Gewürz, 0 €) · **Dips** Pflicht (1–100): „ohne Dip" + 13 Dips/Dressings
- Regeln im Tool (Stand 15.09.2026, sinngemäß wie Wolt):
  - **≥1 Base + ≥1 Haupt-Protein** (Rolle `protein`: Hühnchen, Veganes Hühnchen, Rinder-/Vegane Hackbällchen, Pulled Salmon; halbe Portionen zählen). Ei, Edamame, Erbsen und Feta stehen bei Uber Eats unter „Proteine", zählen aber wie bei Wolt als **Extras**
  - Extras je höchstens 1× (Uber Eats erlaubt mehr), höchstens ein Dip (Uber Eats erlaubt mehrere), Quinoa und Halbe Limette nie
  - **Halbe Portion höchstens 1× neben der ganzen Portion derselben Zutat** (2 halbe = 1 ganze bei Menge und Preis → sonst Doppel-Ergebnisse); der Portionen-Chip zählt halbe als ½ („150 g Hühnchen" = ganze + halbe, bei Chip 2 möglich)
- Order Guide (Uber Eats), eine Zeile je Gruppe, **jede Auswahl mit Menge** (überall Stepper): `Item: Selbst zusammenstellen` → `Base: 2× Salatmix (80g) · 1× Süßkartoffel (250g)` → `Proteine: 1× Hühnchen (100g) · 1× Hühnchen - Halbe Portion (50g) · 1× Edamame (50g)` → `Vitamine: 1× Avocado (35g)` → `Toppings: …` → `Dips: ohne Dip`

### Beide Compleat-Tabs
- Config-Karte: **„Max. extras per bowl"** 0/1/2/3/4/5/6 (Default 5) · **„Max. portions of the same base / protein"** 1/2/3/4 (Default 2; Uber Eats: „· half portion = ½"; zusätzlich gelten die Plattform-Grenzen) · Hinweistext mit Grundpreis
- Schalter: **„No dip"** (Default **AN**) · **„No crunch"** (Default **AUS**, blendet Erdnüsse, Walnusskerne, Röstzwiebeln, Schwarzer Sesam aus)
- Karte: Kurzname („Basmatireis + 2× Hähnchen + Edamame" bzw. „Basmati Reis + Hühnchen + ½ Hühnchen"), Unterzeile „<Item> · 1 base · 2 protein · 4 extras · no dip", rechts kcal + **Preis**; Panel: Komponenten je Plattform-Gruppe mit kcal · Protein · Preis + **Total price** (inkl. Grundpreis, Menüpreise ohne Gebühren)
- **Gemeinsame Ausschluss-Liste** (`exclusionKey: "compleat"`): ausverkauft/keine Lust gilt für beide Apps

## Preislimit (User 15.09.2026)
- Optional und global: Feld **„Max. price" (€)** im aufklappbaren Bereich **„Fibre / Salt / Price ▾"**; eingeklappt zeigt der Link „· max €X". Leer = kein Limit (Default)
- Preis einer Bestellung = **Grundpreis des Items + Σ Optionspreise × Menge** laut Plattform-Menü (Wolt „Build your Bowl" 2,00 €, Uber Eats „Selbst zusammenstellen" 1,00 €). **Ohne** Liefer-/Servicegebühren und Rabatte (UI-Hinweis)
- `targets.maxPrice` → `bowlCombos(…, { maxPrice })`: **harte Nebenbedingung in der exakten Suche** (Cent-Arithmetik; Kern-Preis + billigster Extras-Punkt je Baumknoten), gilt im Restaurant-Tab und in All/Accurate. Keine passende Bowl → „No results within €X — raise the price limit, …"
- À-la-carte-Restaurants haben noch keine Preisdaten → dort wirkt das Limit (noch) nicht

## Permanenter Schalentier-Ausschluss — ALLE Restaurants (User-Allergie, User 13.09.2026)
- Krebstiere + Weichtiere: Garnelen/Shrimps/Scampi/Gambas, Krabben, Hummer, Langusten, Flusskrebse, Muscheln, Austern, Jakobsmuscheln, Tintenfisch/Calamari/Sepia, Oktopus/Pulpo, Meeresfrüchte. **Kein Schalter. Fisch ist erlaubt.**
- Ausgeschlossen wird nur, was **tatsächlich enthalten** ist: der Name sagt es ODER die Allergenliste sagt „enthält". „Kann Spuren enthalten" zählt **nicht**. Keine spekulativen Warnungen
- Zentral `isShellfish(x)`, genutzt im Pool von `alaCarteCombos`, in `bowlCombos` / BYO-Optimizern (Pflicht) und in `buildSearchIndex`:
  - `SHELLFISH_RE` (DE + EN): `garnele|shrimp|scampi|gambas|prawn(?!less)|krabbe|crab|krebs|hummer|lobster|langust|langoust|crayfish|muschel|mussel|clam|auster|oyster|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|frutti di mare|seafood|california|\bebi\b`
  - `SHELLFISH_NAMES`: exakte, kleingeschriebene Namen (auch mit angehängtem „ (…)"), die laut Allergenliste Schalentier enthalten, es aber nicht verraten (aktuell leer)
  - Item-Flag `shellfish:true`: setzt das Update-Skript, wenn die Allergenliste „enthält" sagt (Compleat: Allergen-Namen „Krebstiere"/„Weichtiere" aus `/catalog/diets`)
  - `SHELLFISH_SAFE`: Wortteile, die vor dem Regex-Test entfernt werden: `austernpilz`, `austern-pilz`, `austernseitling`, `oyster mushroom`, `muschelnudel`, `muschelpasta`
- Deutsche Allergen-Legenden nutzen oft **B = Krebstiere** und **R = Weichtiere**. Immer die Legende der jeweiligen Karte prüfen
- **Compleat**: kein Krebstier-/Weichtier-Allergen; Pulled Salmon = Fisch (erlaubt)
- Offener Punkt: Schnecken (Escargots) sind ebenfalls Weichtiere. „schnecke" steht bewusst **nicht** im Regex (Zimtschnecke!); bei Bedarf über `SHELLFISH_NAMES` bzw. das Flag lösen

## Abneigungen: Koriander + Minze (User 13.09.2026)
- Als wählbare Komponente, Topping oder Dressing **nie vorschlagen** (Petersilie als Topping ist ok)
- Fertige Gerichte, die Koriander oder Minze **prominent** enthalten: beim Hinzufügen des Restaurants im Chat erwähnen
- **Compleat**: Guacamole enthält laut Zutatenliste Koriander (kleiner Anteil) → **normal anbieten** (User 15.09.2026; auf Wolt und Uber Eats). Protein Tzatziki: Petersilie + Dill, keine Minze. Joghurt-Salatdressing und Honey Muscle Mustard: nur „Kräuter" (nicht spezifiziert). Der Crawl listet Treffer in `_meta.dislikes`

## Schalter-Defaults (User 13.09.2026)
- „No …"-Schalter (Exclude-Filter) starten **AN** — **Ausnahme: Compleat „No crunch" startet AUS** (User 15.09.2026)
- Restriktive „only X"- und „must include"-Modi starten **AUS**, außer der User sagt etwas anderes
- Pro `group` höchstens ein Schalter mit `def:true` (und höchstens einer mit `inAll`), sonst meldet `validateRegistry` einen Fehler

## Standard-Defaults (beim App-Start)
- Makro-Ziele: Carbs **85 g**, Protein **65 g**, Fat **20 g** (≈ 780 kcal); Kalorien-Modus: **450 kcal** mit **High Protein + Low Fat**
- Modus „Enter macros"; Sort by „Score"; Preislimit leer
- Start-Tab: erstes Registry-Restaurant (`DEFAULT_TAB` = Compleat (Wolt))
- À la carte: Max. items per order **5**; All/Accurate-Chip **5**
- Compleat (beide Tabs): No dip AN, No crunch AUS, max. 5 Extras, max. 2 Portionen je Base/Protein, Ausschluss-Liste leer

## UI-Reihenfolge (wie London)
1. Header: Gradient je Tab, Mono-Label in Großbuchstaben, „Macro Optimizer", „Find the optimal order for your goals", dekorativer Kreis
2. Modus-Buttons „Enter macros" | „Calories + preferences"
3. „📷 Import from screenshot"
4. Eingabekarte (Carbs/Protein/Fat + „≈ X kcal · <Hinweis>" bzw. kcal + Präferenz-Chips), darunter aufklappbar „Fibre / Salt / Price ▾" (Fibre/Salt Min/Max + **Max. price**)
5. Tab-Zeile (`flexWrap`, `btn`-Style): **➕ Add own order · Accurate restaurants · All restaurants**, danach die Registry-Restaurants (Compleat (Wolt) · Compleat (Uber Eats))
6. All/Accurate: Karte „Max. items per order" (bzw. Hinweiskarte, wenn keine Restaurants) · Restaurant: Config-Karte (à la carte: Kategorie-Chips · Max. items · `note`; BYO: `renderConfig`) · Schalter-Zeile · **Ausschluss-Karte „Exclude items"**
7. „Top results" mit Sort-Chips (Score / Calories / Carbs / Protein / Fat; C/P/F nur im Makro-Modus), 20 berechnet / 8 angezeigt; Karten mit Preis (BYO); gelber Hinweis „Search stopped early …", wenn die Bowl-Suche ihr Zeitbudget ausgeschöpft hat; leere Liste → Hinweis
8. Detail-Panel nach Klick: MacroBars mit Delta zum Ziel (kcal #4ade80, Carbs #fbbf24, Protein #60a5fa, Fat #f87171, Fibre #a78bfa, Salt #94a3b8; Fibre-Ziel = Fibre Min, Salt-Ziel = Salt Max) → Aufschlüsselung (à la carte „Items", BYO je Plattform-Gruppe mit Preisen + Total price) → „📋 Order guide (<Plattform>)" nummeriert mit Mengen
9. Fußzeile (Datenquelle je Tab)

### Zwei Modi
- **Enter macros**: P/C/F in g, kcal = P×4 + C×4 + F×9; der Score gewichtet Protein ×3, Carbs ×2, Fett ×2 (relativ zum Ziel)
- **Calories + preferences**: kcal-Ziel (×4) + Toggles High/Low Protein/Carb/Fat (Gegenpaare schließen sich aus), bewertet über die Energieanteile
- Fibre/Salt Min/Max: Zusatzstrafen (Fibre ×0,5 je g, Salz ×0,3 je g)

### Screenshot-Import (OCR), 1:1 aus London
YAZIO-„Übersicht" → verbleibende Makros (Total − Gegessen) + „Übrig"-kcal. `parseMacroScreenshot` (rein, 22 + 4 Testfälle aus London), `ocrMacroScreenshot` (Tesseract „deu", on-device), `downscaleImage` (groß runter auf ≤2600 px, klein hoch auf ~2400 px). Robust gegen Slash als `| I l ) ]`, verschlucktes „g"/Slash, „g→9", Ring auf einer Zeile und Tausenderpunkte; Fett wird an „Übrig" angeglichen.

## Optimizer
- `sumN(items, mult, singleItems)`, `score(a, t, mode, p)`, `sortResults(arr, sortBy, tgts)`: identisch zu London. `scoreVec(n, t, mode, p)` = `score` in Vektorform (Reihenfolge `KEYS`) für innere Schleifen; tests.js prüft die Gleichheit an 400 Zufallsfällen
- `alaCarteCombos(t, mode, p, pool, maxN, opts)`: identisch zu London, mit Options-Objekt `{distinctBy, dedupKey, resultFilter, baseItems}`. Singles + Paare vollständig, Triples per Beam (beste 80 Paare), bei ∞ weitere Stufen nur solange der Score besser wird (Deckel 12 Items), Top 20. Schalentier-Filter auf dem Pool
- `optimizeAC` (siehe Registry); `runOptimize` / `orderStepsFor` / `searchEntriesFor` / `summarizeResult` / `excludablesFor` dispatchen zwischen ac und byo

### Bowl-Engine `bowlCombos(menu, t, mode, p, opts)` (Build-Your-Own mit Gruppen)
- **Aufgabe**: Bowls aus Plattform-Menüs mit Gruppen und **Rollen** (`role` je Option: `base` / `protein` / `extra` / `dip`; fehlt → Gruppen-id wie bei Wolt): je Bowl **≥1 Base + ≥1 Protein** (Rolle), höchstens ein Dip, Extras je 1× und höchstens `maxExtras`. Portionen je Base-/Protein-Zutat höchstens `cap` (Portionen-Chip) gezählt in **halben Portionen** (ganz = 2, halb = 1), halbe Portion neben erlaubter ganzer höchstens 1× (kanonisch), dazu Plattform-`maxQty` und Gruppen-Maxima. Extras, deren Zutat auch als Protein angeboten wird (Wolt-Duplikat), laufen nur über die Protein-Rolle; Extras ohne Nährwerte (Chili Gewürz) fallen weg. `keep(option)` bündelt Schalter, Ausschlüsse und Sperren; `isShellfish` greift immer. **Preis** (Cent) = Grundpreis + Optionen; `maxPrice` ist eine harte Grenze
- **Exakt statt heuristisch**: Die Rangliste der 30 besten Roh-Scores ist **identisch mit der vollständigen Durchrechnung** — Makro-Modus, Kalorien-Modus mit/ohne Präferenzen, mit halben Portionen, Rollen und Preislimit (sofern das Zeitbudget nicht greift). Danach wie überall: Nährwerte über `sumN` runden → Score neu → Top 20 → 8 angezeigt
- **Teil 1 — Kern** (Base-/Protein-Portionen + Dip): Seeds je 1 Base × 1 Protein, **nach Aussicht sortiert** (gute Bowls früh → niedrige Schwelle früh), Erweiterung in fester Reihenfolge (jede Kombination genau einmal)
  - *Makro-Modus / Kalorien ohne Präferenzen*: Score je Nährwert konvex, alle Beiträge ≥ 0 → nur **verbessernde** Zusätze (findet das Optimum); übersprungene Bowls sind höchstens so gut wie dieselbe Bowl ohne die nutzlose Portion und werden am Ende **nachgetragen** (zu jeder Ranglisten-Bowl einzeln jede erlaubte Kern-Portion ergänzen, bis nichts Neues mehr kommt)
  - *Kalorien-Modus mit Präferenzen* (Energieanteile → nicht konvex): alle Kerne, abgeschnitten über `bowlShareLB` (Präferenz-Term = L / kcal mit L = ap·4·P + ac·4·C + af·9·F, `bowlShareL`; jeder Baustein hat L ≥ rho·kcal → Minimum von 4·|K − Ziel|/Ziel + rho + (L_Kern − rho·kcal_Kern)/K über die erreichbare kcal-Spanne, `bowlKcalShareMin`)
  - In beiden Fällen fallen ganze Teilbäume weg, wenn ein Ziel schon überschritten ist oder mit den restlichen Kern-Bausteinen (**Kapazität `SUF[j]`**: je Rolle min(Σ qmax·v, Gruppen-Maximum × größter Baustein) + größter Dip) plus der größten Extras-Summe (`EMX`) nicht mehr erreichbar ist; `rho` je Index (`rhoSuf`)
- **Teil 2 — Extras je Kern**: alle Extras-Teilmengen (≤ max. Extras) als Punkte in einem k-d-Baum (`bowlIndex`: Quickselect, Blätter ≤ 8, höchstens 30 Extras wegen Bitmaske; `PR` = Preis je Punkt, `PMIN` = billigster Punkt je Knoten → Preislimit schneidet Teilbäume), Cache `BOWL_INDEX_CACHE` (max. 8). Branch & Bound mit `bowlBoxLB` (Kalorien-Modus: kcal- und Präferenz-Term gemeinsam über `bowlKcalShareMin`) findet exakt alle Ergänzungen unter der Ranglisten-Schwelle
- **Zeitbudget** `BOWL_MAX_MS` = 500 ms je Suche (Uhr alle 4096 Baum-Knoten): Nur Extrem-Einstellungen (sehr hohe Ziele + Dips + viele Portionen, v.a. Uber Eats mit halben Portionen) brauchen länger → die Suche endet mit der bis dahin besten Rangliste, das Ergebnis trägt `approx = true` und die UI zeigt den gelben Hinweis. `opts.maxMs` / `opts.maxWork` (deterministisches Knoten-Budget) für Tests; Exaktheits-Tests laufen ohne Zeitbudget
- `scoreVec` = `score` in Vektorform; `opts.raw: true` liefert die ungerundete Rangliste `[{key, rawScore, price}]` (Tests, Benchmark)
- **Geprüft**: tests.js (Test-Menü mit halber Portion + Rollen, Compleat Wolt inkl. Dips, Uber Eats in kleinen Konfigurationen; Makro/Kalorien; Preislimit; Untergrenzen im Zufallstest) · Benchmarks gegen die vollständige Durchrechnung und Varianten-Vergleiche (Top 30 überall identisch)
- **Laufzeit** (Node am PC, Ergebnis-Rechnung ohne Index-Aufbau; realistisch = eine Mahlzeit P 30–80 / C 30–120 / F 8–35 bzw. 350–900 kcal, extrem = P 90–160 / C 110–180 / F 35–55 bzw. 1000–1400 kcal):
  | Konfiguration | realistisch: Median · p90 · max (approx) | extrem: Median · p90 · max (approx) |
  |---|---|---|
  | Wolt Standard (no dip, 2 Portionen, 5 Extras) | 0,8 · 2 · 2 ms (0/64) | 1,4 · 3 · 4 ms (0/36) |
  | Wolt Dips, 4 Portionen, 6 Extras | 1,2 · 3 · 6 ms (0/64) | 6,9 · 13 · 17 ms (0/36) |
  | Uber Eats Standard | 2,9 · 12 · 26 ms (0/64) | 44 · 119 · 129 ms (0/36) |
  | Uber Eats Dips, 2 Portionen, 5 Extras | 7,7 · 54 · 148 ms (0/64) | 213 · 501 · 501 ms (9/36) |
  | Uber Eats no dip, 4 Portionen, 6 Extras | 6,7 · 32 · 75 ms (0/64) | 224 · 501 · 501 ms (7/36) |
  | Uber Eats Dips, 4 Portionen, 6 Extras | 13,6 · 107 · 262 ms (0/64) | 501 · 501 · 502 ms (24/36) |

  Erster Aufruf je Konfiguration zusätzlich Index-Aufbau 20–95 ms. Im Browser (Chrome am PC) ähnlich: extremer Uber-Eats-Fall mit Budget ≈ 0,5–0,7 s, realistische Fälle 10–35 ms
- **Verworfen** (15.09.2026): Beam-Suche (Optimum nur in 22–25 von 37 Fällen) · Tiefensuche mit Branch & Bound über alles (exakt, aber bis 4,4 s mit Dips) · „nur verbessernde Zusätze" auch im Kalorien-Modus mit Präferenzen (Optimum 51/53) · Makro-Modus ohne Nachtragen (bis zu 10 fehlende Bowls der Top 30) · **Protein-Kombinationen als zweiter k-d-Baum mit Paar-Suche** (exakt, aber meist langsamer, im Kalorien-Modus bis 8 s) · Proteine vor Basen in der Kern-Reihenfolge (kein Gewinn) · Knoten-Budget als UI-Schutz (Laufzeit je Knoten zu unterschiedlich → Zeitbudget)

### „All restaurants" / „Accurate restaurants" (`optimizeAll(t, mode, p, maxN, onlyAccurate, restos?, exclMap?)`)
Jedes Restaurant läuft mit Default-Kategorien, `inAll`-Schalterwerten, dem Max-Items-Chip (`allState`), seiner **Ausschluss-Liste** (`exclusionKey`) und dem Preislimit der Ziele. **Max. 1 Treffer pro Registry-Eintrag** (Compleat also je Plattform einer), nach Score sortiert, Top 20 → 8 angezeigt. Accurate = nur `accurate:true` (leer → Hinweiskarte). Karte mit Restaurant-Badge + Kurz-Zusammenfassung + Preis; Klick (`selectAcross`) wechselt in den Restaurant-Tab und öffnet das Ergebnis dort. `approx` eines Restaurants → Hinweis auch hier.

## Ausschluss-Liste „Exclude items" (User 15.09.2026)
- Für **jedes** Registry-Restaurant: Dinge, die ausverkauft sind oder auf die man keine Lust hat, suchen (umlaut-tolerant, `matchesQuery`) und antippen → der Optimizer ignoriert sie, bis sie wieder entfernt werden
- Gilt im Restaurant-Tab **und** in All/Accurate. Gespeichert in **`fra_excluded`** (`{ [exclusionKey bzw. key]: [ids] }`); Compleat Wolt + Uber Eats teilen `compleat`
- Was ausschließbar ist, liefert `excludablesFor(r)`: à la carte = Items (ohne Getränke/Schalentier), BYO = `r.excludables()` (Compleat: je Zutat ein Eintrag mit dem Namen der jeweiligen Plattform, gilt für alle Gruppen und ganze + halbe Portionen; gesperrte Zutaten erscheinen nicht)
- UI: Karte unter der Schalter-Zeile, aktive Ausschlüsse als rote Chips mit ✕ + „Clear", „Add ▾" öffnet Suchfeld + Chips (max. 40, sonst „type to search")

## „Add own order" (`tab==="search"`), kein Optimizer
- `SEARCH_INDEX = buildSearchIndex(RESTAURANTS)` entsteht automatisch aus der Registry (AC: `data.items` inkl. Drinks; BYO: `searchEntries()` — Compleat: jede Plattform-Option einmal mit Plattform-Namen, Badge „COMPLEAT (WOLT)" / „COMPLEAT (UBER EATS)", ohne Quinoa/Limette), Schalentier raus, Dedup über `resto|name|kcal`
- `searchItems(query, limit=60, index?)`: alle Begriffe müssen in Name + Restaurant vorkommen, kürzester Name zuerst, **umlaut-tolerant** (`foldVariants`: ä→ae **und** ä→a, ö/ü analog, ß→ss, Akzente weg)
- Trefferliste: kcal ganzzahlig, P/C/F auf 1 Dezimale gerundet (BYO-Optionen haben intern 2 Dezimalen)
- „+ Add" → Warenkorb mit −/+/✕ (gleicher Eintrag → Menge +1), gespeichert in **`fra_own_order`**. Einträge speichern die vollen Makros und überleben Registry-Änderungen
- „Order total"-Karte mit MacroBars gegen die Ziele (`orderTotal`). Header #475569→#1e293b, Label „ADD OWN ORDER · TRACK"

## Design
- Dark Mode: Hintergrund #0d0d0d, Text #e0e0e0; Akzent #009743 / #4ade80; Karten #151515, Radius 12, Border #222
- Header-Gradients: Add own order #475569→#1e293b · All #7c3aed→#4c1d95 · Accurate #0284c7→#0c4a6e · **Compleat (Wolt) #d7192d→#6b0f1a** · **Compleat (Uber Eats) #b3121d→#141414** · weitere Restaurants über `gradient` in der Registry
- Fonts DM Sans / DM Mono; touch-freundliche Buttons; safe-area-inset
- Homescreen-Icon rot (#c8102e) mit „FRA", bewusst anders als London (grün „M")

## Tests (`node tests.js`)
- Harness wie London: Inline-Script per Regex laden, React/ReactDOM/document/localStorage stubben, indirektes `eval`, Funktionen an `globalThis.__t`
- `check(name, actual, expected)`: Zahlen mit Toleranz 0.05, Booleans mit `===`, **Strings immer als `check(name, a === b, true)`**. Am Ende „Alle Tests bestanden", sonst Exit-Code 1
- Abgedeckt (333 Tests, Stand 15.09.2026): Struktur (1 Inline-Script, `fra_`-Präfix, keine Registry-Key-Vergleiche, Demo entfernt), sumN, score + scoreVec, sortResults, alaCarteCombos, isShellfish, Registry + validateRegistry (inkl. `r.validate`), optimizeAC mit Test-Restaurant (inkl. Ausschlüssen), BYO-Stub, optimizeAll (inkl. Ausschlüsse), SEARCH_INDEX/searchItems/matchesQuery, orderTotal, **Bowl-Engine am Test-Menü** (Regeln, Rollen, halbe Portionen, Deckel in halben Portionen, Schalentier, Nullwert-Extras, Preise + Preislimit, `opts.raw`, Arbeits-/Zeitbudget, **Top 30 = vollständige Durchrechnung** im Makro- und Kalorien-Modus und mit Preislimit), Untergrenzen `bowlShareLB` (mit/ohne kcal-Obergrenze), `bowlOverLB` und `bowlKcalShareMin` im Zufallstest, **Compleat-Daten** (Block = Rohdaten für Wolt + Uber Eats, Portionen, Preise, Rollen, halbe Portionen, Anzeige-Bugs, Sperre, Limette, kcal-Abgleich Uber Eats, Uber-Eats-Erfassung, Crunch, Anomalien, Word-Abgleich), **Compleat-Optimizer** (Wolt + Uber Eats: Pflichtteile, Schalter, Ausschlüsse inkl. gemeinsamer Liste, Chips, Preise/Preislimit, halbe Portionen, Protein-Pflicht, Order Guides, Suche, All, **Top 30 = vollständige Durchrechnung** inkl. Dips und Preislimit), parseMacroScreenshot (London-Fälle), update-lib.js

## Dateistruktur
```
Restaurant Tracker Frankfurt Claude/
├── index.html              ← Die PWA (alles in einer Datei: Registry + generierte Datenblöcke)
├── CLAUDE.md               ← Diese Datei
├── tests.js                ← Logik-Tests (node tests.js)
├── update-lib.js           ← Gemeinsame Helfer für <key>-update.js (LMIV, Plausibilität, Marker-Block)
├── compleat-crawl.js       ← Compleat: Shop-API (vmos) + Wolt-API + Uber-Eats-Erfassung → data/compleat-raw.json (Kuratierung: WOLT_MAP, PROTEIN_MAIN, UE_NO_DATA, CRUNCH, BLOCKED, MANUAL_ANOMALIES)
├── compleat-update.js      ← Compleat: data/compleat-raw.json → COMPLEAT-Block (beide Plattform-Menüs; buildMenu lässt gesperrte Zutaten weg)
├── verify-compleat.js      ← Compleat: Abgleich Word-Export ↔ nachgerechnete Shop-Anzeige
├── ubereats-capture.js     ← Snippet für die Browser-Konsole: Uber-Eats-Menü „Selbst zusammenstellen" als JSON erfassen
├── Compleat Daten manuell in Word.docx  ← User-Arbeitsdatei (unversioniert)
├── .gitignore
├── .claude/launch.json     ← Preview „macro-optimizer-frankfurt" (Port 8421)
└── data/
    ├── compleat-raw.json           ← Compleat-Datensatz (Quelle der Wahrheit, vom Crawl erzeugt)
    ├── compleat-ubereats-menu.json ← Uber-Eats-Menü (im Browser erfasst, 15.09.2026; Quelle für den Crawl)
    └── compleat-word.txt           ← Text-Export des Word-Dokuments (Kontrollquelle)
```

## Checkliste „Neues Restaurant"
1. Kurz beim User erfragen, was fehlt: **Plattform**, **Bestellmodell** (à la carte oder Build-Your-Own mit Schritten), **Schalter**, **Default-Kategorien**, **Nährwertquelle**. Plattform-Menü möglichst direkt aus der Plattform-API lesen (Wolt: consumer-assortment, siehe Compleat) statt abzutippen; blockt die Plattform Skripte (Uber Eats), im Browser erfassen und als Datei ablegen (siehe `ubereats-capture.js`) — Bot-Prüfungen nie umgehen
2. Quelle prüfen (offiziell? aktuell? auf der Plattform bestellbar?) → `data/<key>-raw.json` (per `<key>-crawl.js` / Extract; Kuratierung als Tabellen im Skript) → `<key>-update.js` (Helfer aus `update-lib.js`). Marker `// __<KEY>_DATA_START__` / `// __<KEY>_DATA_END__` im Datenbereich von index.html einsetzen, dann das Skript laufen lassen. Anomalien, Ausschlüsse, Mengenabweichungen, Schalentier (Allergen-Legende!) und Koriander/Minze im Chat melden. Preise mit übernehmen (Preislimit)
3. Registry-Eintrag anlegen (key, name, kind, data, gradient, label, platform, accurate, maxN, switches, note, footer); bei BYO eigener Optimizer (Gruppen-Menü mit Rollen → `bowlCombos`), renderConfig/renderCard/renderPanel, orderSteps, searchEntries, excludables, validate; gleiches Restaurant auf weiterer Plattform → `exclusionKey` teilen
4. Tests (eigener Restaurant-Abschnitt) → `node tests.js` → Preview (Konsole fehlerfrei, Werte stimmen, 375 px) → CLAUDE.md (Datenquellen, Befunde, Bestellablauf, Defaults) → commit + push
- Such-Index, All/Accurate und Ausschluss-Liste kommen automatisch über die Registry

## Arbeitsweise
- Nach jeder Änderung: `node tests.js` → im Preview prüfen (Konsole fehlerfrei, Werte stimmen) → CLAUDE.md aktualisieren → commit + push → kurze Zusammenfassung auf Deutsch (Werte als Tabelle)
- Sagt der User „nur im Chat" oder „noch nicht einbauen": Vorschläge nur zeigen, nichts ändern
- Entscheidungen des Users mit Datum vermerken („User TT.MM.JJJJ")

## Später (noch nicht gebaut — nicht verbauen)
- Supermarkt-Tab (REWE/Edeka/Aldi/Lidl, per 100 g, Build + Track + eigene Picks sperren): `alaCarteCombos` hat `baseItems` bereits; als Spezial-Tab nach dem Muster von „Add own order"
- Pre-selected Meals
- Carb-Top-up mit Maiswaffeln, Ghee-Top-up (in London als Nachbearbeitung der Ergebnisliste gelöst)

## Entscheidungen (User-Log)
- **User 13.09.2026**: Gerüst nach London-Muster ohne London-Restaurants; Registry statt `resto==="…"`-Ketten; UI Englisch, Doku/Kommentare Deutsch; Plattformen Lieferando/Wolt/Uber Eats je Restaurant; Default-Ziele C85/P65/F20, Kalorien-Modus 450 kcal mit HP+LF; Preview-Port 8421; localStorage-Präfix `fra_`; Schalentier permanent raus (Fisch erlaubt, nur „enthält"); Koriander + Minze nie vorschlagen; „No …"-Schalter AN, „only X"/„must include" AUS; Datenqualitätsregeln (offiziell, keine Schätzungen, raw.json als Quelle, LMIV-Zuordnung); Demo Bistro zum Testen, beim ersten echten Restaurant löschen
- **User 15.09.2026**: Erstes Restaurant **Compleat** (Wolt, Build your Bowl); Nährwerte aus der Compleat-Website (Word-Copy-Paste), kompletter Datensatz auch für Zutaten ohne Wolt (für späteres Uber Eats); Mengen bei Abweichung auf Wolt umrechnen (Salat-Mix 100 g); Schalter „No dip" (Default AN) und „No crunch" (Default AUS; = Nüsse, Röstzwiebeln, Sesam); Ausschluss-Liste für ausverkaufte/ungewollte Dinge; **Bunter Bio Quinoa bleibt im Datensatz, ist im Rechner ausgeschlossen — auch auf künftigen Plattformen**; jede Bowl ≥1 Base + ≥1 Protein; Guacamole (enthält Koriander) normal anbieten
- **User 15.09.2026 (später)**: **Optionales Preislimit** — keine vorgeschlagene Bestellung über dem eingegebenen Maximalpreis (Grundpreis „Build your Bowl" 2 € + Zutatenpreise); **Rechner zusätzlich für Uber Eats** („Selbst zusammenstellen", Grundpreis 1 €, Menü laut User-Liste)
