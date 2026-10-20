// Generiert den BURGERMEISTER-Block in index.html aus data/burgermeister-raw.json: node burgermeister-update.js
// À la carte (kind:"ac"): je bei Wolt bestellbarem Artikel mit Werten in der offiziellen Nährwerttabelle (Stand August 2026) die Werte
// je Produkt, Wolt-Name, Kategorie und Wolt-Preis; gesättigte Fettsäuren nennt die Tabelle nicht → 0.
// Wolt-Extras mit Werten (extra Fleisch Patty, Bacon, Käse …) = eigene Items mit `addon: true` (Kategorie „extras“); Burger und Fries tragen
// `addons: [{ group, max, opts: { <Item-id>: <Wolt-Name> } }]` — welche Extras ihre Wolt-Gruppe anbietet und wie viele (acAddonPlan in index.html).
// Der Cheese-Sauce-Becher trägt `sauce: true` → Schalter „No sauces“. Kategorien ohne Item fehlen.
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const KEY = "BURGERMEISTER";
const RAW = path.join(__dirname, "data", "burgermeister-raw.json");
const lit = o => JSON.stringify(o).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
const addonId = id => "bm_x_" + id;

function values(name, v, notDeclared) {
  const o = {};
  for (const k of U.KEYS) {
    if (notDeclared.has(k)) { o[k] = 0; continue; }
    if (typeof v[k] !== "number" || !(v[k] >= 0)) throw new Error(name + ": " + k + " fehlt");
    o[k] = v[k];
  }
  return o;
}

function buildData(raw) {
  const notDeclared = new Set(raw._meta.notDeclared || []);
  const used = new Set();
  const priced = (name, p) => { if (typeof p !== "number" || !(p >= 0)) throw new Error("Preis fehlt: " + name); return U.round(p, 2); };
  const addonItems = raw.addons.map(ad => ({ id: addonId(ad.id), name: ad.name, cat: "extras", ...values(ad.name, ad.values, notDeclared), price: priced(ad.name, ad.price), addon: true }));
  const known = new Set(raw.addons.map(ad => ad.id));
  const main = raw.wolt.items.filter(w => !w.noData && !w.shellfish).map(w => {
    let id = "bm_" + U.slugId(w.name);
    while (used.has(id)) id += "_2";
    used.add(id);
    const o = { id, name: w.name, cat: w.cat, ...values(w.name, w.values, notDeclared), price: priced(w.name, w.price) };
    if (w.sauce) o.sauce = true;
    if (w.addons) o.addons = w.addons.map(g => {
      const opts = {};
      for (const [k, n] of Object.entries(g.opts)) { if (!known.has(k)) throw new Error(w.name + ": unbekanntes Extra " + k); opts[addonId(k)] = n; }
      if (!(g.max >= 1)) throw new Error(w.name + ": Gruppe " + g.group + " ohne Höchstzahl");
      return { group: g.group, max: g.max, opts };
    });
    return o;
  });
  // Reihenfolge der Items = Reihenfolge der Kategorien (Extras direkt hinter den Burgern)
  const catOrder = raw.wolt.cats.map(c => c.id);
  const items = [...main, ...addonItems].sort((a, b) => catOrder.indexOf(a.cat) - catOrder.indexOf(b.cat));
  const cats = raw.wolt.cats.filter(c => items.some(x => x.cat === c.id)).map(c => ({ id: c.id, name: c.name, on: true }));
  return { cats, items };
}

function blockLines(raw) {
  const data = buildData(raw);
  const lines = [
    "// Quelle: Burgermeister-Nährwerttabelle (Stand " + raw._meta.table.stand + "; offizielle Werte je Produkt, ohne gesättigte Fettsäuren) · Menü, Namen, Preise, Extras: Wolt „" + raw.wolt.slug + "“, Stand " + raw._meta.fetchedAt.slice(0, 10),
    "const " + KEY + " = {",
    "  cats: [",
  ];
  for (const c of data.cats) lines.push("    " + lit(c) + ",");
  lines.push("  ],", "  items: [");
  for (const x of data.items) lines.push("    " + lit(x) + ",");
  lines.push("  ],", "};");
  return { lines: U.wrapBlock(KEY, "node burgermeister-update.js aus data/burgermeister-raw.json", lines), data };
}

module.exports = { buildData, blockLines };

if (require.main === module) {
  const raw = U.readJSON(RAW);
  const { lines, data } = blockLines(raw);
  U.writeBlock(path.join(__dirname, "index.html"), KEY, lines);
  console.log(data.items.length + " Items → index.html (" + KEY + "-Block): " + data.cats.map(c => c.name + " " + data.items.filter(x => x.cat === c.id).length).join(", "));
}
