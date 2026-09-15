# Macro Optimizer Frankfurt (FRA Macros)

## Projektübersicht
Standalone-PWA (eine einzige `index.html`), die Restaurant-Bestellungen in **Frankfurt am Main** auf Makro-Ziele optimiert. Zielplattform: iPhone-Homescreen („Zum Home-Bildschirm" in Safari, Titel **FRA Macros**). Aufbau, Optik und Optimizer-Logik stammen aus dem London-Tool (`C:\Users\theod\OneDrive\Desktop\Bewerbungen\HSBC SA 2026 Zeug\Essen bestellen Claude Tool\`, Repo `theo0202/macro-optimizer`), **ohne** dessen Restaurants, Waitrose, Pre-selected Meals, Corn Cakes, Ghee, Nuss-Toppings und restaurant-spezifische Sonderlogik.

Verbesserung gegenüber London: **eine Restaurant-Registry** (`RESTAURANTS`) statt `resto==="…"`-Ketten. Ein neues Restaurant = Datenblock + ein Registry-Eintrag. Tab, Config-UI, Karten, Detail-Panel, Order Guide, All/Accurate, Such-Index und Ausschluss-Liste entstehen automatisch.

Restaurants (Stand 15.09.2026): **Compleat** (Frankfurt Nordend, Wolt, Build-Your-Own-Bowl). Das Demo Bistro aus dem Gerüst ist entfernt.

## Deployment / Sync
- Live: **https://theo0202.github.io/macro-optimizer-frankfurt/** (Repo `theo0202/macro-optimizer-frankfurt`, public, GitHub Pages aus `main` / Root)
- Nach **jeder getesteten Änderung**: commit (Deutsch) + `git push`. Das iPhone zeigt die neue Version nach ~1 Min + App-Neustart
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (nicht im PATH), User `theo0202`. Git-Identität lokal im Repo: `theo0202 <theo0202@users.noreply.github.com>` (wie London)
- Beim Committen Dateien **explizit** adden (nicht `git add -A`): `Compleat Daten manuell in Word.docx` liegt bewusst unversioniert im Ordner (User-Arbeitsdatei, oft in Word geöffnet/gesperrt; ihr Inhalt steckt als Text in `data/compleat-word.txt`)
- London-Tool und dieses Tool laufen auf derselben Origin `theo0202.github.io` → **alle localStorage-Keys mit Präfix `fra_`**, Zugriff nur über `lsGet`/`lsSet` (tests.js prüft das statisch). Aktuell: `fra_own_order`, `fra_excluded`

## Sprache
- **UI-Strings Englisch** (wie London). Code-Kommentare, CLAUDE.md, Commit-Messages und Antworten an den User: **Deutsch (Du-Form)**
- Produktnamen exakt wie auf der Lieferplattform (nicht übersetzen), z.B. „Sojasoße , 20ml" mit Wolts Leerzeichen

## Tech Stack
- Eine `index.html` mit genau **einem attributlosen Inline-`<script>`** (tests.js findet es per Regex; die Zeichenfolge des Script-Tags darf nirgends im Code/Kommentar stehen)
- React 18.2.0 UMD via cdnjs, `const { useState, useMemo, useEffect, createElement: h } = React;`, kein JSX, kein Bundler, kein Build-Step. Render via `ReactDOM.createRoot`
- Inline-Styles; Fonts DM Sans (UI) + DM Mono (Zahlen/Labels) via Google Fonts
- Tesseract.js 5.1.1 via jsDelivr (`defer`) für den Screenshot-Import
- iPhone: `apple-mobile-web-app-capable` (+ `mobile-web-app-capable`), `black-translucent`, `viewport-fit=cover`, `padding-top: env(safe-area-inset-top)`, SVG-`apple-touch-icon` als data-URI: **rotes Quadrat (#c8102e) mit „FRA"** (London: grün mit „M"), `theme-color` #c8102e, dasselbe SVG als Favicon

## Dev-Umgebung (Windows 11)
- Git Bash + PowerShell; Python nur über `py -3` (pdfplumber, pypdf, openpyxl installiert; **kein** python-docx, **kein** pandoc); Node 24 (globales `fetch`)
- Poppler fehlt → PDFs lassen sich nicht als Bild ansehen: Text/Tabellen mit pdfplumber lesen, eingebettete Bilder mit pypdf extrahieren
- `.docx` lesen: ist ein ZIP → `word/document.xml` per Python `zipfile` + `xml.etree` auslesen. Ist die Datei in Word geöffnet, schlägt normales Öffnen fehl („von einem anderen Prozess verwendet") → vorher kopieren mit `[System.IO.File]::Open(pfad, Open, Read, ReadWrite|Delete)`
- Zeilenenden können CRLF sein (Git `core.autocrlf=true`) → Skript-Edits müssen `\r\n` berücksichtigen (`update-lib.js` übernimmt das Zeilenende der Datei)
- Unsichtbare Zeichen (BOM, NBSP, kombinierende Akzente) in Regexen immer als `\u`-Escape schreiben, nie als Literal
- Lange Heredocs in Git Bash können am Parser scheitern → Hilfsskripte lieber mit dem Write-Tool ins Scratchpad schreiben und dann ausführen
- Tests: `node tests.js`
- Preview: `.claude/launch.json` → „macro-optimizer-frankfurt" (`py -3 -m http.server 8421`; London läuft auf 8321)
- Compleat-Daten neu holen: `node compleat-crawl.js` → `node compleat-update.js` → `node verify-compleat.js` → `node tests.js`

## Datenquellen
| Restaurant | key | Plattform | Quelle | Stand | accurate |
|---|---|---|---|---|---|
| Compleat (Frankfurt Nordend) | `compleat` | Wolt | offizieller Compleat-Onlineshop `compleat.vmos.io` (vmos-API, Werte pro 100 g) + Wolt-API (Menü „Build your Bowl") | 15.09.2026 | ja |

### Regeln für Nährwertdaten (User 13.09.2026)
- Nur **offizielle, verifizierte** Nährwerte, **keine Schätzungen**. Fehlt etwas Wesentliches (z.B. Portionsgewicht bei per-100g-Werten) → Item weglassen und dem User Bescheid geben
- Nur Produkte, die auf der Plattform des Restaurants **bestellbar** sind; Namen exakt wie dort
- `data/<key>-raw.json` ist die **Quelle der Wahrheit**; `_meta` enthält Quelle, Stand, Anomalien (`anomalies`) und Ausschlüsse
- `<key>-update.js` schreibt den Block zwischen `// __<KEY>_DATA_START__` und `// __<KEY>_DATA_END__` in index.html. **Den Block nie von Hand ändern**
- Websites: `<key>-crawl.js`. Zuerst nach eingebettetem JSON bzw. einer API suchen (`__NEXT_DATA__`, `__NUXT__`, XHR im Browser-Netzwerk), erst dann HTML scrapen
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
1. **`node compleat-crawl.js`** (Node-`fetch`, keine Dependencies) holt:
   - **vmos-API** `https://vmos2.vmos.io` mit den Headern `tenant` (Compleat), `store` (Frankfurt Nordend), `menu`, `x-requested-from: online`, `locale` — ohne sie antwortet die API mit HTTP 500 „Please select menu first!". Ablauf: `/catalog/v2/menu` (Menü finden) → `/catalog/v2/menu/categories/skeleton` + `/catalog/categories/{cat}/bundles` (Bundle „Selbst zusammenstellen" finden; beides mit Fallback-UUIDs) → `/catalog/bundles/{bundle}/item-types` (Zutaten: `nutritionalMeta` **pro 100 g/ml**, `defaultQuantity`, Allergen-UUIDs, Zutatenliste, Anzeige-Menge `customizations[0].variations[0].value`) → `/catalog/diets` (offizielle Allergen-Namen inkl. **Krebstiere** und **Weichtiere**)
   - **Wolt-API** `consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/compleat-nordend/assortment` → Item „Build your Bowl" → Optionsgruppen mit `multi_choice_config` (Gruppen-`total_range`; je Option `total_range.max` = maximale Menge, **0 = Häkchen = 1×**; am 15.09.2026 im Wolt-UI per Stepper verifiziert)
   - **Bricht ab** bei unbekannter Wolt-Option (→ `WOLT_MAP` ergänzen), unbekannter Allergen-UUID, fehlender Mengenangabe oder fehlender kuratierter id. Meldet `WOLT_MAP`-Einträge, die Wolt nicht mehr anbietet
   - Kuratierung im Skript: `WOLT_MAP` (Wolt-Name → Zutat-id), `CRUNCH`, `BLOCKED`, `MANUAL_ANOMALIES`
   - Schreibt `data/compleat-raw.json`: `ingredients` (45 Shop-Zutaten: `per100`, `portion`, `perPortion`, Allergene, Zutatentext, `halfPortion`, `vmos.displayAmount`, Flags), `wolt.groups` (Optionen mit Wolt-Name, Zutat, Menge, `maxQty`, Preis), `_meta` (Quellen, Rechenbasis, Wolt-Regeln, Entscheidungen, Mengenabweichungen, Anzeige-Bugs, Anomalien, fehlende Angaben, nicht bei Wolt, Koriander/Minze, Schalentier)
2. **`node compleat-update.js`** → COMPLEAT-Block: `ingredients` (kompletter Datensatz pro 100 g, auch Zutaten ohne Wolt) + `wolt.groups` mit fertigen Portionswerten je Option (pro 100 × Wolt-Menge / 100). **Gesperrte Zutaten werden aus allen Plattform-Menüs weggelassen** (`buildMenu`)
3. **`node verify-compleat.js`** gleicht `data/compleat-word.txt` (Word-Copy-Paste des Users = Anzeige des Shops) gegen die Rohdaten ab: **42 Produkte, 336 Werte, alle identisch** (der Shop rundet wie `Number.toFixed` inkl. Gleitkomma-Effekt, z.B. 0,15 → „0,1"). tests.js führt den Abgleich mit aus

### Compleat: Befunde (Stand 15.09.2026)
- **Rechenbasis**: Shop-Werte pro 100 g × Portion laut Name (= `defaultQuantity`)
- **Anzeige-Bugs im Shop** (Anzeige rechnet mit `variations[0].value` statt Portion; auch das Word-Dokument enthält diese falschen Werte): Walnusskerne 1 g statt 20 g (**7 statt 140,8 kcal**), Röstzwiebeln 18 g statt 20 g (106 statt 118 kcal), Granatapfelkerne 20 g statt 15 g (15 statt 11,1 kcal), Sojasauce 40 ml statt 20 ml (8 statt 4,2 kcal, Salz 5,74 statt 2,87 g). Die App rechnet mit der Portion laut Name
- **Mengen Wolt ↔ Shop**: identisch außer **Salat-Mix** (Wolt 100 g, Shop 80 g → ×1,25; Wolts eigene Bowl-Beschreibungen nennen weiterhin 80 g). Neun Dips/Dressings ohne Mengenangabe bei Wolt → Shop-Portion (80 g; Protein Tzatziki + Guacamole 100 g; Olivenöl 20 ml)
- **Nicht bei Wolt**: Süßkartoffel (250 g), Gemüsemix (100 g) und alle halben Portionen → nur im Datensatz
- **Neu bei Wolt am 15.09.2026**: „Hart gekochtes Ei, 50 g" (Extra) → offizielle Shop-Werte (77,5 kcal, 6,55 g P, 5,6 g F) statt der generischen Tabellenwerte aus dem Word-Dokument
- **Gesperrt**: Bunter Bio Quinoa (siehe Entscheidungen)
- **Anomalien** (unverändert übernommen, in `_meta.anomalies`): Quinoa (130 kcal je 250 g unplausibel niedrig) · Pulled Salmon (6 g Ballaststoffe je 100 g bei „LACHS, Speisesalz, Rauch") · Honey Muscle Mustard (35 g Ballaststoffe je 100 g) · Avocado (kcal passen nicht zu den Makros, 10 von 12,5 g Fett gesättigt) · Edamame (Fett 0, kcal passen nicht) · Olivenöl, Salz & halbe Zitrone (Salz 0) · Chili Gewürz (alles 0). Ballaststoffe nicht angegeben (→ 0): Power Peanut, Sexy Sesame, Sojasauce
- **Fertige Wolt-Bowls** (Classic Bowl, Mango Fire …) sind nicht modelliert: Es sind Build-your-Bowl-Vorlagen (Base/Protein/Dip nach Wahl + feste Extras). Build your Bowl deckt sie ab, bis auf Zutaten, die es nur dort gibt (Kirschtomaten, Tzatziki Gewürz, Joghurt Dressing Zero)

## Restaurant-Registry (`RESTAURANTS` in index.html)
```js
{ key, name, kind:"ac"|"byo", data, gradient:[von,bis], label, platform, accurate, maxN:5, switches:[…], note?, footer? }
```
- `key`: `[a-z][a-z0-9]*`, eindeutig, nicht `search`/`all`/`accurate` · `label`: Mono-Label im Header (GROSSBUCHSTABEN) · `platform`: Lieferando / Wolt / Uber Eats · `accurate:true` = verifizierte offizielle Daten · `note` = Hinweistext in der Config-Karte · `footer` = Fußzeile („Data: …")
- **À la carte (`kind:"ac"`)**: `data = { cats:[{id,name,on,drink?}], items:[{id,name,cat,kcal,fat,sat,carbs,sugars,fibre,protein,salt,…Flags}] }`. `optimizeAC(r,t,mode,p,st,ex)`: Pool = Items der aktiven Kategorien (**nie** `drink:true`, nie ausgeschlossene ids) → aktive `filter`-Schalter → `require`-Schalter als `resultFilter` → `alaCarteCombos`. Config-UI, Karte, Panel und Order Guide werden generisch gerendert
- **Schalter** (deklarativ): `{ id, label, def, filter?(item), require?(items), overridesCats?, group?, inAll?, hint? }`
  - `filter` wirkt auf den Pool (bei BYO auf die Menü-Optionen) · `require` wirkt aufs Ergebnis („must include X")
  - `overridesCats` = restriktiver „only X"-Modus, ignoriert die Kategorie-Chips (andere aktive Filter wirken weiter; die UI dimmt die Chips und nennt den Schalter)
  - `group` = UI-exklusiv (`toggleSwitch`: einer an → die anderen derselben Gruppe aus)
  - `inAll` = Wert in All/Accurate (Default: `def`) · `hint` = kursiver Erklärtext unter dem Schalter
- **Build-Your-Own (`kind:"byo"`)** — Pflicht-Methoden:
  - `optimize(t, mode, p, st, ex, r)` → sortierte Ergebnisse, max 20, je `{items | key, nutrition, score}` — **`isShellfish` im eigenen Pool anwenden**, `ex` = Set ausgeschlossener ids
  - `renderConfig(ctx)` · `renderCard(res, ctx)` (nutzt `ctx.selected` / `ctx.onSelect`) · `renderPanel(sel, ctx)` (nur der Mittelteil: Titel, MacroBars und Order Guide rendert die App) · `orderSteps(sel)` → `[{l, v}]` · `searchEntries()` → Items für den Such-Index
  - optional: `summary(res)`, `panelSubtitle(sel)`, `inputHint(st)`, `initState()` → `st.extra`, `excludables()` → `[{id, name, group}]`, `validate()` → Datenprobleme (von `validateRegistry` gemeldet)
  - `ctx = {R, st, tg, targets, mode, prefs, selKey, toggleSel, update}`
  - Für Gruppen-Menüs (base/protein/extra/dip) gibt es die generische Engine `bowlCombos` + Renderer `bowlConfigCard`/`bowlCard`/`bowlPanel`, Helfer `bowlSummary`/`bowlOrderSteps`/`bowlSearchEntries`/`bowlExcludables`/`bowlValidate`/`switchPass` (Vorlage: Compleat)
- **State** pro Restaurant: `rs[key] = {cats, maxN, sw, sel, extra}` (`defaultRestoState`), bleibt beim Tab-Wechsel erhalten; die Ziele sind global. Ergebnisse werden nur für den aktiven Tab gerechnet (`sel` ist bewusst keine Memo-Abhängigkeit)
- Die ausgewählte Karte wird über den stabilen Key `resultKey` markiert (sortierte Item-IDs bzw. BYO-`key`), auch nach Neuberechnung und beim Sprung aus All/Accurate
- Spezial-Tabs (`SPECIAL_TABS`: search / accurate / all) sind **keine** Registry-Einträge. Restaurant-Blöcke rendern nur, wenn `RESTO_BY_KEY[tab]` existiert
- `validateRegistry(restos)` prüft Keys, Pflichtfelder, Schalter (Wirkung, Gruppen), Kategorien, eindeutige Item-ids, 8 numerische Makros und `r.validate()`; tests.js erwartet `[]`
- **Keine Restaurant-Sonderlogik per Tab-Vergleich** im App-Code (tests.js prüft, dass kein `==="<registry-key>"` vorkommt)

## Bestellabläufe (je Restaurant)
### Compleat (`compleat`, Wolt, Build your Bowl)
- Wolt-Item **„Build your Bowl"** (Compleat Nordend, Glauburgstraße 5):
  - **Deine Basis** 0–5 Portionen: Basmatireis, 250 g · Salat-Mix, 100 g · (Bunter Quinoa, 250 g — gesperrt) je per Stepper bis 4× · Protein Nudeln, 200 g 1×
  - **Deine Proteine** 0–10 Portionen: Hähnchen, 100 g · Veganes Hähnchen, 80 g · Vegane Hackbällchen, 100 g · Rinderhackbällchen, 100 g je per Stepper bis 10× · Pulled Salmon, 100 g 1×
  - **Deine Extras** 0–30, je 1× (Häkchen): die vier Proteine erneut + Hart gekochtes Ei, Erbsen, Babyspinat, Tomaten, Edamame, Brokkoli, Avocado, Karotten, Mais, Gurken, Mango, Feta, Rote Beete-Falafel, Rotkohl, Schwarzer Sesam, Granatapfelkerne, Erdnüsse, Walnusskerne, Röstzwiebeln, Chili Gewürz, Grana Padano
  - **Dein Dip** genau 1: 13 Dips/Dressings oder „Ohne Dip"
- Regeln im Tool: **jede Bowl ≥1 Base + ≥1 Protein** (User 15.09.2026), Dip 0 oder 1, Proteine laufen nur über „Deine Proteine" (Stepper; die Duplikate unter Extras werden nicht genutzt), Quinoa nie
- Config-Karte: **„Max. extras per bowl"** 0/1/2/3/4/5/6 (Default 5) · **„Max. portions of the same base / protein"** 1/2/3/4 (Default 2; zusätzlich gelten Wolts Grenzen) · Hinweistext
- Schalter: **„No dip"** (Default **AN**) · **„No crunch"** (Default **AUS**, blendet Erdnüsse, Walnusskerne, Röstzwiebeln, Schwarzer Sesam aus)
- Order Guide (Wolt), eine Zeile je Gruppe: `Item: Build your Bowl` → `Deine Basis: 1× Basmatireis, 250 g · 1× Salat-Mix, 100 g` → `Deine Proteine: 2× Hähnchen, 100 g` → `Deine Extras: Edamame, 50 g · Walnusskerne, 20 g` (ohne Menge = Häkchen) → `Dein Dip: Ohne Dip`
- Karte: Kurzname („Basmatireis + 2× Hähnchen + Edamame"), Unterzeile „Build your Bowl · 1 base · 2 protein · 4 extras · no dip"; Panel: Komponenten je Wolt-Gruppe mit kcal + Protein

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
- **Compleat**: Guacamole enthält laut Zutatenliste Koriander (kleiner Anteil) → **normal anbieten** (User 15.09.2026). Protein Tzatziki: Petersilie + Dill, keine Minze. Joghurt-Salatdressing und Honey Muscle Mustard: nur „Kräuter" (nicht spezifiziert). Der Crawl listet Treffer in `_meta.dislikes`

## Schalter-Defaults (User 13.09.2026)
- „No …"-Schalter (Exclude-Filter) starten **AN** — **Ausnahme: Compleat „No crunch" startet AUS** (User 15.09.2026)
- Restriktive „only X"- und „must include"-Modi starten **AUS**, außer der User sagt etwas anderes
- Pro `group` höchstens ein Schalter mit `def:true` (und höchstens einer mit `inAll`), sonst meldet `validateRegistry` einen Fehler

## Standard-Defaults (beim App-Start)
- Makro-Ziele: Carbs **85 g**, Protein **65 g**, Fat **20 g** (≈ 780 kcal); Kalorien-Modus: **450 kcal** mit **High Protein + Low Fat**
- Modus „Enter macros"; Sort by „Score"
- Start-Tab: erstes Registry-Restaurant (`DEFAULT_TAB` = Compleat)
- À la carte: Max. items per order **5**; All/Accurate-Chip **5**
- Compleat: No dip AN, No crunch AUS, max. 5 Extras, max. 2 Portionen je Base/Protein, Ausschluss-Liste leer

## UI-Reihenfolge (wie London)
1. Header: Gradient je Tab, Mono-Label in Großbuchstaben, „Macro Optimizer", „Find the optimal order for your goals", dekorativer Kreis
2. Modus-Buttons „Enter macros" | „Calories + preferences"
3. „📷 Import from screenshot"
4. Eingabekarte (Carbs/Protein/Fat + „≈ X kcal · <Hinweis>" bzw. kcal + Präferenz-Chips), darunter aufklappbar „Fibre / Salt ▾" (Min/Max)
5. Tab-Zeile (`flexWrap`, `btn`-Style): **➕ Add own order · Accurate restaurants · All restaurants**, danach die Registry-Restaurants
6. All/Accurate: Karte „Max. items per order" (bzw. Hinweiskarte, wenn keine Restaurants) · Restaurant: Config-Karte (à la carte: Kategorie-Chips · Max. items · `note`; BYO: `renderConfig`) · Schalter-Zeile · **Ausschluss-Karte „Exclude items"**
7. „Top results" mit Sort-Chips (Score / Calories / Carbs / Protein / Fat; C/P/F nur im Makro-Modus), 20 berechnet / 8 angezeigt; leere Liste → Hinweis
8. Detail-Panel nach Klick: MacroBars mit Delta zum Ziel (kcal #4ade80, Carbs #fbbf24, Protein #60a5fa, Fat #f87171, Fibre #a78bfa, Salt #94a3b8; Fibre-Ziel = Fibre Min, Salt-Ziel = Salt Max) → Aufschlüsselung (à la carte „Items", BYO je Gruppe) → „📋 Order guide (<Plattform>)" nummeriert mit Mengen
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
- **Aufgabe**: Bowls aus Gruppen-Menüs (Basis / Proteine / Extras / Dip) — je Bowl **≥1 Base + ≥1 Protein**, höchstens ein Dip, Extras je 1× und höchstens `maxExtras`, je Base-/Protein-Option höchstens `cap` Portionen (Portionen-Chip) und Wolts `maxQty`, dazu die Gruppen-Maxima. Proteine, die Wolt zusätzlich unter „Extras" führt, laufen nur über die Protein-Gruppe. Extras ohne Nährwerte (Chili Gewürz) fallen weg (sonst Doppel-Ergebnisse). `keep(option)` bündelt Schalter, Ausschlüsse und Sperren; `isShellfish` greift immer
- **Exakt statt heuristisch**: Die Rangliste der 30 besten Roh-Scores ist **identisch mit der vollständigen Durchrechnung** — im Makro-Modus und im Kalorien-Modus mit und ohne Präferenzen. Danach wie überall: Nährwerte über `sumN` runden → Score neu → Top 20 → 8 angezeigt
- **Teil 1 — Kern** (Base-/Protein-Portionen + Dip): Start je 1 Base × 1 Protein, Erweiterung in fester Reihenfolge (jede Kombination genau einmal)
  - *Makro-Modus / Kalorien ohne Präferenzen*: Der Score ist je Nährwert konvex und alle Beiträge sind ≥ 0 → der Nutzen eines Zusatzes ist bei einer kleineren Bowl nie kleiner als bei einer größeren. Erweitert wird nur um **verbessernde** Zusätze (findet das Optimum). Jede übersprungene Bowl ist höchstens so gut wie dieselbe Bowl ohne die nutzlose Portion und wird am Ende **nachgetragen**: zu jeder Ranglisten-Bowl einzeln jede erlaubte Kern-Portion ergänzen, bis nichts Neues mehr in die Rangliste kommt. Zweige mit schon überschrittenen Zielen fallen weg (`bowlOverLB`)
  - *Kalorien-Modus mit Präferenzen* (Energieanteile → nicht konvex): alle Kerne, abgeschnitten über `bowlShareLB`. Präferenz-Term = L / kcal mit L = ap·4·P + ac·4·C + af·9·F (`bowlShareL`). Jeder Baustein hat L ≥ rho·kcal (rho = kleinstes Verhältnis aller Bausteine) → Untergrenze = Minimum von 4·|K − Ziel|/Ziel + rho + (L_Kern − rho·kcal_Kern)/K über K ≥ kcal_Kern (geschlossen lösbar, 3 Kandidaten) plus schon überschrittene Fibre-/Salz-Maxima
- **Teil 2 — Extras je Kern**: alle Extras-Teilmengen (≤ max. Extras) als Punkte in einem k-d-Baum (`bowlIndex`: Quickselect, Blätter ≤ 8, höchstens 30 Extras wegen Bitmaske), Cache `BOWL_INDEX_CACHE` je erlaubter Extras-Liste (max. 8 Einträge). Branch & Bound mit der Box-Untergrenze `bowlBoxLB` findet exakt alle Ergänzungen unter der Ranglisten-Schwelle
- `scoreVec` = `score` in Vektorform für die inneren Schleifen; `opts.raw: true` liefert die ungerundete Rangliste `[{key, rawScore}]` (Tests, Benchmark)
- **Geprüft**: tests.js (Test-Menü + Compleat inkl. Dips, beide Modi, Untergrenzen im Zufallstest) · Benchmark gegen die vollständige Durchrechnung (3 Konfigurationen × 67 Ziele: 32 Makro, 6 Kalorien ohne, 29 mit Präferenzen): Optimum und Top 30 **überall identisch** · Laufzeit (Node): erster Aufruf inkl. Index-Aufbau 27–36 ms, danach Median 0,3–1,6 ms, max. 8,5 ms (Dips an, 4 Portionen, 6 Extras)
- **Verworfen** (15.09.2026): Beam-Suche (Optimum nur in 22–25 von 37 Fällen) · Tiefensuche mit Branch & Bound über alles (exakt, aber bis 4,4 s mit Dips) · „nur verbessernde Zusätze" auch im Kalorien-Modus mit Präferenzen (Optimum 51/53, Top 30 nur ~39/53) · Makro-Modus ohne Nachtragen (in 2 von 34 geprüften Zielen fehlten bis zu 10 Bowls der Top 30, teils auf Rang 2–3)

### „All restaurants" / „Accurate restaurants" (`optimizeAll(t, mode, p, maxN, onlyAccurate, restos?, exclMap?)`)
Jedes Restaurant läuft mit Default-Kategorien, `inAll`-Schalterwerten, dem Max-Items-Chip (`allState`) und seiner **Ausschluss-Liste**. **Max. 1 Treffer pro Restaurant** (dessen bestes Ergebnis), nach Score sortiert, Top 20 → 8 angezeigt. Accurate = nur `accurate:true` (leer → Hinweiskarte). Karte mit Restaurant-Badge + Kurz-Zusammenfassung; Klick (`selectAcross`) wechselt in den Restaurant-Tab und öffnet das Ergebnis dort.

## Ausschluss-Liste „Exclude items" (User 15.09.2026)
- Für **jedes** Registry-Restaurant: Dinge, die ausverkauft sind oder auf die man keine Lust hat, suchen (umlaut-tolerant, `matchesQuery`) und antippen → der Optimizer ignoriert sie, bis sie wieder entfernt werden
- Gilt im Restaurant-Tab **und** in All/Accurate. Gespeichert je Restaurant in **`fra_excluded`** (`{ [key]: [ids] }`)
- Was ausschließbar ist, liefert `excludablesFor(r)`: à la carte = Items (ohne Getränke/Schalentier), BYO = `r.excludables()` (Compleat: je Zutat ein Eintrag, gilt für alle Wolt-Gruppen, in denen sie vorkommt; gesperrte Zutaten erscheinen nicht)
- UI: Karte unter der Schalter-Zeile, aktive Ausschlüsse als rote Chips mit ✕ + „Clear", „Add ▾" öffnet Suchfeld + Chips (max. 40, sonst „type to search")

## „Add own order" (`tab==="search"`), kein Optimizer
- `SEARCH_INDEX = buildSearchIndex(RESTAURANTS)` entsteht automatisch aus der Registry (AC: `data.items` inkl. Drinks; BYO: `searchEntries()` — Compleat: jede Wolt-Option einmal mit Wolt-Name, ohne Quinoa), Schalentier raus, Dedup über `resto|name|kcal`
- `searchItems(query, limit=60, index?)`: alle Begriffe müssen in Name + Restaurant vorkommen, kürzester Name zuerst, **umlaut-tolerant** (`foldVariants`: ä→ae **und** ä→a, ö/ü analog, ß→ss, Akzente weg)
- Trefferliste: kcal ganzzahlig, P/C/F auf 1 Dezimale gerundet (BYO-Optionen haben intern 2 Dezimalen)
- „+ Add" → Warenkorb mit −/+/✕ (gleicher Eintrag → Menge +1), gespeichert in **`fra_own_order`**. Einträge speichern die vollen Makros und überleben Registry-Änderungen
- „Order total"-Karte mit MacroBars gegen die Ziele (`orderTotal`). Header #475569→#1e293b, Label „ADD OWN ORDER · TRACK"

## Design
- Dark Mode: Hintergrund #0d0d0d, Text #e0e0e0; Akzent #009743 / #4ade80; Karten #151515, Radius 12, Border #222
- Header-Gradients: Add own order #475569→#1e293b · All #7c3aed→#4c1d95 · Accurate #0284c7→#0c4a6e · **Compleat #d7192d→#6b0f1a** · weitere Restaurants über `gradient` in der Registry
- Fonts DM Sans / DM Mono; touch-freundliche Buttons; safe-area-inset
- Homescreen-Icon rot (#c8102e) mit „FRA", bewusst anders als London (grün „M")

## Tests (`node tests.js`)
- Harness wie London: Inline-Script per Regex laden, React/ReactDOM/document/localStorage stubben, indirektes `eval`, Funktionen an `globalThis.__t`
- `check(name, actual, expected)`: Zahlen mit Toleranz 0.05, Booleans mit `===`, **Strings immer als `check(name, a === b, true)`**. Am Ende „Alle Tests bestanden", sonst Exit-Code 1
- Abgedeckt (278 Tests, Stand 15.09.2026): Struktur (1 Inline-Script, `fra_`-Präfix, keine Registry-Key-Vergleiche, Demo entfernt), sumN, score + scoreVec, sortResults, alaCarteCombos, isShellfish, Registry + validateRegistry (inkl. `r.validate`), optimizeAC mit Test-Restaurant (inkl. Ausschlüssen), BYO-Stub, optimizeAll (inkl. Ausschlüsse), SEARCH_INDEX/searchItems/matchesQuery, orderTotal, Bowl-Engine am Test-Menü (Regeln, Deckel, Schalentier, Nullwert-Extras, `opts.raw`, **Top 30 = vollständige Durchrechnung im Makro- und Kalorien-Modus**), Untergrenzen `bowlShareLB`/`bowlOverLB` (je 700 Zufallsfälle), **Compleat-Daten** (Block = Rohdaten, Portionen, Anzeige-Bugs, Sperre, Crunch, Anomalien, Word-Abgleich), **Compleat-Optimizer** (Pflichtteile, Schalter, Ausschlüsse, Chips, **Top 30 = vollständige Durchrechnung in beiden Modi inkl. Dips**, Order Guide, Suche), parseMacroScreenshot (London-Fälle), update-lib.js

## Dateistruktur
```
Restaurant Tracker Frankfurt Claude/
├── index.html              ← Die PWA (alles in einer Datei: Registry + generierte Datenblöcke)
├── CLAUDE.md               ← Diese Datei
├── tests.js                ← Logik-Tests (node tests.js)
├── update-lib.js           ← Gemeinsame Helfer für <key>-update.js (LMIV, Plausibilität, Marker-Block)
├── compleat-crawl.js       ← Compleat: Shop-API (vmos) + Wolt-API → data/compleat-raw.json (Kuratierung: WOLT_MAP, CRUNCH, BLOCKED, MANUAL_ANOMALIES)
├── compleat-update.js      ← Compleat: data/compleat-raw.json → COMPLEAT-Block (buildMenu lässt gesperrte Zutaten weg)
├── verify-compleat.js      ← Compleat: Abgleich Word-Export ↔ nachgerechnete Shop-Anzeige
├── Compleat Daten manuell in Word.docx  ← User-Arbeitsdatei (unversioniert)
├── .gitignore
├── .claude/launch.json     ← Preview „macro-optimizer-frankfurt" (Port 8421)
└── data/
    ├── compleat-raw.json   ← Compleat-Datensatz (Quelle der Wahrheit, vom Crawl erzeugt)
    └── compleat-word.txt   ← Text-Export des Word-Dokuments (Kontrollquelle)
```

## Checkliste „Neues Restaurant"
1. Kurz beim User erfragen, was fehlt: **Plattform**, **Bestellmodell** (à la carte oder Build-Your-Own mit Schritten), **Schalter**, **Default-Kategorien**, **Nährwertquelle**. Plattform-Menü möglichst direkt aus der Plattform-API lesen (Wolt: consumer-assortment, siehe Compleat) statt abzutippen
2. Quelle prüfen (offiziell? aktuell? auf der Plattform bestellbar?) → `data/<key>-raw.json` (per `<key>-crawl.js` / Extract; Kuratierung als Tabellen im Skript) → `<key>-update.js` (Helfer aus `update-lib.js`). Marker `// __<KEY>_DATA_START__` / `// __<KEY>_DATA_END__` im Datenbereich von index.html einsetzen, dann das Skript laufen lassen. Anomalien, Ausschlüsse, Mengenabweichungen, Schalentier (Allergen-Legende!) und Koriander/Minze im Chat melden
3. Registry-Eintrag anlegen (key, name, kind, data, gradient, label, platform, accurate, maxN, switches, note, footer); bei BYO eigener Optimizer (Gruppen-Menü → `bowlCombos`), renderConfig/renderCard/renderPanel, orderSteps, searchEntries, excludables, validate
4. Tests (eigener Restaurant-Abschnitt) → `node tests.js` → Preview (Konsole fehlerfrei, Werte stimmen) → CLAUDE.md (Datenquellen, Befunde, Bestellablauf, Defaults) → commit + push
- Such-Index, All/Accurate und Ausschluss-Liste kommen automatisch über die Registry

## Arbeitsweise
- Nach jeder Änderung: `node tests.js` → im Preview prüfen (Konsole fehlerfrei, Werte stimmen) → CLAUDE.md aktualisieren → commit + push → kurze Zusammenfassung auf Deutsch (Werte als Tabelle)
- Sagt der User „nur im Chat" oder „noch nicht einbauen": Vorschläge nur zeigen, nichts ändern
- Entscheidungen des Users mit Datum vermerken („User TT.MM.JJJJ")

## Später (noch nicht gebaut — nicht verbauen)
- **Compleat über Uber Eats**: `compleat-crawl.js` um das Uber-Eats-Menü erweitern (`raw.ubereats` mit Gruppen/Optionen → Zutat-ids), `compleat-update.js` mit `buildMenu(raw, "ubereats")` in den Block schreiben, zweiter Registry-Eintrag (eigener key, `platform:"Uber Eats"`) mit `bowlCombos` auf `COMPLEAT.ubereats`. **Bunter Bio Quinoa bleibt gesperrt** (`COMPLEAT_BLOCKED`, `buildMenu`). Der komplette Zutaten-Datensatz ist dafür schon im Block
- Supermarkt-Tab (REWE/Edeka/Aldi/Lidl, per 100 g, Build + Track + eigene Picks sperren): `alaCarteCombos` hat `baseItems` bereits; als Spezial-Tab nach dem Muster von „Add own order"
- Pre-selected Meals
- Carb-Top-up mit Maiswaffeln, Ghee-Top-up (in London als Nachbearbeitung der Ergebnisliste gelöst)

## Entscheidungen (User-Log)
- **User 13.09.2026**: Gerüst nach London-Muster ohne London-Restaurants; Registry statt `resto==="…"`-Ketten; UI Englisch, Doku/Kommentare Deutsch; Plattformen Lieferando/Wolt/Uber Eats je Restaurant; Default-Ziele C85/P65/F20, Kalorien-Modus 450 kcal mit HP+LF; Preview-Port 8421; localStorage-Präfix `fra_`; Schalentier permanent raus (Fisch erlaubt, nur „enthält"); Koriander + Minze nie vorschlagen; „No …"-Schalter AN, „only X"/„must include" AUS; Datenqualitätsregeln (offiziell, keine Schätzungen, raw.json als Quelle, LMIV-Zuordnung); Demo Bistro zum Testen, beim ersten echten Restaurant löschen
- **User 15.09.2026**: Erstes Restaurant **Compleat** (Wolt, Build your Bowl); Nährwerte aus der Compleat-Website (Word-Copy-Paste), kompletter Datensatz auch für Zutaten ohne Wolt (für späteres Uber Eats); Mengen bei Abweichung auf Wolt umrechnen (Salat-Mix 100 g); Schalter „No dip" (Default AN) und „No crunch" (Default AUS; = Nüsse, Röstzwiebeln, Sesam); Ausschluss-Liste für ausverkaufte/ungewollte Dinge; **Bunter Bio Quinoa bleibt im Datensatz, ist im Rechner ausgeschlossen — auch auf künftigen Plattformen**; jede Bowl ≥1 Base + ≥1 Protein; Guacamole (enthält Koriander) normal anbieten
