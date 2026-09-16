// Generiert den DEANDAVID-Block in index.html aus data/deandavid-raw.json: node deandavid-update.js
// Build-Your-Own (kind:"byo") mit zwei Wolt-Menüs: „Mix Your Own Salad bar“ (salad) und „Mix Your Own Bowl bar“ (bowl).
// Jede Option trägt die offiziellen Werte PRO PORTION. Dressing/Sauce und Brot sind Einzelauswahl-Rollen (dip, side) mit je einer Variante
// „+1 Portion“ (User 16.09.2026: „Extra Dressing/Sauce“ = +1 Portion, „extra Brot“ = +1 Scheibe) — die Variante bestellt man als Grundoption
// plus Eintrag in „EXTRA BROT/DRESSING DAZU?“ (orderName + order). Der Premium Blattsalatmix ist fester Bestandteil beider Menüs.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "DEANDAVID";
const RAW = path.join(__dirname, "data", "deandavid-raw.json");
const MENUS = ["salad", "bowl"];
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const nut = (ing, f) => Object.fromEntries(U.KEYS.map(k => [k, U.round(ing.perPortion[k] * (f || 1), 2)]));
const shortName = n => String(n).replace(/ extra$/, "");

function buildMenu(raw, key) {
  const m = raw[key];
  if (!m) throw new Error("Menü fehlt in raw.json: " + key);
  const byId = Object.fromEntries(raw.ingredients.map(x => [x.id, x]));
  const ex = m.extraBreadDressing;
  if (!ex || !ex.dressing || !ex.bread) throw new Error(key + ": Extra Brot/Dressing fehlt");
  const used = new Set();
  const uid = s => { let id = U.slugId(s); while (used.has(id)) id += "_2"; used.add(id); return id; };
  const groups = m.groups.map(g => {
    const opts = [], variants = [];
    for (const o of g.options) {
      const ing = byId[o.ingredient];
      if (!ing) throw new Error("Baustein fehlt: " + o.ingredient + " (" + o.name + ")");
      if (typeof o.price !== "number" || !(o.price >= 0)) throw new Error("Preis fehlt: " + o.name);
      const base = { id: uid(g.id + "_" + o.name), name: o.name, short: g.kind === "side" ? "Landbrot" : shortName(o.name), group: g.id, role: o.role, ing: o.ingredient, maxQty: o.maxQty, price: o.price, ...nut(ing) };
      opts.push(base);
      if (g.kind === "dip" || g.kind === "side") {
        const extra = g.kind === "dip" ? ex.dressing : ex.bread;
        variants.push({ id: uid(g.id + "_" + o.name + "_2"), name: o.name + " + " + extra.name, short: "2× " + base.short, group: g.id, role: o.role, ing: o.ingredient, variant: true,
          maxQty: 1, price: U.round(o.price + extra.price, 2), orderName: o.name, order: [{ group: ex.id, name: extra.name }], ...nut(ing, 2) });
      }
    }
    return { id: g.id, name: g.name, min: g.min, max: g.max, none: g.none || null, options: opts.concat(variants) };
  });
  const fixed = m.fixed.map(id => {
    const ing = byId[id];
    if (!ing) throw new Error("fester Bestandteil fehlt: " + id);
    return { id: "fix_" + id, name: ing.name, short: ing.name, ing: id, price: 0, ...nut(ing) };
  });
  if (typeof m.itemPrice !== "number") throw new Error("Grundpreis fehlt: " + key);
  return { item: m.item, page: m.page, basePrice: m.itemPrice, require: m.require, fixed, groups };
}

function blockLines(raw) {
  const menus = MENUS.map(k => [k, buildMenu(raw, k)]);
  const lines = [
    "// Quelle: dean&david Nährwerttabelle (August 2026, Werte pro Portion) + Allergenliste (bis Dezember 2026) · Menüs + Preise: Wolt " + raw._meta.sources.wolt.venue + ", Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  // Mix-Your-Own-Bausteine der Nährwerttabelle (auch die, die Wolt nicht anbietet); Werte pro 100 g und pro Portion",
    "  ingredients: [",
  ];
  for (const x of raw.ingredients) {
    const o = { id: x.id, name: x.name, pdfName: x.pdfName, section: x.section, portionG: x.portionG, per100: x.per100, perPortion: x.perPortion, allergens: x.allergens || [] };
    if (x.shellfish) o.shellfish = true;
    lines.push("    " + lit(o) + ",");
  }
  lines.push("  ],");
  for (const [k, m] of menus) {
    lines.push("  " + k + ": {", "    item: " + JSON.stringify(m.item) + ", page: " + JSON.stringify(m.page) + ", basePrice: " + m.basePrice + ", require: " + lit(m.require) + ",", "    fixed: [" + m.fixed.map(lit).join(",") + "],", "    groups: [");
    for (const g of m.groups) {
      lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + ",options:[");
      for (const o of g.options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("};");
  return { lines: U.wrapBlock(KEY, "node deandavid-update.js aus data/deandavid-raw.json", lines), menus };
}

module.exports = { buildMenu, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, menus } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(raw.ingredients.length + " Bausteine → index.html (" + KEY + "-Block)");
  for (const [k, m] of menus) console.log("  " + k + " „" + m.item + "“ (Grundpreis " + m.basePrice + " €): " + m.groups.map(g => g.name + " " + g.options.length).join(", "));
}
