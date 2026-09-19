// Generiert den PREPMYMEAL-Block in index.html aus data/prepmymeal-raw.json: node prepmymeal-update.js
// Die Gerichte gehören in den Edeka-Tab (dort kauft der User sie), bilden aber eine eigene Kategorie und hängen am
// Schalter „Include PrepMyMeal“ (User 19.09.2026):
//   · `prep: true`  → nur sichtbar, wenn der Schalter an ist (Produktsuche im Build- und im Track-Modus)
//   · `pick: true`  → der Optimizer schlägt sie **nie** von sich aus vor; sie kommen nur in eine Bestellung,
//                     wenn man sie gezielt sucht und unter „Build around your own picks“ sperrt („🔒 Lock in“)
//   · `frozen: true` → alle Gerichte sind Tiefkühlware (der Schalter „No frozen food“ lässt sie durch, weil sie ihren eigenen haben)
// Werte = offizielle Angaben je 100 g × ganze Packung (bei XL-Gerichten 2 Portionen; die Gramm sind im Tracker änderbar).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "PREPMYMEAL";
const RAW = path.join(__dirname, "data", "prepmymeal-raw.json");
const CAT = { id: "prep", name: "PrepMyMeal (frozen)" };
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

function buildData(raw) {
  const items = [], used = new Set();
  for (const m of raw.meals) {
    if (m.shellfish) continue;                       // Krebs-/Weichtier (User 13.09.2026) — der Crawl meldet keins
    const name = m.name + " " + U.round(m.packG, 0) + " g";
    const id = "pmm_" + U.slugId(m.name);
    if (used.has(id)) throw new Error("Gericht-id doppelt: " + id);
    used.add(id);
    const p100 = Object.fromEntries(U.KEYS.map(k => [k, U.round(m.per100[k] || 0, 2)]));
    const o = { id, name, brand: "prepmymeal", cat: CAT.id, g: U.round(m.packG, 1), pack: U.round(m.packG, 1), p100,
      price: m.price, url: m.url, prep: true, pick: true, frozen: true };
    if (m.portions > 1) o.portions = m.portions;     // „2 Portionen“ → Hinweis im Tracker
    items.push(o);
  }
  return { cats: [{ ...CAT, on: true }], items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: prepmymeal.com, Collection „" + raw._meta.collection + "“ (= Gerichtsauswahl der Meal-Box) · Werte je 100 g × ganze Packung · Stand " + raw._meta.fetchedAt.slice(0, 10),
    "// Die Gerichte hängen am Schalter „Include PrepMyMeal“ und werden nie von selbst vorgeschlagen (pick) — siehe prepmymeal-update.js",
    "const " + KEY + " = {",
    "  cats: [" + data.cats.map(lit).join(", ") + "],",
    "  items: [",
  ];
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node prepmymeal-update.js aus data/prepmymeal-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  const kcal = x => Math.round(x.p100.kcal * x.g / 100);
  console.log(data.items.length + " Gerichte → index.html (" + KEY + "-Block)");
  console.log("  Packungen " + Math.min(...data.items.map(x => x.g)) + "–" + Math.max(...data.items.map(x => x.g)) + " g · " +
    data.items.filter(x => x.portions).length + "× XL (2 Portionen) · Preise " +
    Math.min(...data.items.map(x => x.price)).toFixed(2) + "–" + Math.max(...data.items.map(x => x.price)).toFixed(2) + " €");
  console.log("  Ganze Packung: " + Math.min(...data.items.map(kcal)) + "–" + Math.max(...data.items.map(kcal)) + " kcal · " +
    "Eiweiß " + Math.min(...data.items.map(x => Math.round(x.p100.protein * x.g / 100))) + "–" + Math.max(...data.items.map(x => Math.round(x.p100.protein * x.g / 100))) + " g");
  console.log("  Nicht im Block: " + raw.meals.filter(m => m.shellfish).length + " (Schalentier) · Auffälligkeiten: " + raw._meta.anomalies.length);
}
