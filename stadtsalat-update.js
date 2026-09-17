// Generiert den STADTSALAT-Block in index.html aus data/stadtsalat-raw.json: node stadtsalat-update.js
// Bowl-Menü für die Bowl-Engine (bowlCombos): Pseudo-Gruppe „gericht“ (je Gericht × Wolt-Protein eine Option, Rolle protein, Werte = offizielle Werte
// der Stadtsalat-Variante ohne Dressing, Preis = Wolt-Gericht + Protein-Option; ing = Gericht, proteinIng = Protein als Extra-Zutat, contains = enthaltene
// Wolt-Extra-Zutaten mit Portionen, ingredients = Zutatenliste der Variante laut Stadtsalat) · „Dressing (Inklusive)“ (Rolle dip; je Dressing 1 Portion inklusive und die Variante „+ Dressing (Extra)“ mit
// 2 Portionen, +2,00 €) · „Dressing (Extra)“ (reine Bestellschritt-Gruppe) · „Extra Zutaten“ (Rolle extra, Werte = Add-on-Portion laut Shop).
// SWEET POTATO SNACK hat bei Wolt keine Optionen → eigenes Menü „snack“. Dressings mit Minze (NEVER im Crawl) fehlen im Block.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "STADTSALAT";
const RAW = path.join(__dirname, "data", "stadtsalat-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const vals = (v, mult) => Object.fromEntries(U.KEYS.map(k => [k, U.round(v[k] * (mult || 1), 2)]));

function buildData(raw) {
  const ingredients = [], seenIng = new Map();
  const addIng = (id, name, kind) => {
    if (seenIng.has(id) && seenIng.get(id) !== kind + "|" + name) throw new Error("id doppelt: " + id + " (" + seenIng.get(id) + " / " + kind + "|" + name + ")");
    if (!seenIng.has(id)) { seenIng.set(id, kind + "|" + name); ingredients.push({ id, name, kind, valuesOnOptions: true }); }
    return id;
  };
  const extraId = new Map(raw.extras.map(e => [e.wolt, U.slugId(e.wolt)]));
  const dressingId = new Map(raw.dressings.map(d => [d.wolt, U.slugId(d.wolt)]));
  const groupNames = {};
  const dishes = [], dishOpts = { bowl: [], snack: [] };
  for (const d of raw.wolt.dishes) {
    const id = addIng(U.slugId(d.name), d.name, "dish");
    const type = d.bowl ? "bowl" : "snack";
    const dish = { id, name: d.name, cat: d.cat, type, price: d.price };
    if (d.proteinGroup) { dish.proteinGroup = d.proteinGroup.name; dish.defaultProtein = extraId.get(d.proteinGroup.default); }
    if (d.bowl) {
      dish.dressing = dressingId.get(d.dressingGroup.default);
      dish.dressingName = d.dressingGroup.default;
      Object.assign(groupNames, { dressing: d.dressingGroup.name, dressingExtra: d.dressingExtraGroup.name, extras: d.extrasGroup.name }, d.proteinGroup ? { protein: d.proteinGroup.name } : {});
    }
    if (d.variants.some(v => v.coriander)) dish.coriander = true;
    dishes.push(dish);
    for (const v of d.variants) {
      if (v.shellfish) continue; // Schalentier (User 13.09.2026) — der Crawl meldet keins
      const contains = {};
      for (const [name, n] of Object.entries(v.contains)) {
        if (!extraId.has(name)) throw new Error(d.name + ": enthaltene Zutat „" + name + "“ ist keine Extra-Zutat");
        contains[extraId.get(name)] = n;
      }
      const o = {
        id: v.protein ? id + "__" + extraId.get(v.protein) : id, name: d.name + (v.protein ? " · " + v.protein : ""), short: d.name + (v.protein ? " (" + v.protein + ")" : ""),
        group: "gericht", role: "protein", ing: id,
      };
      if (v.protein) {
        if (!extraId.has(v.protein)) throw new Error(d.name + ": Protein „" + v.protein + "“ ist keine Extra-Zutat");
        Object.assign(o, { proteinIng: extraId.get(v.protein), proteinName: v.protein, proteinQty: v.proteinQty, optionPrice: v.optionPrice });
      }
      Object.assign(o, { contains, ingredients: raw.products[v.product].ingredients.join(" · "), weight: v.weight, maxQty: 1, price: v.price }, vals(v.values));
      if (v.coriander) o.coriander = true;
      dishOpts[type].push(o);
    }
  }
  const woltGroup = type => ({ id: "gericht", name: "Dish", min: 1, max: 1, options: dishOpts[type] });
  // Dressings: 1 Portion (inklusive, 0 €) und 2 Portionen (+ „Dressing (Extra)“); Minze nie
  const dressingOpts = [];
  for (const d of raw.dressings) {
    if (d.never) continue;
    const id = addIng(dressingId.get(d.wolt), d.wolt, "dressing");
    const base = { group: "dressing", role: "dip", ing: id, maxQty: 1 };
    dressingOpts.push(Object.assign({ id: "d_" + id, name: d.wolt, short: d.wolt }, base, { weight: d.weight, price: 0 }, vals(d.values)));
    dressingOpts.push(Object.assign({ id: "d_" + id + "_2", name: d.wolt + " + " + groupNames.dressingExtra, short: "2× " + d.wolt }, base,
      { variant: true, orderName: d.wolt, order: [{ group: "dressing_extra", name: "1× " + d.wolt }], weight: U.round(d.weight * 2, 2), price: d.extraPrice }, vals(d.values, 2)));
  }
  const extraOpts = raw.extras.map(e => {
    const id = addIng(extraId.get(e.wolt), e.wolt, "extra");
    return Object.assign({ id: "x_" + id, name: e.wolt, short: e.wolt, group: "extras", role: "extra", ing: id, weight: e.weight, maxQty: e.maxQty, price: e.price }, vals(e.values));
  });
  const page = raw.wolt.page;
  const bowl = {
    type: "bowl", item: "Stadtsalat", page, basePrice: 0, require: { base: false, protein: true }, proteinExtras: true,
    groups: [
      woltGroup("bowl"),
      { id: "dressing", name: groupNames.dressing, min: 1, max: 1, none: "not counted — don't use it", options: dressingOpts },
      { id: "dressing_extra", name: groupNames.dressingExtra, min: 0, max: 10, options: [] },
      { id: "extras", name: groupNames.extras, min: 0, max: 10, options: extraOpts },
    ],
  };
  const snack = { type: "snack", item: "Stadtsalat", page, basePrice: 0, require: { base: false, protein: true }, proteinExtras: true, groups: [woltGroup("snack")] };
  // Varianten-Protein muss als Extra-Zutat existieren; enthaltene Zutaten ebenso
  const ingIds = new Set(ingredients.map(x => x.id));
  for (const o of [...dishOpts.bowl, ...dishOpts.snack]) for (const c of [o.proteinIng, ...Object.keys(o.contains)].filter(Boolean)) if (!ingIds.has(c)) throw new Error(o.id + ": unbekannte Zutat " + c);
  return { ingredients, dishes, groupNames, bowl, snack };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: Stadtsalat-Shop-API (offizielle Werte je Gericht-Variante, Extra-Zutat und Dressing; im Konfigurator auf stadtsalat.de geprüft) + Wolt-Menü Stadtsalat Frankfurt · Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  ingredients: [",
  ];
  for (const x of data.ingredients) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "  dishes: [");
  for (const x of data.dishes) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "  groupNames: " + lit(data.groupNames) + ",");
  for (const key of ["bowl", "snack"]) {
    const { groups, ...head } = data[key];
    lines.push("  " + key + ": { " + lit(head).slice(1, -1) + ",", "    groups: [");
    for (const g of groups) {
      const { options, ...gh } = g;
      lines.push("      { " + lit(gh).slice(1, -1) + ",options:[");
      for (const o of options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("};");
  return { lines: U.wrapBlock(KEY, "node stadtsalat-update.js aus data/stadtsalat-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  const g = data.bowl.groups;
  console.log(data.dishes.length + " Gerichte (" + data.bowl.groups[0].options.length + " Bowl-Varianten + " + data.snack.groups[0].options.length + " Snack), " +
    g.find(x => x.id === "extras").options.length + " Extras, " + g.find(x => x.id === "dressing").options.filter(o => !o.variant).length + " Dressings (ohne Minze) → index.html (" + KEY + "-Block)");
  console.log("Auffälligkeiten laut Rohdaten: " + raw._meta.anomalies.length + " · Nie: " + raw._meta.never.length + " · Koriander: " + raw._meta.coriander.join(", "));
}
