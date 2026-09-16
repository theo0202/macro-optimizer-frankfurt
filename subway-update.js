// Generiert den SUBWAY-Block in index.html aus data/subway-raw.json: node subway-update.js
// Build-Your-Own (kind:"byo") mit zwei Wolt-Menüs je Größe: small (15-CM) und footlong (FOOTLONG, alle Werte ×2 laut Nährwerttabelle).
// Rollen für die Bowl-Engine: Sub = protein (genau 1; „Extra Fleisch / Protein“ als Variante mit doppelter Portion), Brot = base (genau 1),
// Käse = side (0–1), Extras = extra (zählen zum Extras-Chip), Veggies/Saucen/Seasonings = extra mit eigener Wolt-Obergrenze (own);
// Veggies wählt der Optimizer nie selbst (pick), nur über „Standard veggies“ oder „Must include“. Gesperrte Bausteine fehlen in den Menüs.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "SUBWAY";
const RAW = path.join(__dirname, "data", "subway-raw.json");
const SIZES = ["small", "footlong"];
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const nut = (ing, f) => Object.fromEntries(U.KEYS.map(k => [k, U.round(ing.perPortion[k] * f, 2)]));
const shortName = n => String(n).replace(/®/g, "").trim();

function buildMenu(raw, size) {
  const S = raw.wolt && raw.wolt[size];
  if (!S) throw new Error("Größe fehlt in raw.json: " + size);
  const f = S.factor, pre = size === "footlong" ? "fl_" : "";
  if (!(f === 1 || f === 2)) throw new Error("Faktor unplausibel: " + f);
  const byId = Object.fromEntries(raw.ingredients.map(x => [x.id, x]));
  const blocked = new Set(raw.ingredients.filter(x => x.blocked).map(x => x.id));
  const used = new Set();
  const uid = s => { let id = pre + U.slugId(s); while (used.has(id)) id += "_2"; used.add(id); return id; };
  const ingOf = id => { const x = byId[id]; if (!x) throw new Error("Baustein fehlt: " + id); return x; };
  const price = v => { if (typeof v !== "number" || !(v >= 0)) throw new Error("Preis fehlt"); return U.round(v, 2); };
  const groups = [];
  // Pseudo-Gruppe „Create Your Own“: je Sub der Wolt-Artikel (Preis = Artikel + Größe) und ggf. die Variante mit „Extra Fleisch / Protein“
  const subs = { id: "sub", name: raw.wolt.category, min: 1, max: 1, none: null, options: [] }, variants = [];
  const maxOf = {};
  for (const g of S.groups) maxOf[g.id] = g.max;
  for (const s of S.subs) {
    const ing = ingOf(s.ingredient);
    const lower = Object.fromEntries(Object.entries(s.groupMax).filter(([g, m]) => maxOf[g] != null && m < maxOf[g]));
    const base = { id: uid("sub_" + s.name), name: s.name, short: shortName(s.name), group: "sub", role: "protein", ing: s.ingredient, maxQty: 1, price: price(s.price),
      sizeName: s.sizeName, none: s.none, ...nut(ing, f) };
    if (Object.keys(lower).length) base.groupMax = lower;
    subs.options.push(base);
    if (s.extraProtein) variants.push(Object.assign({}, base, { id: uid("sub_" + s.name + "_" + s.extraProtein.name), name: s.name + " + " + s.extraProtein.name, short: "2× " + base.short,
      variant: true, price: price(s.price + s.extraProtein.price), orderName: s.name, order: [{ group: "extras", name: s.extraProtein.name }], ...nut(ing, 2 * f) }));
  }
  subs.options = subs.options.concat(variants);
  groups.push(subs);
  for (const g of S.groups) {
    // Schlüssel-Reihenfolge wie im Block (tests.js vergleicht Block und buildMenu per JSON)
    const grp = Object.assign({ id: g.id, name: g.name, min: g.min, max: g.max, none: g.none || null }, g.own ? { own: true } : {}, g.kind === "prep" ? { choices: g.choices } : {}, { options: [] });
    if (g.kind === "prep") { groups.push(grp); continue; }
    for (const o of g.options) {
      if (blocked.has(o.ingredient)) continue;
      const ing = ingOf(o.ingredient);
      const opt = { id: uid(g.id + "_" + o.name), name: o.name, short: shortName(o.name), group: g.id, role: o.role, ing: o.ingredient, maxQty: o.maxQty, price: price(o.price), ...nut(ing, f) };
      if (o.pick) opt.pick = true;
      if (o.sauce) opt.sauce = true;
      grp.options.push(opt);
    }
    groups.push(grp);
  }
  return { item: raw.wolt.category, page: raw.wolt.page, size: S.label, factor: f, basePrice: 0, require: { base: true, protein: true }, proteinExtras: true, pickRoles: ["side", "extra"], groups };
}

function blockLines(raw) {
  const menus = SIZES.map(k => [k, buildMenu(raw, k)]);
  const lines = [
    "// Quelle: Subway Deutschland Nährwertinformationen September 2026 (Werte pro 15-cm-Portion; Footlong ×2) · Menü + Preise: Wolt " + raw.wolt.venue + " („" + raw.wolt.category + "“), Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  // Sub-Bausteine der Nährwerttabelle (Brot, Käse, Saucen, Toppings, Einzel-Zutaten — auch die, die im Tracker nicht vorkommen); Werte pro 100 g und pro 15-cm-Portion",
    "  ingredients: [",
  ];
  for (const x of raw.ingredients) {
    const o = { id: x.id, name: x.name, section: x.section, portionG: x.portionG, per100: x.per100, perPortion: x.perPortion };
    if (x.blocked) { o.blocked = true; o.blockedReason = x.blockedReason; }
    lines.push("    " + lit(o) + ",");
  }
  lines.push("  ],", "  stdVeggies: " + lit(raw._meta.stdVeggies) + ", // User 16.09.2026: Eisbergsalat, Tomaten, Rote Paprika, Rote Zwiebeln, Mais");
  for (const [k, m] of menus) {
    lines.push("  " + k + ": {", "    item: " + JSON.stringify(m.item) + ", page: " + JSON.stringify(m.page) + ", size: " + JSON.stringify(m.size) + ", factor: " + m.factor + ", basePrice: 0, require: " + lit(m.require) + ", proteinExtras: true, pickRoles: " + lit(m.pickRoles) + ",", "    groups: [");
    for (const g of m.groups) {
      lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + (g.own ? ",own:true" : "") + (g.choices ? ",choices:" + JSON.stringify(g.choices) : "") + ",options:[");
      for (const o of g.options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("};");
  return { lines: U.wrapBlock(KEY, "node subway-update.js aus data/subway-raw.json", lines), menus };
}

module.exports = { buildMenu, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, menus } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(raw.ingredients.length + " Bausteine → index.html (" + KEY + "-Block)");
  for (const [k, m] of menus) console.log("  " + k + " (" + m.size + ", ×" + m.factor + "): " + m.groups.map(g => g.name + " " + g.options.length + (g.own ? " [eigene Grenze " + g.max + "]" : "")).join(", "));
}
