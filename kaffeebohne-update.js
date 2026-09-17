// Generiert den KAFFEEBOHNE-Block in index.html aus data/kaffeebohne-raw.json: node kaffeebohne-update.js
// À la carte (kind:"ac") mit Varianten: je Gericht und Kombination aus Protein- und Kohlenhydrat-Option ein Item (Werte = empfohlene Auswahl
// + Änderungen laut Option, Preis = Gericht + Options-Aufpreise). product/productName = Gericht (für „Must include“ und „Exclude items“),
// choices = Options-ids (Exclude), orderName/orderNote = Order Guide (Wolt-Namen, Pflicht-Dip ohne Werte). Nicht angegebene Werte = 0.
// Gesperrte Gerichte bleiben im Datensatz, aber nicht im Tracker.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "KAFFEEBOHNE";
const RAW = path.join(__dirname, "data", "kaffeebohne-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const CHOICE_GROUP = { protein: "Protein option", carbs: "Carb option" };
const KIND_ORDER = ["protein", "carbs"];
const DIP_NOTE = "any (no nutrition values — leave it out)";

function buildData(raw) {
  const cats = raw.wolt.cats.map(c => ({ id: c.id, name: c.name, on: !!c.on }));
  const catIds = new Set(cats.map(c => c.id));
  const notDeclared = new Set(raw._meta.notDeclared || []);
  const choices = [], seenChoice = new Set(), items = [], used = new Set();
  for (const p of raw.wolt.products) {
    if (p.blocked) continue;
    if (!catIds.has(p.cat)) throw new Error("Unbekannte Kategorie bei " + p.name + ": " + p.cat);
    // Varianten-id und -name immer Protein → Kohlenhydrate (Wolt ordnet die Gruppen je Gericht verschieden); Order Guide in Wolt-Reihenfolge
    // gesperrte Optionen (User 17.09.2026: Salat Mix) fallen weg, die Standard-Option bleibt immer
    const valueGroups = p.groups.filter(g => g.kind !== "dip").sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
      .map(g => Object.assign({}, g, { options: g.options.filter(o => !o.blocked || o.default) }));
    for (const g of valueGroups) for (const o of g.options) if (!seenChoice.has(o.choice)) { seenChoice.add(o.choice); choices.push({ id: o.choice, name: o.short, group: CHOICE_GROUP[g.kind] }); }
    // Kartesisches Produkt der Options-Gruppen
    let combos = [[]];
    for (const g of valueGroups) combos = combos.flatMap(c => g.options.map(o => [...c, o]));
    const productId = U.slugId(p.name);
    for (const combo of combos) {
      const v = { kcal: p.nutrition.kcal, fat: p.nutrition.fat, carbs: p.nutrition.carbs, protein: p.nutrition.protein };
      let cents = Math.round(p.price * 100);
      for (const o of combo) {
        cents += Math.round(o.price * 100);
        if (o.delta) for (const k of ["kcal", "fat", "carbs", "protein"]) v[k] += o.delta[k];
      }
      let id = valueGroups.length ? productId + "__" + combo.map(o => o.choice).join("__") : productId;
      while (used.has(id)) id += "_2";
      used.add(id);
      const extra = combo.filter(o => !o.default).map(o => o.short);
      const item = { id, name: p.name + (extra.length ? " · " + extra.join(" · ") : ""), cat: p.cat };
      for (const k of U.KEYS) {
        if (notDeclared.has(k)) { item[k] = 0; continue; }
        const val = k === "kcal" ? Math.round(v[k]) : U.round(v[k], 1);
        if (!(val >= 0)) throw new Error(p.name + " (" + extra.join(", ") + "): " + k + " < 0");
        item[k] = val;
      }
      item.price = cents / 100;
      if (valueGroups.length) {
        item.product = productId;
        item.productName = p.name;
        item.choices = combo.map(o => o.choice);
        item.orderName = p.name;
      }
      const note = p.groups.map(g => g.name + ": " + (g.kind === "dip" ? DIP_NOTE : combo.find(o => g.options.some(x => x.wolt === o.wolt)).name));
      if (note.length) item.orderNote = note.join(" · ");
      items.push(item);
    }
  }
  // Kategorien ohne Gericht (User 17.09.2026: alle Low-Carb-Salate gesperrt) erscheinen nicht als Chip
  return { cats: cats.filter(c => items.some(x => x.cat === c.id)), choices, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: Wolt-Produktbeschreibungen „Die gruene Kaffeebohne“ (Werte der empfohlenen Auswahl + Änderungen je Option; nur kcal/KH/Eiweiß/Fett) · Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  choices: [");
  for (const c of data.choices) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node kaffeebohne-update.js aus data/kaffeebohne-raw.json", lines), data };
}

module.exports = { buildData, blockLines, DIP_NOTE };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  const products = new Set(data.items.map(x => x.product || x.id));
  console.log(products.size + " Gerichte, " + data.items.length + " Varianten → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length).join(", ") + " · gesperrt: " + raw._meta.blocked.length);
}
