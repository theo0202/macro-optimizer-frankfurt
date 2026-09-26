// Generiert den MEALS-Block in index.html aus data/meals.json + data/edeka-raw.json: node meals-update.js [--refresh]
// „Pre-selected meals“ (User 19.09.2026, Muster: der gleichnamige Tab im London-Tool): feste Kombinationen aus höchstens
// vier verschiedenen Edeka-Produkten (bis 25.09.2026 drei), kein Optimizer. Seit 24.09.2026 darf ein Produkt mehrfach stehen
// (2× Sandwich, 2× Gyoza): in meals.json steht der Name dann zweimal, im Block steht jede Packung als eigene Zeile.
//
// **Der Block ist ein Schnappschuss** (User 19.09.2026): Namen, Mengen, Preise und alle acht Nährwerte stehen fertig im
// Block. Die Gerichte funktionieren damit unabhängig vom Edeka-Tab und vom Onlineshop — verschwindet dort ein Produkt oder
// ist die Seite nicht erreichbar, bleiben die Gerichte wie sie sind. Ein normaler Lauf übernimmt deshalb jedes Gericht, das
// es schon gibt, unverändert aus dem bisherigen Block (mit seinem Stand `asOf`); nur neue oder geänderte Gerichte bekommen
// die aktuellen Edeka-Werte. `--refresh` erneuert alle, `--refresh=m18,m19` nur diese (das Skript meldet, was sich geändert hat).
//
// **Behälter-Hinweis** wird aus den Produkten abgeleitet (User 19.09.2026): eine Schüssel braucht man, sobald
//   · eine Konserve dabei ist (abtropfen und umfüllen) oder
//   · etwas erhitzt bzw. aus einem Beutel gekippt wird (Express-Reis, Körnermischung, Gyoza).
// Sonst isst man alles aus Becher, Schale oder Packung.
//
// Produkte ohne Online-Preis (Burritos, User 24.09.2026) tragen price null + priceNote; die App zeigt dann „€X + ?“.
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
const MAX_PRODUCTS = 4;   // verschiedene Produkte je Gericht (User 19.09.2026: 3; User 26.09.2026: Kombis mit 4 Produkten)
const MAX_SAME = 3;       // dieselbe Packung höchstens so oft (Tippfehler-Schutz)

// Ein Produkt bei seiner Menge → fertiges Item (dieselbe Rechnung wie im Supermarkt-Tab: Werte je 100 g × Menge)
function itemOf(p, grams) {
  const g = U.round(grams != null ? grams : p.portionG, 1);
  // Name wie im Supermarkt-Tab: die Menge steht nur dran, wenn sie von der Packung abweicht (Abtropfgewicht); Eat Happy
  // (Gewicht schwankt täglich) nennt immer sein Standardgewicht: „(362 g typ.)“
  const showG = Math.abs(g - U.round(p.packG, 1)) > 0.05;
  const suffix = showG ? " (" + (Math.round(g * 10) / 10) + " g" + (p.drainedG != null ? " drained" : "") + ")" : p.variable ? " (" + g + " g typ.)" : "";
  const o = { id: U.slugId(p.name), name: p.name + suffix, brand: p.brand, cat: p.cat, g };
  for (const k of U.KEYS) o[k] = U.round((p.per100[k] || 0) * g / 100, 1);
  o.price = p.price;
  if (p.price == null) o.priceNote = p.priceNote || "no price online";
  o.url = p.url;
  if (p.drainedG != null) o.drained = true;
  if (p.eathappy) o.eathappy = true;   // Schalter „Must include Eat Happy“ (User 26.09.2026)
  if (p.variable) o.variable = true;   // Gewicht schwankt: die Werte gelten fürs Standardgewicht
  if (p.offline) o.offline = true;     // weder im Onlineshop noch auf edeka.de (Kulturheidelbeeren): kein Link, kein Preis
  // Quelle der Werte wie im Supermarkt-Tab (edeka-update.js): Herstellerseite als Domain, sonst die benannte Referenz
  if (p.manufacturerUrl) o.ref = (p.manufacturerUrl.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] + " (manufacturer)";
  else if (p.valuesFrom) o.ref = p.valuesFrom.split(" — ")[0].replace(/,.*$/, "");
  return o;
}

