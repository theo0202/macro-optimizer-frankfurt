// Abgleich mit den Fertig-Bowls des Compleat-Onlineshops: data/compleat-presets.json (Nährwert-Anzeige der Produktseiten + vorausgewählte
// Optionen, Stand 16.09.2026, siehe _meta) gegen unseren Datensatz data/compleat-raw.json. Aufruf: node verify-compleat-presets.js
//  1) Die Shop-Rechnung (_meta.shopRule) muss jede Anzeige exakt reproduzieren — sonst stimmt die Kontrolldatei nicht.
//  2) Unsere Werte je 100 g × Menge laut Name müssen die Anzeige im Rahmen der Shop-Rundung treffen. Weicht eine Bowl ab, muss die
//     Abweichung vollständig durch einen Shop-Effekt erklärt sein UND dieser Effekt in EXPECTED stehen (neue Effekte → prüfen, dokumentieren).
"use strict";
const path = require("path");
const U = require("./update-lib.js");

const DEC = { kcal: 0, fat: 1, sat: 1, carbs: 1, sugars: 1, fibre: 1, protein: 1, salt: 2 }; // Nachkommastellen der Shop-Anzeige
const GRAMS = ["fat", "sat", "carbs", "sugars", "fibre", "protein"];

// Bekannte Shop-Effekte (16.09.2026) — Anzeige-Fehler bzw. Datenfehler des Shops, unser Datensatz rechnet richtig:
const EXPECTED = new Set([
  "Menge|Power Pasta - High Protein|Protein-Pasta (200g)|250",                     // Anzeige rechnet 250 g statt 200 g (+95 kcal)
  "Bundle-Datensatz|Knackarsch - Low Carb",                                         // alter Nährwert-Datensatz am Bundle wird zusätzlich gezählt (+106 kcal)
  "Bundle-Datensatz|Mango Fire - Low Carb",                                         // dito (+201 kcal)
  "Werte je 100 g|Bunter Bio Quinoa - Halbe Portion (125g)|protein",                // halbe Portion 0,9 g statt 1,8 g Eiweiß je 100 g (Quinoa ist gesperrt)
  "fehlt|Joghurt Tzatziki Dip (100g)",                                              // nur in den Lachs-Nudeln, nicht in „Selbst zusammenstellen“
]);

