// Generiert den COMPLEAT-Block in index.html aus data/compleat-raw.json: node compleat-update.js
// Build-Your-Own (kind:"byo"): kompletter Shop-Datensatz (Werte pro 100 g + Portion) plus je Plattform das Bowl-Menü
// (Wolt „Build your Bowl", Uber Eats „Selbst zusammenstellen") mit Grundpreis, Preisen und fertigen Portionswerten je Option
// (pro 100 × Plattform-Menge / 100).
//
// GESPERRTE Zutaten (raw.ingredients[].blocked, aktuell Bunter Bio Quinoa — User 15.09.2026) bleiben im Datensatz, werden
// aber aus ALLEN Plattform-Menüs weggelassen → nie im Rechner, nie in der Suche, nie als Ausschluss-Option.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "COMPLEAT";
const RAW = path.join(__dirname, "data", "compleat-raw.json");
const PLATFORMS = ["wolt", "ubereats"];
const GROUP_ORDER = ["base", "protein", "extra", "vitamine", "toppings", "dip"];
const ROLES = new Set(["base", "protein", "extra", "dip"]);

// Kurzname für Karten/Titel: Wolt „Rotkohl, geraspelt, 50 g" → „Rotkohl" · Uber Eats „Basmati Reis (250g)" → „Basmati Reis",
// „Hühnchen - Halbe Portion (50g)" → „½ Hühnchen", „Olivenöl (20ml), Salz & halbe Zitrone" → „Olivenöl, Salz & halbe Zitrone"
function shortName(n) {
  const s = String(n);
  const half = s.match(/^(.*) - Halbe Portion \(\d+(?:[.,]\d+)?\s*(?:g|ml)\)$/i);
  if (half) return "½ " + half[1].trim();
  const portion = /\s*\(\d+(?:[.,]\d+)?\s*(?:g|ml)\)/i;
  if (portion.test(s)) return s.replace(portion, "").replace(/\s+,/g, ",").trim();
  return s.split(",")[0].trim();
}
// JS-Literal ohne Anführungszeichen um einfache Keys (wie die übrigen Datenblöcke)
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const groupRank = id => { const i = GROUP_ORDER.indexOf(id); if (i < 0) throw new Error("Unbekannte Gruppen-id: " + id); return i; };

function buildMenu(raw, platform) {
  const menu = raw[platform];
  if (!menu) throw new Error("Plattform fehlt in raw.json: " + platform);
  const ingById = Object.fromEntries(raw.ingredients.map(x => [x.id, x]));
  const used = new Set(), skipped = [];
  const groups = [...menu.groups].sort((a, b) => groupRank(a.id) - groupRank(b.id)).map(g => ({
    id: g.id, name: g.name, min: g.min, max: g.max, none: g.noneOption || null,
    options: g.options.filter(o => {
      const ing = ingById[o.ingredient];
      if (!ing) throw new Error("Zutat fehlt: " + o.ingredient + " (" + o.name + ")");
      if (ing.blocked) { skipped.push(g.name + ": " + o.name); return false; } // gesperrt → nie im Rechner
      return true;
    }).map(o => {
      const ing = ingById[o.ingredient];
      const role = o.role || g.id;
      if (!ROLES.has(role)) throw new Error("Unbekannte Rolle " + role + " (" + o.name + ")");
      if (typeof o.price !== "number" || !(o.price >= 0)) throw new Error("Preis fehlt: " + o.name);
      let id = U.slugId(g.id + "_" + o.name);
      while (used.has(id)) id += "_2";
      used.add(id);
      const opt = { id, name: o.name, short: shortName(o.name), group: g.id, role, ing: o.ingredient, amount: o.amount, unit: o.unit, maxQty: o.maxQty, price: o.price };
      if (o.half) opt.half = true;
      for (const k of U.KEYS) opt[k] = U.round(ing.per100[k] * o.amount / 100, 2);
      if (ing.crunch) opt.crunch = true;
      if (ing.shellfish) opt.shellfish = true;
      return opt;
    }),
  }));
  if (typeof menu.itemPrice !== "number") throw new Error("Grundpreis fehlt: " + platform);
  // Vorauswahl der Plattform (Wolt wählt im Pflicht-Dip „Curvy Curry Dip“ vor → Menükarte 4 € statt 2 € Grundpreis).
  // Der Rechner nutzt sie nur für den Hinweistext; gerechnet wird mit Grundpreis + tatsächlich gewählten Optionen.
  const preselected = (menu.preselected || []).map(x => {
    if (!groups.some(g => g.id === x.group)) throw new Error("Vorauswahl zeigt auf unbekannte Gruppe: " + x.group + " (" + platform + ")");
    if (typeof x.price !== "number" || !(x.price >= 0)) throw new Error("Vorauswahl ohne Preis: " + x.name + " (" + platform + ")");
    return { group: x.group, name: x.name, price: x.price };
  });
  return { item: menu.item, page: menu.page, basePrice: menu.itemPrice, preselected, groups, skipped };
}

function blockLines(raw) {
  const menus = PLATFORMS.filter(pf => raw[pf]).map(pf => [pf, buildMenu(raw, pf)]);
  const blocked = raw.ingredients.filter(x => x.blocked);
  const lines = [
    "// Quelle: Compleat-Onlineshop (compleat.vmos.io, Frankfurt Nordend), Stand " + raw._meta.fetchedAt.slice(0, 10) + " · Shop-Werte pro 100 g × Menge · Menüs + Preise: " +
      menus.map(([pf, m]) => (pf === "wolt" ? "Wolt" : "Uber Eats") + " „" + m.item + "“" + (raw[pf].capturedAt ? " (erfasst " + raw[pf].capturedAt.slice(0, 10) + ")" : "")).join(", "),
    ...blocked.map(x => "// GESPERRT (nie im Rechner, auf keiner Plattform): " + x.shopName + " — " + x.blocked),
    "const " + KEY + " = {",
    "  // Kompletter Shop-Datensatz (auch Zutaten, die eine Plattform nicht anbietet)",
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
  lines.push("  ],");
  for (const [pf, m] of menus) {
    lines.push("  " + pf + ": {", "    item: " + JSON.stringify(m.item) + ", page: " + JSON.stringify(m.page) + ", basePrice: " + m.basePrice + ",");
    // Vorausgewählte Pflicht-Optionen der Plattform (nur für den Hinweistext „Menükarte zeigt …“)
    if (m.preselected.length) lines.push("    preselected: [" + m.preselected.map(lit).join(",") + "],");
    lines.push("    groups: [");
    for (const g of m.groups) {
      lines.push("      { id:" + JSON.stringify(g.id) + ",name:" + JSON.stringify(g.name) + ",min:" + g.min + ",max:" + g.max + ",none:" + JSON.stringify(g.none) + ",options:[");
      for (const o of g.options) lines.push("        " + lit(o) + ",");
      lines.push("      ] },");
    }
    lines.push("    ],", "  },");
  }
  lines.push("};");
  return { lines: U.wrapBlock(KEY, "node compleat-update.js aus data/compleat-raw.json", lines), menus };
}

module.exports = { buildMenu, blockLines, shortName };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, menus } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(raw.ingredients.length + " Zutaten → index.html (" + KEY + "-Block)");
  for (const [pf, m] of menus) {
    console.log("  " + pf + " „" + m.item + "“ (Grundpreis " + m.basePrice + " €): " + m.groups.map(g => g.name + " " + g.options.length).join(", "));
    if (m.skipped.length) console.log("    gesperrt, nicht im Menü des Rechners: " + m.skipped.join(", "));
  }
}
