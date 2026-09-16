// Generiert den CHIDOBA-Block in index.html aus data/chidoba-raw.json: node chidoba-update.js
// Build-Your-Own (kind:"byo") mit zwei Wolt-Menüs je Produktart: cup und salat. Rollen für die Bowl-Engine: Produkt (z.B. „Chicken Cup“) = protein
// (genau 1; Werte = Fleisch-Portion laut Rechner), Basis = side (Cup, 0–1), Black Beans = extra in eigener Gruppe (abwählbare Standard-Zutat),
// Cream/Salsa = extra mit eigener Grenze 1, Extras = extra (Extras-Chip), Snack „Chili con Carne“ = extra in eigener Gruppe (zweiter Artikel).
// Übrige Standard-Zutaten sind feste Bestandteile (fixed, mit „Ohne …“-Namen; sauce:true = fällt mit „No sauce/cheese/dips“ weg).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "CHIDOBA";
const RAW = path.join(__dirname, "data", "chidoba-raw.json");
const TYPES = { cup: { item: "Cup", products: "Cups" }, salat: { item: "Salat", products: "Salate" } };
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
// Werte je Portion; Schalentier laut Rechner-Allergenen sperrt die Option (isShellfish), aktuell kein Baustein
const nut = c => Object.assign(Object.fromEntries(U.KEYS.map(k => [k, U.round(c.perPortion[k], 3)])), c.shellfish ? { shellfish: true } : {});

function buildMenu(raw, type) {
  const T = TYPES[type];
  if (!T) throw new Error("Unbekannte Produktart: " + type);
  const groupsRaw = raw.wolt.menus[type];
  if (!groupsRaw) throw new Error("Menü fehlt in raw.json: " + type);
  const byComp = Object.fromEntries(raw.components.map(c => [c.id, c]));
  const compOf = id => { const c = byComp[id]; if (!c) throw new Error("Baustein fehlt: " + id); return c; };
  const pre = type + "_", used = new Set();
  const uid = s => { let id = pre + U.slugId(s); while (used.has(id)) id += "_2"; used.add(id); return id; };
  const groups = [], fixed = [], removals = [], ohneOrder = [];
  const products = raw.wolt.products.filter(p => p.type === type);
  if (!products.length) throw new Error("Keine Produkte: " + type);
  groups.push({ id: "produkt", name: T.products, min: 1, max: 1, none: null, options: products.map(p => {
    const c = compOf(p.component);
    return { id: uid("produkt_" + p.name), name: p.name, short: p.name, group: "produkt", role: "protein", ing: p.protein, maxQty: 1, price: p.price, ...nut(c) };
  }) });
  if (type === "salat") {
    const c = compOf(raw.wolt.saladBase);
    fixed.push({ id: uid("fix_" + c.ing), name: c.name, short: c.name, ing: c.ing, price: 0, ...nut(c) });
  }
  for (const g of groupsRaw) {
    if (g.kind === "standard") {
      const opts = [];
      for (const o of g.options) {
        const c = compOf(o.component);
        if (o.optional) opts.push({ id: uid("zutaten_" + o.name), name: o.name, short: o.name, group: "zutaten", role: "extra", ing: o.ing, maxQty: 1, price: 0, removeName: o.removeName, ...nut(c) });
        else fixed.push(Object.assign({ id: uid("fix_" + o.ing), name: o.name, short: o.name, ing: o.ing, price: 0, removeName: o.removeName }, o.sauce ? { sauce: true } : {}, o.defaultOff ? { defaultOff: true } : {}, nut(c)));
      }
      removals.push(...g.removals);
      ohneOrder.push(...(g.ohneOrder || []));
      groups.push({ id: "zutaten", name: g.name, min: g.min, max: g.max, none: null, own: true, options: opts });
      continue;
    }
    const role = g.kind === "base" ? "side" : "extra";
    const grp = Object.assign({ id: g.id, name: g.name, min: g.min, max: g.max, none: g.none || null }, g.kind === "cream" || g.kind === "salsa" ? { own: true } : {}, { options: [] });
    for (const o of g.options) {
      const c = compOf(o.component);
      // Salsa heißt bei Wolt nur „Mild“ → Kurzname mit „Salsa“ (Karten-Titel); gleiche Werte wie „Medium“ (User 16.09.2026) → „Mild or Medium“
      const names = [o.name, ...(o.also || [])];
      grp.options.push(Object.assign({ id: uid(g.id + "_" + o.name), name: o.name, short: g.kind === "salsa" ? "Salsa " + names.join("/") : o.name, group: g.id, role, ing: o.ing, maxQty: 1, price: o.price },
        names.length > 1 ? { orderName: names.join(" or ") + " (your choice)" } : {}, o.sauce ? { sauce: true } : {}, nut(c)));
    }
    groups.push(grp);
  }
  const ch = raw.wolt.chili;
  if (!ch) throw new Error("Chili con Carne fehlt");
  groups.push({ id: "chili", name: "Snacks", min: 0, max: 1, none: null, own: true, options: [{ id: uid("chili_" + ch.name), name: ch.name, short: ch.name, group: "chili", role: "extra", ing: ch.ing, maxQty: 1, price: ch.price, ...nut(compOf(ch.component)) }] });
  return { item: T.item, type, basePrice: 0, require: { base: false, protein: true }, proteinExtras: true, fixed, removals, ohneOrder, groups };
}

function blockLines(raw) {
  const menus = Object.keys(TYPES).map(tp => [tp, buildMenu(raw, tp)]);
  const ings = new Map();
  for (const [, m] of menus) for (const x of [...m.fixed, ...m.groups.flatMap(g => g.options)]) if (!ings.has(x.ing)) ings.set(x.ing, { id: x.ing, name: x.group === "produkt" ? x.name.replace(/ (Cup|Salat)$/, "") : x.name, valuesOnOptions: true });
  const lines = [
    "// Quelle: chidoba-Nährwertrechner (chidoba.com/nutrition, Werte je Portion und Produktart) · Menü + Preise: Wolt " + raw.wolt.venue + " (Kaiserstraße), Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  // Zutaten-ids (Ausschluss/Pflicht über Cup und Salat hinweg); die Werte stehen je Produktart an den Optionen",
    "  ingredients: [",
  ];
  for (const x of ings.values()) lines.push("    " + lit(x) + ",");
  lines.push("  ],");
  for (const [tp, m] of menus) {
    lines.push("  " + tp + ": {", "    item: " + JSON.stringify(m.item) + ", type: " + JSON.stringify(m.type) + ", basePrice: 0, require: " + lit(m.require) + ", proteinExtras: true, removals: " + lit(m.removals) + ",", "    ohneOrder: " + lit(m.ohneOrder) + ",", "    fixed: [");
    for (const f of m.fixed) lines.push("      " + lit(f) + ",");
    lines.push("    ],", "    groups: [");
    for (const g of m.groups) {
      lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + (g.own ? ",own:true" : "") + ",options:[");
      for (const o of g.options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("};");
  return { lines: U.wrapBlock(KEY, "node chidoba-update.js aus data/chidoba-raw.json", lines), menus };
}

module.exports = { buildMenu, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, menus } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  for (const [tp, m] of menus) console.log(tp + ": fest " + m.fixed.map(f => f.name + (f.sauce ? "*" : "")).join(", ") + " · " + m.groups.map(g => g.name + " " + g.options.length).join(", ") + (m.removals.length ? " · immer " + m.removals.join(", ") : ""));
}
