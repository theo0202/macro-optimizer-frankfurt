// Generiert den CHIDOBA-Block in index.html aus data/chidoba-raw.json: node chidoba-update.js
// Build-Your-Own (kind:"byo"): je Produktart mit Bestellfenster ein Wolt-Menü (cup, salat, burrito, taco, taco_veggie, taco_vegan) + die Snacks &
// Sides ohne Umbau (snacks) + die Kategorie-Chips (cats, User 27.09.2026). Rollen für die Bowl-Engine: Produkt (z.B. „Chicken Burrito“) = protein
// (genau 1; Werte = Fleisch-Portion laut Rechner), Basis = side (0–1), Black Beans / „Mit Eisbergsalat“ = extra in eigener Gruppe (abwählbare bzw.
// dazunehmbare Standard-Zutat), Cream/Salsa = extra mit eigener Grenze 1, Extras = extra (Extras-Chip). Snacks & Sides hängt die App je Suche als
// Portionen-Gruppe dazu (Rolle base, auch mehrfach). Übrige Standard-Zutaten sind feste Bestandteile (fixed, mit „Ohne …“-Namen und ihrer
// Wolt-Gruppe; sauce:true = fällt mit „No sauce/cheese/dips“ weg). steps = die Gruppen des Wolt-Bestellfensters (Order Guide), je Produkt in
// seiner Reihenfolge (dialog).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "CHIDOBA";
const RAW = path.join(__dirname, "data", "chidoba-raw.json");
const TYPES = {
  cup: { item: "Cup", products: "Cups", cat: "cup" },
  salat: { item: "Salat", products: "Salate", cat: "salat" },
  burrito: { item: "Burrito", products: "Burritos", cat: "burrito" },
  taco: { item: "3 Soft Tacos", products: "Soft-Tacos", cat: "taco" },
  taco_veggie: { item: "3 Veggie Soft Tacos", products: "Soft-Tacos (Veggie)", cat: "taco" },
  taco_vegan: { item: "3 Vegan Soft Tacos", products: "Soft-Tacos (Vegan)", cat: "taco" },
};
// Kategorie-Chips (User 27.09.2026): Hauptprodukte (höchstens eins je Bestellung) und Snacks & Sides; Chili con Carne startet AUS
// (bisheriger Schalter „Add Chili con carne“, User 16.09.2026)
const CATS = [
  { id: "cup", name: "Cup", kind: "main", on: true }, { id: "salat", name: "Salat", kind: "main", on: true },
  { id: "burrito", name: "Burrito", kind: "main", on: true }, { id: "taco", name: "Tacos (3×)", kind: "main", on: true },
  { id: "quesadillas", name: "Quesadillas", kind: "snack", on: true }, { id: "crunchwraps", name: "Crunchwraps", kind: "snack", on: true },
  { id: "tostados", name: "Tostados", kind: "snack", on: true }, { id: "chili", name: "Chili con Carne", kind: "snack", on: false },
];
const STEP_KIND = { base: "base", standard: "standard", cream: "choice", salsa: "choice", extras: "extras", skip: "skip" };
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
// Werte je Portion; Schalentier laut Rechner-Allergenen sperrt die Option (isShellfish), aktuell kein Baustein
const nut = c => Object.assign(Object.fromEntries(U.KEYS.map(k => [k, U.round(c.perPortion[k], 3)])), c.shellfish ? { shellfish: true } : {});
// Name eines Produkts in Ausschluss-/Pflicht-Liste und Suche: das Protein („Chicken“), sonst die Taco-Variante
const PROTEINS = ["Chicken", "Beef", "Filetsteak", "Barbacoa"];
const listName = p => {
  const base = p.name.replace(/^3 ?x /i, "").replace(/ (Cup|Salat|Burrito|Soft Taco)$/, "");
  return /Soft Taco$/.test(p.name) && !PROTEINS.includes(base) ? base + " Soft Tacos" : base; // „Mix Soft Tacos“, „Veggie Soft Tacos“
};

