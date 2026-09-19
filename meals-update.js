// Generiert den MEALS-Block in index.html aus data/meals.json + data/edeka-raw.json: node meals-update.js
// „Pre-selected meals“ (User 19.09.2026, Muster: der gleichnamige Tab im London-Tool): feste Kombinationen aus höchstens
// drei Edeka-Produkten, kein Optimizer. Der Block enthält nur ids, Name, warm/kalt und den Behälter-Hinweis — die Nährwerte
// rechnet die App aus den EDEKA-Produkten (edekaScale), damit sie bei neuen Shop-Daten automatisch stimmen.
// Das Skript prüft: jedes Produkt existiert, höchstens drei Zutaten, kein Produkt doppelt, und meldet die Werte je Gericht.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "MEALS";
const RAW = path.join(__dirname, "data", "meals.json");
const EDEKA = path.join(__dirname, "data", "edeka-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const CATS = [{ id: "warm", name: "Warm" }, { id: "cold", name: "Cold" }];

function buildData(raw, edeka) {
  const byName = new Map(edeka.items.filter(x => !x.noData).map(x => [x.name, x]));
  const meals = [], ids = new Set();
  for (const m of raw.meals) {
    if (ids.has(m.id)) throw new Error("Gericht-id doppelt: " + m.id);
    ids.add(m.id);
    if (!CATS.some(c => c.id === m.temp)) throw new Error(m.id + ": unbekannt warm/kalt: " + m.temp);
    if (!m.items.length || m.items.length > 3) throw new Error(m.id + ": " + m.items.length + " Zutaten (erlaubt 1–3)");
    if (new Set(m.items).size !== m.items.length) throw new Error(m.id + ": Produkt doppelt");
    const items = m.items.map(n => {
      const p = byName.get(n);
      if (!p) throw new Error(m.id + ": Produkt „" + n + "“ gibt es im Edeka-Tab nicht");
      const o = { id: U.slugId(p.name) };
      if (m.g && m.g[n] != null && m.g[n] !== p.portionG) o.g = U.round(m.g[n], 1);   // abweichende Menge (aktuell keine)
      return o;
    });
    meals.push({ id: m.id, name: m.name, cat: m.temp, container: !!m.container, items });
  }
  return { cats: CATS.map(c => ({ ...c, on: true })), meals };
}

// Nährwerte eines Gerichts (dieselbe Rechnung wie die App: Werte je 100 g × Menge) — nur für die Kontrollausgabe
function nutrition(meal, edeka) {
  const byId = new Map(edeka.items.map(x => [U.slugId(x.name), x]));
  const out = { kcal: 0, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0, price: 0 };
  for (const it of meal.items) {
    const p = byId.get(it.id), g = it.g != null ? it.g : p.portionG;
    for (const k of U.KEYS) out[k] += (p.per100[k] || 0) * g / 100;
    out.price += p.price;
  }
  return out;
}

function blockLines(raw, edeka) {
  const data = buildData(raw, edeka);
  const lines = [
    "// Quelle: data/meals.json (vom User bestätigte Kombinationen) — Produkte und Nährwerte kommen aus dem Edeka-Tab",
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  meals: [");
  for (const m of data.meals) lines.push("    " + lit(m) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node meals-update.js aus data/meals.json", lines), data };
}

module.exports = { buildData, blockLines, nutrition };

if (require.main === module) {
  const raw = U.readJSON(RAW), edeka = U.readJSON(EDEKA);
  const { lines, data } = blockLines(raw, edeka);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  const t = raw._meta.targets, r1 = x => Math.round(x * 10) / 10;
  console.log(data.meals.length + " Gerichte → index.html (" + KEY + "-Block): " +
    data.cats.map(c => c.name + " " + data.meals.filter(m => m.cat === c.id).length).join(", ") +
    " · " + data.meals.filter(m => m.container).length + "× Schüssel nötig");
  const out = [];
  for (const m of data.meals) {
    const n = nutrition(m, edeka);
    const miss = Object.entries(t).filter(([k, [lo, hi]]) => n[k] < lo || n[k] > hi).map(([k]) => k);
    out.push((miss.length ? "  ! " : "  ✓ ") + m.id.padEnd(4) + m.name.slice(0, 46).padEnd(48) +
      Math.round(n.kcal) + " kcal · C " + r1(n.carbs) + " · P " + r1(n.protein) + " · F " + r1(n.fat) +
      " · Fib " + r1(n.fibre) + " · Salz " + r1(n.salt) + " · " + n.price.toFixed(2) + " €" +
      (miss.length ? "   außerhalb: " + miss.join(", ") : "") + (m.container ? "" : "   [ohne Schüssel]"));
  }
  console.log(out.join("\n"));
}
