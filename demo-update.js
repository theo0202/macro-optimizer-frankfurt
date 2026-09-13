// Generiert den DEMO-Block in index.html aus data/demo-raw.json: node demo-update.js
// FIKTIVES Test-Restaurant — beim ersten echten Restaurant löschen (mit data/demo-raw.json, Registry-Eintrag, Demo-Tests).
// Bis dahin Vorlage für <key>-update.js (à la carte): Rohdaten lesen → Zahlen/Kategorien prüfen → Plausibilität melden
// → Block zwischen // __DEMO_DATA_START__ und // __DEMO_DATA_END__ ersetzen.
const path = require("path");
const U = require("./update-lib.js");

const KEY = "DEMO";          // Marker-Name + Konstante in index.html
const FLAGS = ["sauce"];     // boolesche Item-Flags, die Schalter nutzen (sauce → „No sauce")
const raw = U.readJSON(path.join(__dirname, "data", "demo-raw.json"));
const items = U.buildAcItems(raw.items, raw.cats, FLAGS);

console.log("Plausibilität (kcal ≈ 4·C+4·P+9·F, sat ≤ fat, sugars ≤ carbs):");
const open = U.reportAnomalies(items, raw._meta);
if (!open.length) console.log("  keine offenen Auffälligkeiten");

const lines = U.wrapBlock(KEY, "node demo-update.js aus data/demo-raw.json", [
  "// FIKTIV: Demo Bistro (Wolt) · " + items.length + " Items · nur zum Testen — vor dem ersten echten Restaurant löschen",
  ...U.acDataLines(KEY, raw.cats, items, FLAGS),
]);
U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);

console.log("\n" + items.length + " Items -> index.html (" + KEY + "-Block)");
for (const c of raw.cats) console.log("  " + c.name + ": " + items.filter(x => x.cat === c.id).length + (c.drink ? "  (drink → nie im Optimizer)" : "") + (c.on === false ? "  (default AUS)" : ""));
if (open.length) console.log("\n⚠ " + open.length + " nicht dokumentierte Auffälligkeit(en) → in _meta.anomalies eintragen und dem User nennen");