// Behälter-Hinweis und Begründung aus den Produkten
function containerOf(items) {
  const tin = items.some(x => x.drained), heat = items.some(x => HEAT_CATS.has(x.cat));
  const roll = items.some(x => x.cat === "bread") && items.some(x => x.cat === "coldcuts");
  const why = tin && heat ? "Heat the rice or gyoza, drain the tin and mix everything in a bowl."
    : tin ? "You have to drain the tin and tip it into a bowl."
    : heat ? "Heat the rice, grain mix or gyoza and mix it in a bowl."
    : "Everything can be eaten out of its own pot, tray or pack" + (roll ? " — cold cuts go on the roll." : ".");
  return { container: tin || heat, why };
}

const itemsKey = items => items.map(x => x.id + "@" + x.g).join("|");

// old = bisheriger Block ({ updated, meals }) oder null; refresh = true (alle Gerichte neu aus den Edeka-Daten) oder
// eine Liste von Gericht-ids (nur diese neu)
function buildData(raw, edeka, opts) {
  const o = opts || {};
  const renew = id => o.refresh === true || (Array.isArray(o.refresh) && o.refresh.includes(id));
  const today = o.today || new Date().toISOString().slice(0, 10);
  const oldById = new Map(((o.old && o.old.meals) || []).map(m => [m.id, m]));
  const oldDate = (o.old && o.old.updated) || today;
  const byName = new Map(edeka.items.filter(x => !x.noData).map(x => [x.name, x]));
  const meals = [], ids = new Set(), kept = [], fresh = [];
  for (const m of raw.meals) {
    if (ids.has(m.id)) throw new Error("Gericht-id doppelt: " + m.id);
    ids.add(m.id);
    if (!CATS.some(c => c.id === m.temp)) throw new Error(m.id + ": unbekannt warm/kalt: " + m.temp);
    const distinct = [...new Set(m.items)];
    if (!distinct.length || distinct.length > MAX_PRODUCTS) throw new Error(m.id + ": " + distinct.length + " verschiedene Produkte (erlaubt 1–" + MAX_PRODUCTS + ")");
    for (const n of distinct) if (m.items.filter(x => x === n).length > MAX_SAME) throw new Error(m.id + ": „" + n + "“ mehr als " + MAX_SAME + "×");
    let items = m.items.map(n => {
      const p = byName.get(n);
      if (!p) throw new Error(m.id + ": Produkt „" + n + "“ gibt es im Edeka-Tab nicht");
      return itemOf(p, m.g && m.g[n] != null ? m.g[n] : null);
    });
    let asOf = today;
    const old = oldById.get(m.id);
    if (!renew(m.id) && old && itemsKey(old.items) === itemsKey(items)) { items = old.items; asOf = old.asOf || oldDate; kept.push(m.id); }
    else fresh.push(m.id);
    meals.push({ id: m.id, name: m.name, cat: m.temp, asOf, ...containerOf(items), items });
  }
  const updated = meals.reduce((a, m) => (m.asOf > a ? m.asOf : a), "");
  return { cats: CATS.map(c => ({ ...c, on: true })), meals, updated, kept, fresh };
}

