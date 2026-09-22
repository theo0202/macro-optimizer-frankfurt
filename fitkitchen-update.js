// Generiert den FITKITCHEN-Block in index.html aus data/fitkitchen-raw.json: node fitkitchen-update.js
// À la carte (kind:"ac"): je bei Wolt bestellbarem Artikel mit Werten auf der Speisekarte von fit-kitchen.de die offiziellen
// Werte je Gericht (Standard-Zusammenstellung, Soßen der Gerichte inklusive), Wolt-Name, Wolt-Kategorie und Wolt-Preis.
// Fit Kitchen nennt nur kcal, Kohlenhydrate, Fett und Eiweiß → gesättigte Fettsäuren, Zucker, Ballaststoffe und Salz = 0.
// Dips (Kategorie „Dips“, je 30 mL) tragen `sauce: true` → Schalter „No sauces“. Kategorien ohne Artikel mit Werten fehlen.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "FITKITCHEN";
const RAW = path.join(__dirname, "data", "fitkitchen-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

function buildData(raw) {
  const notDeclared = new Set(raw._meta.notDeclared || []);
  const used = new Set();
  const items = raw.wolt.items.filter(w => !w.noData && !w.shellfish).map(w => {
    let id = "fk_" + U.slugId(w.name);
    while (used.has(id)) id += "_2";
    used.add(id);
    const o = { id, name: w.name, cat: w.cat };
    for (const k of U.KEYS) {
      if (notDeclared.has(k)) { o[k] = 0; continue; }
      const v = w.values[k];
      if (typeof v !== "number" || !(v >= 0)) throw new Error(w.name + ": " + k + " fehlt");
      o[k] = v;
    }
    if (typeof w.price !== "number" || !(w.price >= 0)) throw new Error("Preis fehlt: " + w.name);
    o.price = U.round(w.price, 2);
    if (w.sauce) o.sauce = true;
    if (w.portion) o.orderNote = w.portion;   // „30 mL“ bei den Dips
    return o;
  });
  const cats = raw.wolt.cats.filter(c => items.some(x => x.cat === c.id)).map(c => ({ id: c.id, name: c.name, on: true }));
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: Speisekarte fit-kitchen.de (offizielle Werte je Gericht; nur kcal/KH/Fett/Eiweiß) · Menü, Namen + Preise: Wolt „" + raw.wolt.slug + "“, Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node fitkitchen-update.js aus data/fitkitchen-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(data.items.length + " Artikel → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length).join(", "));
}