function buildMenu(raw, type) {
  const T = TYPES[type];
  if (!T) throw new Error("Unbekannte Produktart: " + type);
  const groupsRaw = raw.wolt.menus[type];
  if (!groupsRaw) throw new Error("Menü fehlt in raw.json: " + type);
  const byComp = Object.fromEntries(raw.components.map(c => [c.id, c]));
  const compOf = id => { const c = byComp[id]; if (!c) throw new Error("Baustein fehlt: " + id); return c; };
  const pre = type + "_", used = new Set();
  const uid = s => { let id = pre + U.slugId(s); while (used.has(id)) id += "_2"; used.add(id); return id; };
  const groups = [], fixed = [], removals = [], steps = [];
  const products = raw.wolt.products.filter(p => p.type === type);
  if (!products.length) throw new Error("Keine Produkte: " + type);
  groups.push({ id: "produkt", name: T.products, min: 1, max: 1, none: null, options: products.map(p => {
    const c = compOf(p.component);
    return Object.assign({ id: uid("produkt_" + p.name), name: p.name, short: p.name, group: "produkt", role: "protein", ing: p.protein, maxQty: 1, price: p.price, listName: listName(p), dialog: p.dialog },
      p.protein === "mix_taco" ? { contains: ["chicken", "beef", "barbacoa"] } : {}, nut(c));
  }) });
  // immer enthalten: Salat-Basis, Tortilla, Soft-Tortillas
  if (raw.wolt.shells[type]) { const c = compOf(raw.wolt.shells[type]); fixed.push({ id: uid("fix_" + c.ing), name: c.name, short: c.name, ing: c.ing, price: 0, ...nut(c) }); }
  const opt = [];
  for (const g of groupsRaw) {
    const step = { id: g.id, name: g.name, kind: STEP_KIND[g.kind], min: g.min, max: g.max };
    if (g.none) step.none = g.none;
    if (g.kind === "standard") step.ohne = g.ohneOrder;
    steps.push(step);
    if (g.kind === "skip") continue;
    if (g.kind === "standard") {
      for (const o of g.options) {
        const c = compOf(o.component);
        if (o.optional || o.addOn) opt.push(Object.assign({ id: uid("zutaten_" + o.name), name: o.name, short: o.name, group: "zutaten", role: "extra", ing: o.ing, maxQty: 1, price: 0 }, o.addOn ? { addName: o.addName } : { removeName: o.removeName }, nut(c)));
        else fixed.push(Object.assign({ id: uid("fix_" + o.ing), name: o.name, short: o.name, ing: o.ing, price: 0, removeName: o.removeName, removeGroup: g.id }, o.sauce ? { sauce: true } : {}, o.defaultOff ? { defaultOff: true } : {}, nut(c)));
      }
      removals.push(...g.removals);
      // abwählbare/dazunehmbare Standard-Zutaten als eigene Gruppe (nur „Wähle deine Zutaten“ hat welche)
      if (g.id === "zutaten" && opt.length) groups.push({ id: "zutaten", name: g.name, min: g.min, max: g.max, none: null, own: true, options: opt.splice(0) });
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
  if (opt.length) throw new Error(type + ": abwählbare Standard-Zutaten außerhalb von „Wähle deine Zutaten“");
  // Gruppen der Engine in einer festen Reihenfolge (Bestellfenster-Reihenfolge je Produkt steht in dialog)
  const ORDER = ["produkt", "basis", "zutaten", "cream", "salsa", "extras"];
  groups.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  for (const p of products) for (const s of p.dialog) if (!steps.some(x => x.id === s)) throw new Error(type + ": Schritt " + s + " fehlt");
  return { item: T.item, type, cat: T.cat, basePrice: 0, require: { base: false, protein: true }, proteinExtras: true, fixed, removals, steps, groups };
}

// Snacks & Sides (feste Rezeptur): Werte laut Rechner, Kategorie, Wolt-Preis; die App baut daraus je Suche die Gruppe „Snacks & sides“
function buildSnacks(raw) {
  const byComp = Object.fromEntries(raw.components.map(c => [c.id, c]));
  return raw.wolt.snacks.map(s => {
    const c = byComp[s.component];
    if (!c) throw new Error("Baustein fehlt: " + s.component);
    if (!CATS.some(k => k.id === s.cat && k.kind === "snack")) throw new Error("Snack " + s.name + ": unbekannte Kategorie " + s.cat);
    return Object.assign({ id: "snack_" + U.slugId(s.name), name: s.name, short: s.name, cat: s.cat, ing: s.ing, price: s.price }, s.orderNote ? { orderNote: s.orderNote } : {}, nut(c));
  });
}

function blockLines(raw) {
  const menus = Object.keys(TYPES).map(tp => [tp, buildMenu(raw, tp)]);
  const snacks = buildSnacks(raw);
  const ings = new Map();
  for (const [, m] of menus) for (const x of [...m.fixed, ...m.groups.flatMap(g => g.options)]) if (!ings.has(x.ing)) ings.set(x.ing, { id: x.ing, name: x.group === "produkt" ? x.listName : x.name, valuesOnOptions: true });
  for (const s of snacks) ings.set(s.ing, { id: s.ing, name: s.name, valuesOnOptions: true });
  const lines = [
    "// Quelle: chidoba-Nährwertrechner (chidoba.com/nutrition, Werte je Portion und Produktart; alle Felder im Browser an-/abgewählt: data/chidoba-rechner.json)",
    "// · Menü, Preise und Bestellfenster: Wolt " + raw.wolt.venue + " (Kaiserstraße), Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  // Zutaten-ids (Ausschluss/Pflicht über alle Produktarten hinweg); die Werte stehen je Produktart an den Optionen",
    "  ingredients: [",
  ];
  for (const x of ings.values()) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "  // Kategorie-Chips (User 27.09.2026): main = Produkt mit Bestellfenster (höchstens eins je Bestellung), snack = Snacks & Sides", "  cats: [");
  for (const c of CATS) lines.push("    " + lit(c) + ",");
  lines.push("  ],");
  for (const [tp, m] of menus) {
    lines.push("  " + tp + ": {", "    item: " + JSON.stringify(m.item) + ", type: " + JSON.stringify(m.type) + ", cat: " + JSON.stringify(m.cat) + ", basePrice: 0, require: " + lit(m.require) + ", proteinExtras: true, removals: " + lit(m.removals) + ",", "    steps: [");
    for (const s of m.steps) lines.push("      " + lit(s) + ",");
    lines.push("    ],", "    fixed: [");
    for (const f of m.fixed) lines.push("      " + lit(f) + ",");
    lines.push("    ],", "    groups: [");
    for (const g of m.groups) {
      lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + (g.own ? ",own:true" : "") + ",options:[");
      for (const o of g.options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("  // Snacks & Sides ohne Umbau (Wolt-Artikel, Werte laut Rechner)", "  snacks: [");
  for (const s of snacks) lines.push("    " + lit(s) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node chidoba-update.js aus data/chidoba-raw.json", lines), menus, snacks };
}

module.exports = { buildMenu, buildSnacks, blockLines, TYPES, CATS };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, menus, snacks } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  for (const [tp, m] of menus) console.log(tp + ": fest " + m.fixed.map(f => f.name + (f.sauce ? "*" : "")).join(", ") + " · " + m.groups.map(g => g.name + " " + g.options.length).join(", ") + (m.removals.length ? " · immer " + m.removals.join(", ") : ""));
  console.log("Snacks & Sides: " + snacks.map(s => s.name + " (" + s.cat + ", " + Math.round(s.kcal) + " kcal, " + s.price + " €)").join(" · "));
}
