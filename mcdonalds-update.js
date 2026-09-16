// Generiert den MCDONALDS-Block in index.html aus data/mcdonalds-raw.json: node mcdonalds-update.js
// À la carte (kind:"ac"): je bei Wolt bestellbarem Produkt die offiziellen Werte je Portion von mcdonalds.com, Wolt-Name, Wolt-Kategorie und Preis.
// sauce:true = Sauce/Dip/Dressing (Schalter „No sauces & dressings“) · orderNote = Pflicht-Auswahl bei Wolt, die der Order Guide nennt
// (z.B. Nuggets „Sauce 1/2, Sauce 2/2: Ohne Sauce“ — die Werte gelten ohne die inklusive Sauce).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "MCDONALDS";
const RAW = path.join(__dirname, "data", "mcdonalds-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

// Pflicht-Auswahlen zusammenfassen: gleiche „Ohne …“-Option → „Sauce 1/2, Sauce 2/2: Ohne Sauce“
function orderNote(required) {
  const byNone = new Map();
  for (const r of required || []) { if (!byNone.has(r.none)) byNone.set(r.none, []); byNone.get(r.none).push(r.group); }
  return [...byNone].map(([none, groups]) => groups.join(", ") + ": " + none).join(" · ");
}

function buildData(raw) {
  const bySite = Object.fromEntries(raw.products.map(p => [p.siteId, p]));
  const cats = raw.wolt.cats.map(c => ({ id: c.id, name: c.name, on: !!c.on }));
  const catIds = new Set(cats.map(c => c.id));
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
    for (const k of U.KEYS) { const v = p.perServing[k]; if (typeof v !== "number" || !(v >= 0)) throw new Error(w.name + ": " + k + " fehlt"); o[k] = v; }
    o.price = U.round(w.price, 2);
    if (w.sauce) o.sauce = true;
    const note = orderNote(w.required);
    if (note) o.orderNote = note;
    if (p.shellfish) o.shellfish = true;
    return o;
  });
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: mcdonalds.com/de (offizielle Nährwerte je Produkt) · Menü, Namen + Preise: Wolt " + raw.wolt.venue + ", Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node mcdonalds-update.js aus data/mcdonalds-raw.json", lines), data };
}

module.exports = { buildData, blockLines, orderNote };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(data.items.length + " Produkte → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length + (c.on ? "" : " (aus)")).join(", "));
}
