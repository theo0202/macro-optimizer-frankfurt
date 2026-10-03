// Abgleich: die im Shop EINZELN angeklickte Nährwert-Anzeige (data/compleat-shop-anzeige.json, compleat-shop-capture.js) gegen die
// Shop-API (data/compleat-raw.json → shopItems: jede Karte des Bundles „Selbst zusammenstellen“ mit Werten je 100 g und Anzeige-Menge).
// Die Anzeige rechnet je 100 g × Anzeige-Menge (customizations[0].variations[0].value) / 100 und rundet wie Number.toFixed
// (kcal 0, Salz 2, sonst 1 Nachkommastelle; „--“ = nicht angegeben = 0). Ausverkaufte Karten lassen sich nicht wählen → nicht prüfbar.
// Aufruf: node verify-compleat-shop.js (nach node compleat-crawl.js; der Crawl nutzt compare() selbst und bricht bei Abweichungen ab)
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const DEC = { kcal: 0, fat: 1, sat: 1, carbs: 1, sugars: 1, protein: 1, fibre: 1, salt: 2 };

function compare(shopItems, ctl) {
  const problems = [], soldOutNotChecked = [], notInShop = [];
  const byName = new Map((ctl.items || []).map(x => [x.name, x]));
  let checked = 0, values = 0;
  for (const it of shopItems) {
    const c = byName.get(it.name);
    if (!c) {
      if (it.soldOut) soldOutNotChecked.push(it.name);
      else problems.push("„" + it.name + "“ fehlt in der Shop-Anzeige → im Shop einzeln anklicken (node compleat-shop-capture.js)");
      continue;
    }
    if (c.soldOut || !c.shown) { soldOutNotChecked.push(it.name); continue; }
    checked++;
    for (const k of U.KEYS) {
      const shown = c.shown[k];
      if (shown == null) { problems.push(it.name + " · " + k + ": nicht abgelesen"); continue; }
      const want = Number((it.per100[k] * it.displayAmount / 100).toFixed(DEC[k]));
      values++;
      if (Math.abs(U.parseNum(shown) - want) > 1e-9) problems.push(it.name + " · " + k + ": Shop zeigt " + shown + ", die API ergibt " + want);
    }
  }
  for (const c of ctl.items || []) if (!shopItems.some(x => x.name === c.name)) notInShop.push(c.name);
  return { readAt: String(ctl.readAt || "").slice(0, 10), checked, values, soldOutNotChecked, notInShop, problems };
}

module.exports = { compare, DEC };

if (require.main === module) {
  const raw = U.readJSON(path.join(__dirname, "data", "compleat-raw.json"));
  const ctl = U.readJSON(path.join(__dirname, "data", "compleat-shop-anzeige.json"));
  const r = compare(raw.shopItems || [], ctl);
  console.log("Shop-Anzeige vom " + r.readAt + ": " + r.checked + " Karten, " + r.values + " Werte abgeglichen" +
    (r.soldOutNotChecked.length ? " · ausverkauft (nicht prüfbar): " + r.soldOutNotChecked.join(", ") : "") +
    (r.notInShop.length ? " · nicht mehr im Shop: " + r.notInShop.join(", ") : ""));
  if (r.problems.length) { console.log("\nABWEICHUNGEN (" + r.problems.length + "):\n  " + r.problems.join("\n  ")); process.exit(1); }
  console.log("Alle abgelesenen Werte = Shop-API × Anzeige-Menge ✓");
}