function blockLines(raw, edeka, opts) {
  const data = buildData(raw, edeka, opts);
  const dates = [...new Set(data.meals.map(m => m.asOf))].sort();
  const lines = [
    "// Quelle: data/meals.json (vom User bestätigte Kombinationen) × data/edeka-raw.json — Schnappschuss der Werte (Stand je Gericht: asOf, " + dates.join(" / ") + "),",
    "// damit die Gerichte unabhängig vom Onlineshop bleiben. Neue Gerichte: node meals-update.js · alle erneuern: node meals-update.js --refresh",
    "const " + KEY + " = {",
    "  updated: " + JSON.stringify(data.updated) + ",",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  meals: [");
  for (const m of data.meals) {
    lines.push("    { id:" + JSON.stringify(m.id) + ", name:" + JSON.stringify(m.name) + ", cat:" + JSON.stringify(m.cat) +
      ", container:" + m.container + ", why:" + JSON.stringify(m.why) + ", asOf:" + JSON.stringify(m.asOf) + ", items:[");
    for (const x of m.items) lines.push("      " + lit(x) + ",");
    lines.push("    ] },");
  }
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node meals-update.js aus data/meals.json + data/edeka-raw.json", lines), data };
}

// Bisherigen Block aus index.html lesen (für den Schnappschuss und die Änderungsmeldung)
function readOldBlock(html) {
  const a = html.indexOf("// __" + KEY + "_DATA_START__"), b = html.indexOf("// __" + KEY + "_DATA_END__");
  if (a < 0 || b < 0) return null;
  try { return new Function(html.slice(a, b) + "\n;return " + KEY + ";")(); } catch (e) { return null; }
}

const sumOf = m => m.items.reduce((a, x) => { for (const k of U.KEYS) a[k] += x[k]; a.price += x.price || 0; if (x.price == null) a.unknown = true; return a; },
  Object.assign(Object.fromEntries(U.KEYS.map(k => [k, 0])), { price: 0, unknown: false }));

module.exports = { buildData, blockLines, sumOf, itemOf, containerOf, readOldBlock };

if (require.main === module) {
  const fs = require("fs");
  // --refresh = alle Gerichte erneuern · --refresh=m18,m19 = nur diese
  const arg = process.argv.find(a => a === "--refresh" || a.indexOf("--refresh=") === 0);
  const refresh = !arg ? false : arg === "--refresh" ? true : arg.slice(10).split(",").map(x => x.trim()).filter(Boolean);
  const raw = U.readJSON(RAW), edeka = U.readJSON(EDEKA_RAW);
  const html = fs.readFileSync(INDEX, "utf8");
  const old = readOldBlock(html);
  const oldById = new Map(((old && old.meals) || []).map(m => [m.id, m]));
  const { lines, data } = blockLines(raw, edeka, { old, refresh });
  U.writeBlock(INDEX, KEY, lines);
  const t = raw._meta.targets, r1 = x => Math.round(x * 10) / 10;
  console.log(data.meals.length + " Gerichte → index.html (" + KEY + "-Block" + (refresh === true ? ", alle erneuert" : refresh ? ", erneuert: " + refresh.join(", ") : "") + "): " +
    data.cats.map(c => c.name + " " + data.meals.filter(m => m.cat === c.id).length).join(", ") +
    " · " + data.meals.filter(m => m.container).length + "× Schüssel nötig");
  for (const m of data.meals) {
    const n = sumOf(m);
    const miss = Object.entries(t).filter(([k, [lo, hi]]) => n[k] < lo || n[k] > hi).map(([k]) => k);
    const was = oldById.get(m.id), counts = {};
    for (const x of m.items) counts[x.id] = (counts[x.id] || 0) + 1;
    const wasN = was && sumOf(was);
    console.log((miss.length ? "  ! " : "  ✓ ") + m.id.padEnd(4) + m.name.slice(0, 44).padEnd(46) +
      Math.round(n.kcal) + " kcal · C " + r1(n.carbs) + " · P " + r1(n.protein) + " · F " + r1(n.fat) +
      " · Fib " + r1(n.fibre) + " · Salz " + r1(n.salt) + " · " + n.price.toFixed(2) + " €" + (n.unknown ? " + ?" : "") +
      (m.container ? "  🥣" : "  📦") + " (" + m.asOf + ")" + (miss.length ? "   außerhalb: " + miss.join(", ") : "") +
      (Object.values(counts).some(c => c > 1) ? "   [" + Object.entries(counts).filter(([, c]) => c > 1).map(([id, c]) => c + "× " + id).join(", ") + "]" : "") +
      (was && was.container !== m.container ? "   [Behälter-Hinweis geändert: " + (m.container ? "jetzt nötig" : "jetzt nicht mehr nötig") + "]" : "") +
      (was && wasN && Math.abs(wasN.kcal - n.kcal) > 0.05 ? "   [Werte geändert: " + Math.round(wasN.kcal) + " → " + Math.round(n.kcal) + " kcal]" : "") +
      (was ? "" : "   [neu]"));
  }
  const gone = [...oldById.keys()].filter(id => !data.meals.some(m => m.id === id));
  if (gone.length) console.log("Nicht mehr im Block: " + gone.join(", "));
  console.log("Schnappschuss übernommen: " + (data.kept.join(", ") || "—") + " · neu bzw. erneuert: " + (data.fresh.join(", ") || "—"));
}