// Shop-Rechnung: kcal je Option gerundet und addiert; übrige Werte Σ(Wert je 100 g × Menge) / 100 → toFixed
function shopTotal(parts) {
  const out = {};
  for (const k of U.KEYS) out[k] = k === "kcal"
    ? parts.reduce((s, p) => s + Math.round(p.per100.kcal * p.q / 100), 0)
    : Number((parts.reduce((s, p) => s + p.per100[k] * p.q, 0) / 100).toFixed(DEC[k]));
  return out;
}
const exactSum = parts => Object.fromEntries(U.KEYS.map(k => [k, parts.reduce((s, p) => s + p.per100[k] * p.q / 100, 0)]));
// Rundungs-Spielraum: kcal ±0,5 je gerundeter Option, Gramm ±0,05, Salz ±0,005 (+ Anzeige-Mengen wie 49,99 g statt 50 g)
const withinRounding = (v, shown, n) => Math.abs(v.kcal - shown.kcal) <= 0.5 * n + 0.1 && GRAMS.every(k => Math.abs(v[k] - shown[k]) <= 0.06) && Math.abs(v.salt - shown.salt) <= 0.006;
// „Doppelt Hühnchen (200g)“ → Hühnchen · „Basmati Reis - Halbe Portion (125g)“ → Basmati Reis · „Rotkohl geraspelt (50g)“ → Rotkohl geraspelt
function ingredientId(name) {
  const base = String(name).replace(/^Doppelt\s+/, "").replace(/\s+-\s+Halbe Portion(?=\s*\()/i, "").replace(/\s*\(\d+(?:[.,]\d+)?\s*(?:g|ml)\)/i, "").replace(/\s+,/g, ",").trim();
  return U.slugId(base);
}

function verifyPresets(raw, presets) {
  const byId = Object.fromEntries(raw.ingredients.map(x => [x.id, x]));
  const rows = [], failures = [], effects = new Set();
  for (const b of presets.bowls) {
    const shopParts = b.items.map(it => ({ per100: it.per100, q: it.shopAmount }));
    const rule = shopTotal(shopParts);
    const ruleBad = U.KEYS.filter(k => Math.abs(rule[k] - b.shown[k]) > 1e-9);
    if (ruleBad.length) failures.push(b.name + ": Shop-Rechnung ≠ Anzeige (" + ruleBad.map(k => k + " " + rule[k] + " vs. " + b.shown[k]).join(", ") + ") → Kontrolldatei prüfen");
    const ours = [], explained = [], why = [];
    for (const it of b.items) {
      if (it.bundleBase) { explained.push({ per100: it.per100, q: it.shopAmount }); why.push("Bundle-Datensatz|" + b.name); continue; }
      const ing = byId[ingredientId(it.name)];
      if (!ing) { ours.push({ per100: it.per100, q: it.amount }); explained.push({ per100: it.per100, q: it.amount }); why.push("fehlt|" + it.name); continue; }
      ours.push({ per100: ing.per100, q: it.amount });
      const diff = U.KEYS.filter(k => Math.abs(it.per100[k] - ing.per100[k]) > 1e-9);
      if (diff.length) why.push("Werte je 100 g|" + it.name + "|" + diff.join(","));
      if (Math.abs(it.shopAmount - it.amount) >= 1) why.push("Menge|" + b.name + "|" + it.name + "|" + it.shopAmount);
      explained.push({ per100: diff.length ? it.per100 : ing.per100, q: Math.abs(it.shopAmount - it.amount) >= 1 ? it.shopAmount : it.amount });
    }
    const v = exactSum(ours), e = exactSum(explained);
    const direct = !why.length && withinRounding(v, b.shown, ours.length);
    if (!direct) {
      if (!why.length) failures.push(b.name + ": weicht ab ohne erkennbaren Shop-Effekt (" + U.KEYS.map(k => k + " " + U.round(v[k], 2) + " vs. " + b.shown[k]).join(", ") + ")");
      else if (!withinRounding(e, b.shown, explained.length)) failures.push(b.name + ": Abweichung nicht vollständig erklärt durch " + why.join(" · "));
      for (const w of why) { effects.add(w); if (!EXPECTED.has(w)) failures.push(b.name + ": neuer Shop-Effekt „" + w + "“ → prüfen und in EXPECTED dokumentieren"); }
    }
    rows.push({ name: b.name, category: b.category, shown: b.shown, ours: v, direct, why });
  }
  for (const w of EXPECTED) if (!effects.has(w)) failures.push("Erwarteter Shop-Effekt nicht mehr gefunden: „" + w + "“ → EXPECTED aktualisieren");
  return { rows, failures };
}

module.exports = { verifyPresets, shopTotal, ingredientId, EXPECTED };

if (require.main === module) {
  const raw = U.readJSON(path.join(__dirname, "data", "compleat-raw.json"));
  const presets = U.readJSON(path.join(__dirname, "data", "compleat-presets.json"));
  const { rows, failures } = verifyPresets(raw, presets);
  const direct = rows.filter(r => r.direct);
  const maxDev = k => Math.max(...direct.map(r => Math.abs(r.ours[k] - r.shown[k])));
  console.log("Fertig-Bowls (Shop-Anzeige vom " + presets._meta.capturedAt + "): " + rows.length + " · Shop-Rechnung reproduziert jede Anzeige: " + (failures.some(f => /Shop-Rechnung/.test(f)) ? "NEIN" : "ja"));
  console.log("Unser Datensatz trifft die Anzeige im Rahmen der Rundung: " + direct.length + "/" + rows.length + " (max. Abweichung " + maxDev("kcal").toFixed(1) + " kcal, " + Math.max(...GRAMS.map(maxDev)).toFixed(2) + " g, Salz " + maxDev("salt").toFixed(3) + " g)");
  for (const r of rows.filter(x => !x.direct)) console.log("  " + r.name + ": Shop " + r.shown.kcal + " kcal / " + r.shown.protein + " g P · unser " + U.round(r.ours.kcal, 1) + " kcal / " + U.round(r.ours.protein, 2) + " g P ← " + r.why.join(" · "));
  if (failures.length) { console.log("\nPROBLEME (" + failures.length + "):\n  " + failures.join("\n  ")); process.exit(1); }
  console.log("Alle Abweichungen sind bekannte Shop-Effekte ✓");
}
