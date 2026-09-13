# Macro Optimizer Frankfurt (FRA Macros)

## Projektübersicht
Standalone-PWA (eine einzige `index.html`), die Restaurant-Bestellungen in **Frankfurt am Main** auf Makro-Ziele optimiert. Zielplattform: iPhone-Homescreen („Zum Home-Bildschirm" in Safari, Titel **FRA Macros**). Aufbau, Optik und Optimizer-Logik stammen aus dem London-Tool (`C:\Users\theod\OneDrive\Desktop\Bewerbungen\HSBC SA 2026 Zeug\Essen bestellen Claude Tool\`, Repo `theo0202/macro-optimizer`), **ohne** dessen Restaurants, Waitrose, Pre-selected Meals, Corn Cakes, Ghee, Nuss-Toppings und restaurant-spezifische Sonderlogik.

Verbesserung gegenüber London: **eine Restaurant-Registry** (`RESTAURANTS`) statt `resto==="…"`-Ketten. Ein neues Restaurant = Datenblock + ein Registry-Eintrag. Tab, Config-UI, Karten, Detail-Panel, Order Guide, All/Accurate und Such-Index entstehen automatisch.

Stand 13.09.2026: Gerüst + **Demo Bistro** (fiktiv, zum Testen). Echte Restaurants folgen einzeln (Checkliste unten).

## Deployment / Sync
- Live: **https://theo0202.github.io/macro-optimizer-frankfurt/** (Repo `theo0202/macro-optimizer-frankfurt`, public, GitHub Pages aus `main` / Root)
- Nach **jeder getesteten Änderung**: commit (Deutsch) + `git push`. Das iPhone zeigt die neue Version nach ~1 Min + App-Neustart
- GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (nicht im PATH), User `theo0202`. Git-Identität lokal im Repo: `theo0202 <theo0202@users.noreply.github.com>` (wie London)
- London-Tool und dieses Tool laufen auf derselben Origin `theo0202.github.io` → **alle localStorage-Keys mit Präfix `fra_`**, Zugriff nur über `lsGet`/`lsSet` (tests.js prüft das statisch)

## Sprache
- **UI-Strings Englisch** (wie London). Code-Kommentare, CLAUDE.md, Commit-Messages und Antworten an den User: **Deutsch (Du-Form)**
- Produktnamen exakt wie auf der Lieferplattform (nicht übersetzen)

## Tech Stack
- Eine `index.html` mit genau **einem attributlosen Inline-`<script>`** (tests.js findet es per Regex; die Zeichenfolge des Script-Tags darf nirgends im Code/Kommentar stehen)
- React 18.2.0 UMD via cdnjs, `const { useState, useMemo, useEffect, createElement: h } = React;`, kein JSX, kein Bundler, kein Build-Step. Render via `ReactDOM.createRoot`
- Inline-Styles; Fonts DM Sans (UI) + DM Mono (Zahlen/Labels) via Google Fonts
- Tesseract.js 5.1.1 via jsDelivr (`defer`) für den Screenshot-Import
- iPhone: `apple-mobile-web-app-capable` (+ `mobile-web-app-capable`), `black-translucent`, `viewport-fit=cover`, `padding-top: env(safe-area-inset-top)`, SVG-`apple-touch-icon` als data-URI: **rotes Quadrat (#c8102e) mit „FRA"** (London: grün mit „M"), `theme-color` #c8102e, dasselbe SVG als Favicon

## Dev-Umgebung (Windows 11)
- Git Bash + PowerShell; Python nur über `py -3` (pdfplumber, pypdf, openpyxl installiert); Node vorhanden
- Poppler fehlt → PDFs lassen sich nicht als Bild ansehen: Text/Tabellen mit pdfplumber lesen, eingebettete Bilder mit pypdf extrahieren
- Zeilenenden können CRLF sein (Git `core.autocrlf=true`) → Skript-Edits müssen `\r\n` berücksichtigen (`update-lib.js` übernimmt das Zeilenende der Datei)
- Unsichtbare Zeichen (BOM, NBSP, kombinierende Akzente) in Regexen immer als `\u`-Escape schreiben, nie als Literal
- Tests: `node tests.js`
- Preview: `.claude/launch.json` → „macro-optimizer-frankfurt" (`py -3 -m http.server 8421`; London läuft auf 8321)
- Datenblock neu erzeugen: `node <key>-update.js` (aktuell nur `node demo-update.js`)

## Datenquellen
| Restaurant | key | Plattform | Quelle | Stand | accurate |
|---|---|---|---|---|---|
| Demo Bistro | `demo` | Wolt | **fiktiv** (`data/demo-raw.json`) | 13.09.2026 | nein |

### Regeln für Nährwertdaten (User 13.09.2026)
- Nur **offizielle, verifizierte** Nährwerte, **keine Schätzungen**. Fehlt etwas Wesentliches (z.B. Portionsgewicht bei per-100g-Werten) → Item weglassen und dem User Bescheid geben
- Nur Produkte, die auf der Plattform des Restaurants **bestellbar** sind; Namen exakt wie dort
- `data/<key>-raw.json` ist die **Quelle der Wahrheit**; `_meta` enthält Quelle, Stand, Anomalien (`anomalies`) und Ausschlüsse (`exclusions`)
- `<key>-update.js` schreibt den Block zwischen `// __<KEY>_DATA_START__` und `// __<KEY>_DATA_END__` in index.html. **Den Block nie von Hand ändern**
- Websites: `<key>-crawl.js`. Zuerst nach eingebettetem JSON suchen (`__NEXT_DATA__`, `__NUXT__`, API), erst dann HTML scrapen
- Aktualität der Quelle prüfen (Last-Modified, Stichprobe gegen die Live-Seite). Die Live-Seite schlägt Dritt-Datenbanken (OpenFoodFacts, FatSecret)
- Plausibilitäts-Check je Item: kcal ≈ 4·C + 4·P + 9·F, sat ≤ fat, sugars ≤ carbs. Auffälligkeiten **nicht still korrigieren**, sondern in `_meta.anomalies` dokumentieren und dem User nennen (`reportAnomalies` druckt undokumentierte laut aus)
- Beim Entfernen von Items prüfen, ob sie anderswo verwendet werden, und Nebenwirkungen melden

### Deutsche Nährwerttabellen (LMIV)
- Energie → `kcal` (nicht kJ) · Fett → `fat` · davon gesättigte Fettsäuren → `sat` · Kohlenhydrate → `carbs` · davon Zucker → `sugars` · Ballaststoffe → `fibre` · Eiweiß → `protein` · Salz → `salt`
- Ballaststoffe sind freiwillig: fehlen sie → 0 eintragen und in `_meta` dokumentieren
- Nur Natrium angegeben → Salz = Natrium × 2,5 (`saltFromSodium`, Eingabe in g)
- „12,5" → 12.5 · Tausenderpunkt („1.234" → 1234) · „<0,5" → 0.5 · „-" → 0 (`parseNum`; Leeres/Unlesbares wirft einen Fehler statt still 0)
- per-100g-Werte mit dem Portionsgewicht umrechnen (`scalePer100`; ohne Gewicht → Fehler)

### update-lib.js (gemeinsame Helfer für alle Update-Skripte)
`parseNum`, `saltFromSodium`, `scalePer100`, `slugId` (ASCII-ids, ä→ae …), `checkItem` / `reportAnomalies` (Plausibilität), `buildAcItems` (Rohdaten → Block-Items mit Kategorie-Check und booleschen Flags), `acDataLines`, `wrapBlock`, `replaceBlock` / `writeBlock` (CRLF-sicher, `$` im Inhalt bleibt wörtlich). Vorlage für ein à-la-carte-Update-Skript: `demo-update.js`.

## Restaurant-Registry (`RESTAURANTS` in index.html)
```js
{ key, name, kind:"ac"|"byo", data, gradient:[von,bis], label, platform, accurate, maxN:5, switches:[…], note?, footer? }
```
- `key`: `[a-z][a-z0-9]*`, eindeutig, nicht `search`/`all`/`accurate` · `label`: Mono-Label im Header (GROSSBUCHSTABEN) · `platform`: Lieferando / Wolt / Uber Eats · `accurate:true` = verifizierte offizielle Daten (erscheint in „Accurate restaurants") · `note` = Hinweistext in der Config-Karte · `footer` = Fußzeile („Data: …")
- **À la carte (`kind:"ac"`)**: `data = { cats:[{id,name,on,drink?}], items:[{id,name,cat,kcal,fat,sat,carbs,sugars,fibre,protein,salt,…Flags}] }`. `optimizeAC(r,t,mode,p,st)`: Pool = Items der aktiven Kategorien (**nie** `drink:true`) → aktive `filter`-Schalter → `require`-Schalter als `resultFilter` → `alaCarteCombos`. Config-UI, Karte, Panel und Order Guide werden generisch gerendert
- **Schalter** (deklarativ): `{ id, label, def, filter?(item), require?(items), overridesCats?, group?, inAll?, hint? }`
  - `filter` wirkt auf den Pool · `require` wirkt aufs Ergebnis („must include X")
  - `overridesCats` = restriktiver „only X"-Modus, ignoriert die Kategorie-Chips (andere aktive Filter wirken weiter; die UI dimmt die Chips und nennt den Schalter)
  - `group` = UI-exklusiv (`toggleSwitch`: einer an → die anderen derselben Gruppe aus)
  - `inAll` = Wert in All/Accurate (Default: `def`) · `hint` = kursiver Erklärtext unter dem Schalter
- **Build-Your-Own (`kind:"byo"`)** — Schnittstelle vorbereitet, noch kein Restaurant. Pflicht-Methoden:
  - `optimize(t, mode, p, st)` → sortierte Ergebnisse, max 20, je `{items | key, nutrition, score}` — **`isShellfish` im eigenen Pool anwenden**
  - `renderConfig(ctx)` · `renderCard(res, ctx)` (nutzt `ctx.selected` / `ctx.onSelect`) · `renderPanel(sel, ctx)` (nur der Mittelteil: Titel, MacroBars und Order Guide rendert die App) · `orderSteps(sel)` → `[{l, v}]` · `searchEntries()` → Items für den Such-Index
  - optional: `summary(res)` (Kurztext für Titel/All-Karten), `panelSubtitle(sel)`, `inputHint(st)`, `initState()` → `st.extra`
  - `ctx = {R, st, tg, targets, mode, prefs, selKey, toggleSel, update}`
- **State** pro Restaurant: `rs[key] = {cats, maxN, sw, sel, extra}` (`defaultRestoState`), bleibt beim Tab-Wechsel erhalten; die Ziele sind global. Ergebnisse werden nur für den aktiven Tab gerechnet (`sel` ist bewusst keine Memo-Abhängigkeit)
- Die ausgewählte Karte wird über den stabilen Key `resultKey` markiert (sortierte Item-IDs bzw. BYO-`key`), das funktioniert auch nach Neuberechnung und beim Sprung aus All/Accurate
- Spezial-Tabs (`SPECIAL_TABS`: search / accurate / all) sind **keine** Registry-Einträge. Restaurant-Blöcke rendern nur, wenn `RESTO_BY_KEY[tab]` existiert
- `validateRegistry(restos)` prüft Keys, Pflichtfelder, Schalter (Wirkung, Gruppen), Kategorien, eindeutige Item-ids und 8 numerische Makros; tests.js erwartet `[]`
- **Keine Restaurant-Sonderlogik per Tab-Vergleich** im App-Code (tests.js prüft, dass kein `==="<registry-key>"` vorkommt)

## Bestellabläufe (je Restaurant)
### Demo Bistro (`demo`, Wolt, à la carte) — FIKTIV, beim ersten echten Restaurant löschen
- 3 Kategorien: Bowls, Sides, Drinks (`drink:true` → nie im Optimizer, aber im Such-Index)
- 9 Items, kcal = 4·C + 4·P + 9·F exakt; „Joghurt-Dip" = `sauce:true`; **„Garnelen Bowl" fällt durch den Schalentier-Filter immer raus** (Optimizer, All, Suche)
- Schalter: „No sauce" (**AN**), „Only bowls" (`overridesCats`, AUS) und „Must include a side" (`require`, AUS). Die beiden letzten bilden die Gruppe `demoMode` (UI-exklusiv) und zeigen `overridesCats`/`require`/`group` im Preview
- Order Guide (Wolt): Stückliste mit Mengen („1× Hähnchen Bowl", „2× Edamame")
- **Löschen beim ersten echten Restaurant**: Registry-Eintrag + DEMO-Datenblock in index.html, `data/demo-raw.json`, `demo-update.js` (vorher als Vorlage kopieren), Demo-Abschnitt in tests.js, Zeile in „Datenquellen" und dieser Abschnitt

## Permanenter Schalentier-Ausschluss — ALLE Restaurants (User-Allergie, User 13.09.2026)
- Krebstiere + Weichtiere: Garnelen/Shrimps/Scampi/Gambas, Krabben, Hummer, Langusten, Flusskrebse, Muscheln, Austern, Jakobsmuscheln, Tintenfisch/Calamari/Sepia, Oktopus/Pulpo, Meeresfrüchte. **Kein Schalter. Fisch ist erlaubt.**
- Ausgeschlossen wird nur, was **tatsächlich enthalten** ist: der Name sagt es ODER die Allergenliste sagt „enthält". „Kann Spuren enthalten" zählt **nicht**. Keine spekulativen Warnungen
- Zentral `isShellfish(x)`, genutzt im Pool von `alaCarteCombos`, in BYO-Optimizern (Pflicht) und in `buildSearchIndex`:
  - `SHELLFISH_RE` (DE + EN): `garnele|shrimp|scampi|gambas|prawn(?!less)|krabbe|crab|krebs|hummer|lobster|langust|langoust|crayfish|muschel|mussel|clam|auster|oyster|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|frutti di mare|seafood|california|\bebi\b`
  - `SHELLFISH_NAMES`: exakte, kleingeschriebene Namen (auch mit angehängtem „ (…)"), die laut Allergenliste Schalentier enthalten, es aber nicht verraten (aktuell leer)
  - Item-Flag `shellfish:true`: setzt das Update-Skript, wenn die Allergenliste des Restaurants „enthält" sagt (restaurantgenau, daher präziser als `SHELLFISH_NAMES`)
  - `SHELLFISH_SAFE`: Wortteile, die vor dem Regex-Test aus dem Namen entfernt werden: `austernpilz`, `austern-pilz`, `austernseitling`, `oyster mushroom`, `muschelnudel`, `muschelpasta` → „Ramen mit Austernpilzen" bleibt, „Muschelnudeln mit Garnelen" fliegt trotzdem raus
- Deutsche Allergen-Legenden nutzen oft **B = Krebstiere** und **R = Weichtiere**. Immer die Legende der jeweiligen Karte prüfen
- Offener Punkt: Schnecken (Escargots) sind ebenfalls Weichtiere. „schnecke" steht bewusst **nicht** im Regex (Zimtschnecke!); bei Bedarf über `SHELLFISH_NAMES` bzw. das Flag lösen

## Abneigungen: Koriander + Minze (User 13.09.2026)
- Als wählbare Komponente, Topping oder Dressing **nie vorschlagen** (Petersilie als Topping ist ok)
- Fertige Gerichte, die Koriander oder Minze **prominent** enthalten: beim Hinzufügen des Restaurants im Chat erwähnen

## Schalter-Defaults (User 13.09.2026)
- „No …"-Schalter (Exclude-Filter) starten **AN**
- Restriktive „only X"- und „must include"-Modi starten **AUS**, außer der User sagt etwas anderes
- Pro `group` höchstens ein Schalter mit `def:true` (und höchstens einer mit `inAll`), sonst meldet `validateRegistry` einen Fehler

## Standard-Defaults (beim App-Start)
- Makro-Ziele: Carbs **85 g**, Protein **65 g**, Fat **20 g** (≈ 780 kcal); Kalorien-Modus: **450 kcal** mit **High Protein + Low Fat**
- Modus „Enter macros"; Sort by „Score"
- Start-Tab: erstes Registry-Restaurant (`DEFAULT_TAB`; ohne Restaurants „All restaurants")
- Max. items per order: **5** (je Restaurant `maxN`; der All/Accurate-Chip ebenfalls 5)
- Kategorien: `on`-Wert aus den Daten; Schalter: `def`

## UI-Reihenfolge (wie London)
1. Header: Gradient je Tab, Mono-Label in Großbuchstaben, „Macro Optimizer", „Find the optimal order for your goals", dekorativer Kreis
2. Modus-Buttons „Enter macros" | „Calories + preferences"
3. „📷 Import from screenshot"
4. Eingabekarte (Carbs/Protein/Fat + „≈ X kcal · <Hinweis>" bzw. kcal + Präferenz-Chips), darunter aufklappbar „Fibre / Salt ▾" (Min/Max)
5. Tab-Zeile (`flexWrap`, `btn`-Style): **➕ Add own order · Accurate restaurants · All restaurants**, danach die Registry-Restaurants
6. All/Accurate: Karte „Max. items per order" (bzw. Hinweiskarte, wenn keine Restaurants) · Restaurant: Config-Karte (Kategorie-Chips ohne Drinks · „Max. items per order" 1/2/3/5/∞ · `note`) · Schalter-Zeile
7. „Top results" mit Sort-Chips (Score / Calories / Carbs / Protein / Fat; C/P/F nur im Makro-Modus), 20 berechnet / 8 angezeigt; leere Liste → Hinweis
8. Detail-Panel nach Klick: MacroBars mit Delta zum Ziel (kcal #4ade80, Carbs #fbbf24, Protein #60a5fa, Fat #f87171, Fibre #a78bfa, Salt #94a3b8; Fibre-Ziel = Fibre Min, Salt-Ziel = Salt Max) → „Items" (kcal + Protein je Item) → „📋 Order guide (<Plattform>)" nummeriert mit Mengen
9. Fußzeile (Datenquelle je Tab)

### Zwei Modi
- **Enter macros**: P/C/F in g, kcal = P×4 + C×4 + F×9; der Score gewichtet Protein ×3, Carbs ×2, Fett ×2 (relativ zum Ziel)
- **Calories + preferences**: kcal-Ziel (×4) + Toggles High/Low Protein/Carb/Fat (Gegenpaare schließen sich aus), bewertet über die Energieanteile
- Fibre/Salt Min/Max: Zusatzstrafen (Fibre ×0,5 je g, Salz ×0,3 je g)

### Screenshot-Import (OCR), 1:1 aus London
YAZIO-„Übersicht" → verbleibende Makros (Total − Gegessen) + „Übrig"-kcal. `parseMacroScreenshot` (rein, 22 + 4 Testfälle aus London), `ocrMacroScreenshot` (Tesseract „deu", on-device, der erste Lauf lädt das Modell), `downscaleImage` (groß runter auf ≤2600 px, klein hoch auf ~2400 px). Robust gegen Slash als `| I l ) ]`, verschlucktes „g"/Slash, „g→9", Ring auf einer Zeile und Tausenderpunkte; Fett wird an „Übrig" angeglichen.

## Optimizer
- `sumN(items, mult, singleItems)`, `score(a, t, mode, p)`, `sortResults(arr, sortBy, tgts)`: identisch zu London
- `alaCarteCombos(t, mode, p, pool, maxN, opts)`: identisch zu London, aber mit Options-Objekt `{distinctBy, dedupKey, resultFilter, baseItems}`. Singles + Paare (Duplikate erlaubt) vollständig, Triples per Beam (beste 80 Paare), bei ∞ weitere Stufen nur solange der Score besser wird (Deckel 12 Items), Top 20. Schalentier-Filter auf dem Pool
- `optimizeAC` (siehe Registry); `runOptimize` / `orderStepsFor` / `searchEntriesFor` / `summarizeResult` dispatchen zwischen ac und byo
- **„All restaurants" / „Accurate restaurants"** (`optimizeAll(t, mode, p, maxN, onlyAccurate, restos?)`): jedes Restaurant läuft mit Default-Kategorien, `inAll`-Schalterwerten und dem Max-Items-Chip (`allState`). **Max. 1 Treffer pro Restaurant** (dessen bestes Ergebnis), nach Score sortiert, Top 20 → 8 angezeigt. Accurate = nur `accurate:true` (leer → Hinweiskarte). Karte mit Restaurant-Badge + Kurz-Zusammenfassung; Klick (`selectAcross`) wechselt in den Restaurant-Tab und öffnet das Ergebnis dort (die Karte ist markiert, wenn sie in dessen Liste vorkommt)

## „Add own order" (`tab==="search"`), kein Optimizer
- `SEARCH_INDEX = buildSearchIndex(RESTAURANTS)` entsteht automatisch aus der Registry (AC: `data.items` inkl. Drinks; BYO: `searchEntries()`), Schalentier raus, Dedup über `resto|name|kcal`
- `searchItems(query, limit=60, index?)`: alle Begriffe müssen in Name + Restaurant vorkommen, kürzester Name zuerst, **umlaut-tolerant** (`foldVariants`: ä→ae **und** ä→a, ö/ü analog, ß→ss, Akzente weg → „haehnchen", „hähnchen" und „hahnchen" finden dasselbe)
- „+ Add" → Warenkorb mit −/+/✕ (gleicher Eintrag → Menge +1), gespeichert in **`fra_own_order`**. Einträge speichern die vollen Makros und überleben dadurch Registry-Änderungen
- „Order total"-Karte mit MacroBars gegen die Ziele (`orderTotal`). Header #475569→#1e293b, Label „ADD OWN ORDER · TRACK"

## Design
- Dark Mode: Hintergrund #0d0d0d, Text #e0e0e0; Akzent #009743 / #4ade80; Karten #151515, Radius 12, Border #222
- Header-Gradients: Add own order #475569→#1e293b · All #7c3aed→#4c1d95 · Accurate #0284c7→#0c4a6e · Demo #0d9488→#134e4a · Restaurants über `gradient` in der Registry
- Fonts DM Sans / DM Mono; touch-freundliche Buttons; safe-area-inset
- Homescreen-Icon rot (#c8102e) mit „FRA", bewusst anders als London (grün „M")

## Tests (`node tests.js`)
- Harness wie London: Inline-Script per Regex laden, React/ReactDOM/document/localStorage stubben, indirektes `eval`, Funktionen an `globalThis.__t`
- `check(name, actual, expected)`: Zahlen mit Toleranz 0.05, Booleans mit `===`, **Strings immer als `check(name, a === b, true)`**. Am Ende „Alle Tests bestanden", sonst Exit-Code 1
- Abgedeckt (221 Tests, Stand 13.09.2026): Struktur (1 Inline-Script, `fra_`-Präfix, keine Registry-Key-Vergleiche), sumN, score, sortResults, alaCarteCombos (Singles/Paare/Duplikate/maxN/Beam/∞/resultFilter/distinctBy/dedupKey/baseItems/Schalentier), isShellfish (DE/EN/prawnless/SAFE/NAMES/Flag), Registry + validateRegistry (inkl. Negativfälle), optimizeAC mit Test-Restaurant (Kategorien/drink/filter/overridesCats/require/group/maxN/inAll), BYO-Stub, optimizeAll (1 pro Restaurant, Accurate), SEARCH_INDEX/searchItems (Umlaute), orderTotal, parseMacroScreenshot (London-Fälle), update-lib.js (LMIV-Parsing, Plausibilität, CRLF-Block) und der **Demo-Abschnitt** (beim ersten echten Restaurant löschen)

## Dateistruktur
```
Restaurant Tracker Frankfurt Claude/
├── index.html          ← Die PWA (alles in einer Datei: Registry + generierte Datenblöcke)
├── CLAUDE.md           ← Diese Datei
├── tests.js            ← Logik-Tests (node tests.js)
├── update-lib.js       ← Gemeinsame Helfer für <key>-update.js (LMIV, Plausibilität, Marker-Block)
├── demo-update.js      ← DEMO-Block aus data/demo-raw.json (fiktiv; Vorlage, später löschen)
├── .gitignore
├── .claude/launch.json ← Preview „macro-optimizer-frankfurt" (Port 8421)
└── data/
    └── demo-raw.json   ← Fiktive Demo-Daten (Quelle der Wahrheit für den DEMO-Block, später löschen)
```
Künftig je Restaurant: `data/<key>-raw.json`, `<key>-update.js`, ggf. `<key>-crawl.js` / `<key>-extract.py` und die Original-Quelle (PDF/CSV) unter `data/`.

## Checkliste „Neues Restaurant"
1. Kurz beim User erfragen, was fehlt: **Plattform**, **Bestellmodell** (à la carte oder Build-Your-Own mit Schritten), **Schalter**, **Default-Kategorien**, **Nährwertquelle**
2. Quelle prüfen (offiziell? aktuell? auf der Plattform bestellbar?) → `data/<key>-raw.json` (+ `<key>-crawl.js` / Extract) → `<key>-update.js` (Vorlage `demo-update.js`, Helfer aus `update-lib.js`). Marker `// __<KEY>_DATA_START__` / `// __<KEY>_DATA_END__` im Datenbereich von index.html einsetzen, dann das Skript laufen lassen. Anomalien, Ausschlüsse, Schalentier (Allergen-Legende!) und Koriander/Minze im Chat melden
3. Registry-Eintrag anlegen (key, name, kind, data, gradient, label, platform, accurate, maxN, switches, note, footer); bei BYO zusätzlich eigener Optimizer, renderConfig/renderCard/renderPanel, orderSteps und searchEntries
4. Tests (eigener Restaurant-Abschnitt) → `node tests.js` → Preview (Konsole fehlerfrei, Werte stimmen) → CLAUDE.md (Datenquellen, Bestellablauf, Defaults) → commit + push
- Beim **ersten** echten Restaurant zusätzlich das Demo Bistro komplett entfernen (siehe Abschnitt Demo)
- Such-Index und All/Accurate kommen automatisch über die Registry

## Arbeitsweise
- Nach jeder Änderung: `node tests.js` → im Preview prüfen (Konsole fehlerfrei, Werte stimmen) → CLAUDE.md aktualisieren → commit + push → kurze Zusammenfassung auf Deutsch (Werte als Tabelle)
- Sagt der User „nur im Chat" oder „noch nicht einbauen": Vorschläge nur zeigen, nichts ändern
- Entscheidungen des Users mit Datum vermerken („User TT.MM.JJJJ")

## Später (noch nicht gebaut — nicht verbauen)
- Supermarkt-Tab (REWE/Edeka/Aldi/Lidl, per 100 g, Build + Track + eigene Picks sperren): `alaCarteCombos` hat `baseItems` bereits; als Spezial-Tab nach dem Muster von „Add own order"
- Pre-selected Meals
- Carb-Top-up mit Maiswaffeln, Ghee-Top-up (in London als Nachbearbeitung der Ergebnisliste gelöst)
- Build-Your-Own-Restaurants (Schnittstelle `kind:"byo"` steht)

## Entscheidungen (User-Log)
- **User 13.09.2026**: Gerüst nach London-Muster ohne London-Restaurants; Registry statt `resto==="…"`-Ketten; UI Englisch, Doku/Kommentare Deutsch; Plattformen Lieferando/Wolt/Uber Eats je Restaurant; Default-Ziele C85/P65/F20, Kalorien-Modus 450 kcal mit HP+LF; Preview-Port 8421; localStorage-Präfix `fra_`; Schalentier permanent raus (Fisch erlaubt, nur „enthält"); Koriander + Minze nie vorschlagen; „No …"-Schalter AN, „only X"/„must include" AUS; Datenqualitätsregeln (offiziell, keine Schätzungen, raw.json als Quelle, LMIV-Zuordnung); Demo Bistro zum Testen, beim ersten echten Restaurant löschen
