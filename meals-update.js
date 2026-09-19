// Generiert den MEALS-Block in index.html aus data/meals.json + data/edeka-raw.json: node meals-update.js
// „Pre-selected meals“ (User 19.09.2026, Muster: der gleichnamige Tab im London-Tool): feste Kombinationen aus höchstens
// drei Edeka-Produkten, kein Optimizer.
//
// **Der Block ist ein Schnappschuss** (User 19.09.2026): Namen, Mengen, Preise und alle acht Nährwerte stehen fertig im
// Block. Die Gerichte funktionieren damit unabhängig vom Edeka-Tab und vom Onlineshop — verschwindet dort ein Produkt oder
// ist die Seite nicht erreichbar, bleiben die Gerichte wie sie sind. Aktualisieren: dieses Skript erneut laufen lassen
// (es meldet dann, was sich geändert hat).
//
// **Behälter-Hinweis** wird aus den Produkten abgeleitet (User 19.09.2026): eine Schüssel braucht man, sobald
//   · eine Konserve dabei ist (abtropfen und umfüllen) oder
//   · etwas erhitzt bzw. aus einem Beutel gekippt wird (Express-Reis, Körnermischung, Gyoza).
// Sonst isst man alles aus Becher, Schale oder Packung.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "MEALS";
const RAW = path.join(__dirname, "data", "meals.json");
const EDEKA_RAW = path.join(__dirname, "data", "edeka-raw.json");
const INDEX = path.join(__dirname, "index.html");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const CATS = [{ id: "warm", name: "Warm" }, { id: "cold", name: "Cold" }];
// Kategorien, deren Produkte erhitzt bzw. aus einem Beutel umgefüllt werden
const HEAT_CATS = new Set(["carbs", "gyoza"]);

// Ein Produkt bei seiner Menge → fertiges Item (dieselbe Rechnung wie im Supermarkt-Tab: Werte je 100 g × Menge)
function itemOf(p, grams) {
  const g = U.round(grams != null ? grams : p.portionG, 1);
  // Name wie im Supermarkt-Tab: die Menge steht nur dran, wenn sie von der Packung abweicht (Abtropfgewicht)
  const showG = Math.abs(g - U.round(p.packG, 1)) > 0.05;
  const o = { id: U.slugId(p.name), name: p.name + (showG ? " (" + (Math.round(g * 10) / 10) + " g" + (p.drainedG != null ? " drained" : "") + ")" : ""), brand: p.brand, cat: p.cat, g };
  for (const k of U.KEYS) o[k] = U.round((p.per100[k] || 0) * g / 100, 1);
  o.price = p.price;
  o.url = p.url;
  if (p.drainedG != null) o.drained = true;
  if (p.valuesFrom) o.ref = p.valuesFrom.split(" — ")[0].replace(/,.*$/, "");
  return o;
}

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
      return itemOf(p, m.g && m.g[n] != null ? m.g[n] : null);
    });
    const tin = items.some(x => x.drained), heat = items.some(x => HEAT_CATS.has(x.cat));
    const why = tin && heat ? "Heat the rice or gyoza, drain the tin and mix everything in a bowl."
      : tin ? "You have to drain the tin and tip it into a bowl."
      : heat ? "Heat the rice, grain mix or gyoza and mix it in a bowl."
      : "Everything can be eaten out of its own pot, tray or pack — cold cuts go on the roll.";
    meals.push({ id: m.id, name: m.name, cat: m.temp, container: tin || heat, why, items });
  }
  return { cats: CATS.map(c => ({ ...c, on: true })), meals };
}

function blockLines(raw, edeka, updated) {
  const data = buildData(raw, edeka);
  const lines = [
    "// Quelle: data/meals.json (vom User bestätigte Kombinationen) × data/edeka-raw.json — Schnappschuss der Werte vom " + updated + ",",
    "// damit die Gerichte unabhängig vom Onlineshop bleiben. Aktualisieren: node meals-update.js",
    "const " + KEY + " = {",
    "  updated: " + JSON.stringify(updated) + ",",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  meals: [");
  for (const m of data.meals) {
    lines.push("    { id:" + JSON.stringify(m.id) + ", name:" + JSON.stringify(m.name) + ", cat:" + JSON.stringify(m.cat) +
      ", container:" + m.container + ", why:" + JSON.stringify(m.why) + ", items:[");
    for (const x of m.items) lines.push("      " + lit(x) + ",");
    lines.push("    ] },");
  }
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node meals-update.js aus data/meals.json + data/edeka-raw.json", lines), data };
}

const sumOf = m => m.items.reduce((a, x) => { for (const k of U.KEYS) a[k] += x[k]; a.price += x.price; return a; },
  Object.assign(Object.fromEntries(U.KEYS.map(k => [k, 0])), { price: 0 }));

module.exports = { buildData, blockLines, sumOf, itemOf };

if (require.main === module) {
  const fs = require("fs");
  const raw = U.readJSON(RAW), edeka = U.readJSON(EDEKA_RAW);
  // Bisherigen Schnappschuss lesen, um Änderungen zu melden
  const html = fs.readFileSync(INDEX, "utf8");
  const old = {};
  for (const m of html.matchAll(/\{ id:"(m[0-9a-z]+)", name:"([^"]*)", cat:"(\w+)", container:(true|false)/g)) old[m[1]] = { name: m[2], container: m[4] === "true" };
  const updated = new Date().toISOString().slice(0, 10);
  const { lines, data } = blockLines(raw, edeka, updated);
  U.writeBlock(INDEX, KEY, lines);
  const t = raw._meta.targets, r1 = x => Math.round(x * 10) / 10;
  console.log(data.meals.length + " Gerichte → index.html (" + KEY + "-Block, Schnappschuss " + updated + "): " +
    data.cats.map(c => c.name + " " + data.meals.filter(m => m.cat === c.id).length).join(", ") +
    " · " + data.meals.filter(m => m.container).length + "× Schüssel nötig");
  for (const m of data.meals) {
    const n = sumOf(m);
    const miss = Object.entries(t).filter(([k, [lo, hi]]) => n[k] < lo || n[k] > hi).map(([k]) => k);
    const was = old[m.id];
    console.log((miss.length ? "  ! " : "  ✓ ") + m.id.padEnd(4) + m.name.slice(0, 44).padEnd(46) +
      Math.round(n.kcal) + " kcal · C " + r1(n.carbs) + " · P " + r1(n.protein) + " · F " + r1(n.fat) +
      " · Fib " + r1(n.fibre) + " · Salz " + r1(n.salt) + " · " + n.price.toFixed(2) + " €" +
      (m.container ? "  🥣" : "  📦") + (miss.length ? "   außerhalb: " + miss.join(", ") : "") +
      (was && was.container !== m.container ? "   [Behälter-Hinweis geändert: " + (m.container ? "jetzt nötig" : "jetzt nicht mehr nötig") + "]" : "") +
      (was ? "" : "   [neu]"));
  }
  const gone = Object.keys(old).filter(id => !data.meals.some(m => m.id === id));
  if (gone.length) console.log("Nicht mehr im Block: " + gone.join(", "));
}
