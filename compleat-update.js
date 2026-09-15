// Generiert den COMPLEAT-Block in index.html aus data/compleat-raw.json: node compleat-update.js
// Build-Your-Own (kind:"byo"): kompletter Shop-Datensatz (Werte pro 100 g + Portion) plus das Wolt-Menü „Build your Bowl"
// mit fertigen Portionswerten je Wolt-Option (pro 100 × Wolt-Menge / 100).
//
// GESPERRTE Zutaten (raw.ingredients[].blocked, aktuell Bunter Bio Quinoa — User 15.09.2026) bleiben im Datensatz, werden
// aber aus ALLEN Plattform-Menüs weggelassen → nie im Rechner, nie in der Suche, nie als Ausschluss-Option.
// Das gilt auch für künftige Plattformen (z.B. Uber Eats): deren Menü ebenfalls über buildMenu() erzeugen.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "COMPLEAT";
const RAW = path.join(__dirname, "data", "compleat-raw.json");
const GROUP_ORDER = ["base", "protein", "extra", "dip"];

// Kurzname für Karten/Titel: Text vor dem ersten Komma ("Rotkohl, geraspelt, 50 g" → "Rotkohl")
const shortName = n => String(n).split(",")[0].trim();
// JS-Literal ohne Anführungszeichen um einfache Keys (wie die übrigen Datenblöcke)
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");

function buildMenu(raw, platform) {
  const menu = raw[platform];
  if (!menu) throw new Error("Plattform fehlt in raw.json: " + platform);
  const ingById = Object.fromEntries(raw.ingredients.map(x => [x.id, x]));
  const used = new Set(), skipped = [];
  const groups = [...menu.groups].sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id)).map(g => ({
    id: g.id, name: g.name, min: g.min, max: g.max, none: g.noneOption || null,
    options: g.options.filter(o => {
      const ing = ingById[o.ingredient];
      if (!ing) throw new Error("Zutat fehlt: " + o.ingredient + " (" + o.name + ")");
      if (ing.blocked) { skipped.push(g.name + ": " + o.name); return false; } // gesperrt → nie im Rechner
      return true;
    }).map(o => {
      const ing = ingById[o.ingredient];
      let id = U.slugId(g.id + "_" + o.name);
      while (used.has(id)) id += "_2";
      used.add(id);
      const opt = { id, name: o.name, short: shortName(o.name), group: g.id, ing: o.ingredient, amount: o.amount, unit: o.unit, maxQty: o.maxQty };
      for (const k of U.KEYS) opt[k] = U.round(ing.per100[k] * o.amount / 100, 2);
      if (ing.crunch) opt.crunch = true;
      if (ing.shellfish) opt.shellfish = true;
      return opt;
    }),
  }));
  return { groups, skipped };
}

function blockLines(raw) {
  const wolt = buildMenu(raw, "wolt");
  const blocked = raw.ingredients.filter(x => x.blocked);
  const lines = [
    "// Quelle: Compleat-Onlineshop (compleat.vmos.io, Frankfurt Nordend), Stand " + raw._meta.fetchedAt.slice(0, 10) + " · Shop-Werte pro 100 g × Menge · Wolt „" + raw.wolt.item + "“",
    ...blocked.map(x => "// GESPERRT (nie im Rechner, auch nicht auf künftigen Plattformen): " + x.shopName + " — " + x.blocked),
    "const " + KEY + " = {",
    "  // Kompletter Shop-Datensatz (auch Zutaten, die Wolt nicht anbietet) — Grundlage für weitere Plattformen",
    "  ingredients: [",
  ];
  for (const x of raw.ingredients) {
    const o = { id: x.id, name: x.name, group: x.group, portion: x.portion, unit: x.unit, per100: x.per100, allergens: x.allergens };
    if (x.halfPortion) o.halfPortion = x.halfPortion;
    if (x.crunch) o.crunch = true;
    if (x.shellfish) o.shellfish = true;
    if (x.blocked) o.blocked = x.blocked;
    lines.push("    " + lit(o) + ",");
  }
  lines.push("  ],", "  wolt: {", "    item: " + JSON.stringify(raw.wolt.item) + ", page: " + JSON.stringify(raw.wolt.page) + ",", "    groups: [");
  for (const g of wolt.groups) {
    lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + ",options:[");
    for (const o of g.options) lines.push("        " + lit(o) + ",");
    lines.push("      ] },");
  }
  lines.push("    ],", "  },", "};");
  return { lines: U.wrapBlock(KEY, "node compleat-update.js aus data/compleat-raw.json", lines), wolt };
}

module.exports = { buildMenu, blockLines, shortName };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, wolt } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(raw.ingredients.length + " Zutaten · Wolt: " + wolt.groups.map(g => g.name + " " + g.options.length).join(", ") + " → index.html (" + KEY + "-Block)");
  if (wolt.skipped.length) console.log("Gesperrt, nicht im Wolt-Menü des Rechners: " + wolt.skipped.join(", "));
}
