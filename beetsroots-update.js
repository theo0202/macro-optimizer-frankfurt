// Generiert den BEETSROOTS-Block in index.html aus data/beetsroots-raw.json: node beetsroots-update.js
// À la carte (kind:"ac") mit Kategorien wie bei Wolt. Je Gericht entstehen bis zu zwei Items:
// · „ohne Dressing“ (dressing:"out") = die offiziellen Werte der Website (die Fußnote sagt „*ohne Dressing“) — nur mit Schalter „No dressing“ AN
// · „mit Dressing“ (dressing:"in") = dieselben Werte + die Dressing-Portion — nur mit Schalter „No dressing“ AUS; gibt es nur, wenn die Dressing-Werte
//   bezifferbar sind (genau ein verknüpftes Dressing mit Werten je 100 g + kcal der Portion)
// · Grilled Wraps (dressing:"fixed"): die Sauce steckt im Wrap → ein Item mit Werten inkl. Dressing, in beiden Schalterstellungen
// · Gerichte ohne Dressing (dressing:"none"): ein Item, in beiden Schalterstellungen
// product/productName = Gericht (eine Zeile in Ausschluss- und Pflicht-Liste je Gericht), orderName = Wolt-Name, orderNote = Dressing-Hinweis für den Order Guide.
// Nicht angegebene Werte (Ballaststoffe) = 0. Gerichte ohne vollständige Nährwerte und gesperrte Gerichte (_meta.blocked) fehlen im Block,
// Kategorien ohne Gericht ebenfalls (wie bei der Kaffeebohne).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "BEETSROOTS";
const RAW = path.join(__dirname, "data", "beetsroots-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const kcalTxt = n => Math.round(n) + " kcal";

function buildData(raw) {
  const allCats = raw.wolt.cats.map(c => ({ id: c.id, name: c.name, on: true }));
  const catIds = new Set(allCats.map(c => c.id));
  const items = [], used = new Set();
  for (const d of raw.dishes) {
    if (d.noData) continue; // ohne vollständige offizielle Werte (siehe _meta.noData)
    if (d.blocked) continue; // gesperrt: kcal passen nicht zu den Makros (siehe _meta.blocked)
    if (d.shellfish) continue; // Schalentier (User 13.09.2026) — der Crawl meldet keins
    if (!catIds.has(d.cat)) throw new Error("Unbekannte Kategorie bei " + d.name + ": " + d.cat);
    const slug = U.slugId(d.name);
    const vals = m => Object.fromEntries(U.KEYS.map(k => [k, U.round((d.values[k] || 0) + (m && d.dressing ? d.dressing.values[k] || 0 : 0), 2)]));
    const add = (id, name, kind, note) => {
      if (used.has(id)) throw new Error("Item-id doppelt: " + id);
      used.add(id);
      const o = { id, name, cat: d.cat };
      Object.assign(o, vals(kind === "in" || kind === "fixed"), { price: d.price, dressing: kind });
      if (id !== slug) { o.product = slug; o.productName = d.name; o.orderName = d.name; }
      if (note) o.orderNote = note;
      items.push(o);
    };
    if (d.dressingFixed) {
      // Grilled Wraps: Sauce im Wrap → immer mitgerechnet
      if (!d.dressing) throw new Error(d.name + ": Wrap ohne bezifferbares Dressing (" + (d.dressingNote || "?") + ")");
      add(slug, d.name, "fixed", d.dressing.name + " (" + kcalTxt(d.dressing.portionKcal) + ") is inside the wrap — included in these values");
    } else if (d.dressing) {
      add(slug + "__no_dressing", d.name, "out", "don't eat the " + d.dressing.name + " (" + kcalTxt(d.dressing.portionKcal) + ") — these values don't include it");
      add(slug + "__with_dressing", d.name + " (with " + d.dressing.name + ")", "in", "with the " + d.dressing.name + " (" + kcalTxt(d.dressing.portionKcal) + ") — included in these values");
    } else if (d.dressingInfo) {
      // Dressing/Sauce laut Website vorhanden, aber nicht bezifferbar (mehrere Dressings oder ohne verknüpftes Produkt)
      add(slug, d.name, "out", "don't eat the dressing/sauce (" + kcalTxt(U.round(Number(String(d.dressingInfo).match(/(\d+(?:[.,]\d+)?)/)[1].replace(",", ".")), 0)) + ") — these values don't include it");
    } else add(slug, d.name, "none", null);
  }
  const cats = allCats.filter(c => items.some(x => x.cat === c.id)); // Kategorie ohne Gericht → kein Chip
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: beets&roots Vorbestell-Shop (offizielle Werte je Portion ohne Dressing, im „i“-Fenster der Website geprüft) + Wolt-Menü beets&roots Frankfurt · Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node beetsroots-update.js aus data/beetsroots-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  const n = k => data.items.filter(x => x.dressing === k).length;
  console.log(new Set(data.items.map(x => x.product || x.id)).size + " Gerichte, " + data.items.length + " Items → index.html (" + KEY + "-Block): " +
    data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length).join(", "));
  console.log("Dressing: " + n("out") + "× ohne (Schalter AN), " + n("in") + "× mit (Schalter AUS), " + n("fixed") + "× fest im Wrap, " + n("none") + "× ohne Dressing");
  console.log("Nicht im Block: " + raw._meta.blocked.length + " gesperrt, ohne Werte: " + (raw._meta.noData.join(" · ") || "keine") + " · Auffälligkeiten: " + raw._meta.anomalies.length);
}
