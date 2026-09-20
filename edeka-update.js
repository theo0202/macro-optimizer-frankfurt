// Generiert den EDEKA-Block in index.html aus data/edeka-raw.json: node edeka-update.js
// Supermarkt-Tab (Build order + Track basket) nach dem Muster des Waitrose-Tabs im London-Tool:
// · jedes Produkt trägt seine Werte **je 100 g** (`p100`) und seine Menge `g` (Abtropfgewicht bei Konserven, sonst Packung bzw. kuratierte Portion)
// · `price` = Packungspreis des Onlineshops, `url` = Produktseite (im Tracker anklickbar), `brand` = Marke für die Einkaufsliste
// · Produkte ohne veröffentlichte Nährwerte (_meta.noData) fehlen im Block; Kategorien ohne Produkt ebenfalls
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "EDEKA";
const RAW = path.join(__dirname, "data", "edeka-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

function buildData(raw) {
  const items = [], used = new Set();
  for (const p of raw.items) {
    if (p.noData) continue;              // keine veröffentlichten Nährwerte (siehe _meta.noData)
    if (p.shellfish) continue;           // Krebs-/Weichtier (User 13.09.2026) — der Crawl meldet keins
    const id = U.slugId(p.name);
    if (used.has(id)) throw new Error("Produkt-id doppelt: " + id);
    used.add(id);
    const p100 = Object.fromEntries(U.KEYS.map(k => [k, U.round(p.per100[k] || 0, 2)]));
    const o = { id, name: p.name, brand: p.brand, cat: p.cat, g: U.round(p.portionG, 1), pack: U.round(p.packG, 1), p100, price: p.price, url: p.url };
    if (p.frozen) o.frozen = true;       // Schalter „No frozen food“
    if (p.drainedG != null) o.drained = true;
    // Woher die Werte kommen — Kurzform für den Hinweis im Tracker („values: …“)
    if (p.manufacturerUrl) o.ref = (p.manufacturerUrl.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] + " (manufacturer)";
    else if (p.valuesFrom) o.ref = p.valuesFrom.split(" — ")[0].replace(/,.*$/, "");
    // Produkt, das dieser Markt nicht führt: der Preis ist eine gekennzeichnete Annahme (User 20.09.2026)
    if (p.priceNote) o.priceNote = p.priceNote;
    o.note = p.portionNote;
    items.push(o);
  }
  const cats = raw.cats.filter(c => items.some(x => x.cat === c.id)).map(c => ({ id: c.id, name: c.name, on: true }));
  for (const x of items) if (!cats.some(c => c.id === x.cat)) throw new Error("Unbekannte Kategorie bei " + x.name + ": " + x.cat);
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: Produktseiten des EDEKA-Graf-Onlineshops (" + raw._meta.shop + ", " + raw._meta.store + ") · Werte je 100 g, Menge = Abtropfgewicht bzw. Packung · Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node edeka-update.js aus data/edeka-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(data.items.length + " Produkte → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length).join(", "));
  console.log("Mit Abtropfgewicht: " + data.items.filter(x => x.drained).length + " · Nicht im Block: " + raw._meta.noData.length + " ohne Nährwerte");
  console.log("Preise " + Math.min(...data.items.map(x => x.price)).toFixed(2) + "–" + Math.max(...data.items.map(x => x.price)).toFixed(2) + " € · Auffälligkeiten: " + raw._meta.anomalies.length);
}
