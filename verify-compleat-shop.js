// Abgleich: die im Shop EINZELN angeklickte Nährwert-Anzeige (data/compleat-shop-anzeige.json, compleat-shop-capture.js) gegen die
// Shop-API (data/compleat-raw.json → shopItems: jede Karte des Bundles „Selbst zusammenstellen“ mit Werten je 100 g und Anzeige-Menge).
// Die Anzeige rechnet je 100 g × Anzeige-Menge (customizations[0].variations[0].value) / 100 und rundet wie Number.toFixed
// (kcal 0, Salz 2, sonst 1 Nachkommastelle; „--“ = nicht angegeben = 0). Ausverkaufte Karten lassen sich nicht wählen → nicht prüfbar;
// war eine heute ausverkaufte Karte bei einer früheren Ablesung wählbar, bleibt diese Ablesung als lastRead erhalten und wird weiter
// gegen die API geprüft (11.10.2026: die drei Kürbis-Karten). Eine Karte, die der Shop anbietet, die aber noch nie abgelesen wurde,
// ist ein Problem (→ im Shop anklicken).
// Aufruf: node verify-compleat-shop.js (nach node compleat-crawl.js; der Crawl nutzt compare() selbst und bricht bei Abweichungen ab)
//         node verify-compleat-shop.js --save <Datei mit dem kompakten JSON aus dem Browser> <sha256 aus dem Browser>
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const U = require("./update-lib.js");

const CTL = path.join(__dirname, "data", "compleat-shop-anzeige.json");
const SOURCE = "Compleat-Onlineshop, Bundle „Selbst zusammenstellen“ (Store Frankfurt Nordend): jede Zutat-Karte EINZELN ausgewählt (Menge 1) und die Anzeige „Nutrition facts per serving“ (Reiter „Nährwerte“) abgelesen, danach wieder abgewählt (compleat-shop-capture.js, im Browser; Prüfsumme sha256 des kompakten JSON im Browser und lokal verglichen). Werte als angezeigt (Text, „--“ = nicht angegeben). soldOut = Overlay „Ausverkauft“, Häkchen gesperrt → keine Werte; lastRead = die letzte Ablesung dieser Karte aus einem früheren Durchgang (mit Datum), als sie noch wählbar war. Kontrollquelle für node verify-compleat-shop.js; übernommen mit node verify-compleat-shop.js --save. Nicht von Hand ändern.";

const DEC = { kcal: 0, fat: 1, sat: 1, carbs: 1, sugars: 1, protein: 1, fibre: 1, salt: 2 };

function compare(shopItems, ctl) {
  const problems = [], soldOutNotChecked = [], notInShop = [], earlier = [];
  const byName = new Map((ctl.items || []).map(x => [x.name, x]));
  let checked = 0, values = 0;
  for (const it of shopItems) {
    const c = byName.get(it.name);
    if (!c) {
      if (it.soldOut) soldOutNotChecked.push(it.name);
      else problems.push("„" + it.name + "“ fehlt in der Shop-Anzeige → im Shop einzeln anklicken (node compleat-shop-capture.js)");
      continue;
    }
    // heute abgelesen — oder (heute ausverkauft) die letzte Ablesung aus einem früheren Durchgang
    const rd = c.shown ? c : (c.lastRead && c.lastRead.shown ? c.lastRead : null);
    if (!rd) {
      if (it.soldOut) soldOutNotChecked.push(it.name);
      else problems.push("„" + it.name + "“ ist im Shop wählbar, wurde aber noch nie abgelesen → im Shop einzeln anklicken (node compleat-shop-capture.js)");
      continue;
    }
    if (rd !== c) earlier.push({ name: it.name, readAt: String(rd.readAt || "").slice(0, 10) });
    checked++;
    for (const k of U.KEYS) {
      const shown = rd.shown[k];
      if (shown == null) { problems.push(it.name + " · " + k + ": nicht abgelesen"); continue; }
      const want = Number((it.per100[k] * it.displayAmount / 100).toFixed(DEC[k]));
      values++;
      if (Math.abs(U.parseNum(shown) - want) > 1e-9) problems.push(it.name + " · " + k + ": Shop zeigt " + shown + ", die API ergibt " + want);
    }
  }
  for (const c of ctl.items || []) if (!shopItems.some(x => x.name === c.name)) notInShop.push(c.name);
  return { readAt: String(ctl.readAt || "").slice(0, 10), checked, values, earlier, soldOutNotChecked, notInShop, problems };
}

// Neue Ablesung übernehmen: kompaktes JSON aus dem Browser (window.__compleatShopJSON().json, unverändert) + dessen sha256.
// Karten, die heute ausverkauft sind, behalten ihre letzte Ablesung (lastRead) aus der bisherigen Datei.
function merge(fresh, old) {
  const prev = new Map(((old && old.items) || []).map(x => [x.uuid, x]));
  const items = fresh.items.map(x => {
    if (x.shown) return x;
    const p = prev.get(x.uuid);
    const last = p && (p.shown ? { readAt: old.readAt, qty: p.qty, shown: p.shown } : p.lastRead);
    return last ? Object.assign({}, x, { lastRead: last }) : x;
  });
  return { _source: SOURCE, readAt: fresh.readAt, page: fresh.page, items };
}
function save(file, sha) {
  const json = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/\r?\n$/, "");
  const own = crypto.createHash("sha256").update(json, "utf8").digest("hex");
  if (!sha || own !== String(sha).toLowerCase()) throw new Error("sha256 passt nicht: lokal " + own + ", Browser " + sha + " → JSON noch einmal unverändert übertragen");
  const out = merge(JSON.parse(json), fs.existsSync(CTL) ? U.readJSON(CTL) : null);
  fs.writeFileSync(CTL, JSON.stringify(out, null, 1) + "\n");
  const kept = out.items.filter(x => x.lastRead), never = out.items.filter(x => !x.shown && !x.lastRead);
  console.log("Prüfsumme ✓ · " + path.relative(__dirname, CTL) + ": " + out.items.length + " Karten vom " + out.readAt.slice(0, 10) + ", " + out.items.filter(x => x.shown).length + " abgelesen" +
    (kept.length ? " · ausverkauft, letzte Ablesung behalten: " + kept.map(x => x.name + " (" + String(x.lastRead.readAt).slice(0, 10) + ")").join(", ") : "") +
    (never.length ? " · ausverkauft, noch nie abgelesen: " + never.map(x => x.name).join(", ") : ""));
}

module.exports = { compare, merge, DEC };

if (require.main === module) {
  if (process.argv[2] === "--save") save(process.argv[3], process.argv[4]);
  const raw = U.readJSON(path.join(__dirname, "data", "compleat-raw.json"));
  const ctl = U.readJSON(CTL);
  const r = compare(raw.shopItems || [], ctl);
  console.log("Shop-Anzeige vom " + r.readAt + ": " + r.checked + " Karten, " + r.values + " Werte abgeglichen" +
    (r.earlier.length ? " · davon aus einer früheren Ablesung (heute ausverkauft): " + r.earlier.map(x => x.name + " (" + x.readAt + ")").join(", ") : "") +
    (r.soldOutNotChecked.length ? " · ausverkauft (nicht prüfbar): " + r.soldOutNotChecked.join(", ") : "") +
    (r.notInShop.length ? " · nicht mehr im Shop: " + r.notInShop.join(", ") : ""));
  if (r.problems.length) { console.log("\nABWEICHUNGEN (" + r.problems.length + "):\n  " + r.problems.join("\n  ")); process.exit(1); }
  console.log("Alle abgelesenen Werte = Shop-API × Anzeige-Menge ✓");
}
