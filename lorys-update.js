// Generiert den LORYS-Block in index.html aus data/lorys-raw.json: node lorys-update.js
// À la carte (kind:"ac"): je bei Wolt bestellbarem Gericht die offiziellen Werte der Website (Standard-Auswahl), Wolt-Name, Wolt-Kategorie und Preis.
// Die Website nennt nur kcal, Kohlenhydrate, Eiweiß und Fett → gesättigte Fettsäuren, Zucker, Ballaststoffe und Salz = 0 (nicht angegeben, _meta).
// orderNote = Pflicht-Auswahl bei Wolt mit der Standard-Option, die der Order Guide nennt (z.B. „Sauce nach Wahl (Hühnchen-Bowl): Lorys Sesam-Miso-Sauce“).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "LORYS";
const RAW = path.join(__dirname, "data", "lorys-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

function orderNote(required) {
  return (required || []).map(r => r.group + ": " + r.choice).join(" · ");
}

function buildData(raw) {
  const bySite = Object.fromEntries(raw.site.map(p => [p.siteId, p]));
  const cats = raw.wolt.cats.map(c => ({ id: c.id, name: c.name, on: !!c.on }));
  const catIds = new Set(cats.map(c => c.id));
  const notDeclared = new Set(raw._meta.notDeclared || []);
  const used = new Set();
  const items = raw.wolt.items.map(w => {
    const p = bySite[w.siteId];
    if (!p) throw new Error("Website-Produkt fehlt: " + w.siteName + " (" + w.siteId + ")");
    if (!catIds.has(w.cat)) throw new Error("Unbekannte Kategorie bei " + w.name + ": " + w.cat);
    if (typeof w.price !== "number" || !(w.price >= 0)) throw new Error("Preis fehlt: " + w.name);
    let id = U.slugId(w.name);
    while (used.has(id)) id += "_2";
    used.add(id);
    const o = { id, name: w.name, cat: w.cat };
    for (const k of U.KEYS) {
      if (notDeclared.has(k)) { o[k] = 0; continue; }
      const v = p.perServing[k];
      if (typeof v !== "number" || !(v >= 0)) throw new Error(w.name + ": " + k + " fehlt");
      o[k] = v;
    }
    o.price = U.round(w.price, 2);
    const note = orderNote(w.required);
    if (note) o.orderNote = note;
    return o;
  });
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: lorys-gymfood.de (offizielle Werte je Gericht, Standard-Auswahl; nur kcal/KH/Eiweiß/Fett angegeben) · Menü, Namen + Preise: Wolt " + raw.wolt.venue + ", Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node lorys-update.js aus data/lorys-raw.json", lines), data };
}

module.exports = { buildData, blockLines, orderNote };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(data.items.length + " Gerichte → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length + (c.on ? "" : " (aus)")).join(", "));
}
