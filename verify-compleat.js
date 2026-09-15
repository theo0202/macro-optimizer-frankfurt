// Abgleich: Word-Copy-Paste des Users (data/compleat-word.txt = Anzeige des Compleat-Onlineshops) gegen data/compleat-raw.json.
// Rechnet die Shop-Anzeige nach (pro 100 × Anzeige-Menge / 100, gerundet wie im Shop) und meldet jede Abweichung.
// Aufruf: node verify-compleat.js  (nach node compleat-crawl.js)
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const raw = U.readJSON(path.join(__dirname, "data", "compleat-raw.json"));
const lines = fs.readFileSync(path.join(__dirname, "data", "compleat-word.txt"), "utf8").split(/\r?\n/)
  .map(l => l.replace(/\s*Stelle dir eine Bowl aus all deinen Lieblingszutaten zusammen\.\s*$/, "").trimEnd());
const LABELS = [["kcal", /^\*\s*Energie \(kcal\)\s*(.*)$/], ["fat", /^\*\s*Fett\s*(.*)$/], ["carbs", /^\*\s*Kohlenhydrate\s*(.*)$/], ["sat", /^\*\s*davon gesättigt\s*(.*)$/],
  ["sugars", /^\*\s*davon Zucker\s*(.*)$/], ["protein", /^\*\s*Eiweiß\s*(.*)$/], ["fibre", /^\*\s*Ballaststoffe\s*(.*)$/], ["salt", /^\*\s*Salz\s*(.*)$/]];
const DEC = { kcal: 0, fat: 1, sat: 1, carbs: 1, sugars: 1, protein: 1, fibre: 1, salt: 2 }; // Nachkommastellen der Shop-Anzeige

const word = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const nm = l.match(/^(?:\*\s*)?(.*?\((\d+(?:[.,]\d+)?)\s*(g|ml)\).*)$/);
  if (!nm || /^Ausserdem/.test(l) || /^\*\s*Energie/.test(l)) continue;
  let j = i + 1;
  while (j < lines.length && !/^\*\s*Energie \(kcal\)/.test(lines[j])) j++;
  const vals = {};
  for (let k = j; k < Math.min(lines.length, j + 12); k++) for (const [key, re] of LABELS) { const mm = lines[k].match(re); if (mm && vals[key] == null) vals[key] = mm[1].trim(); }
  word.push({ name: nm[1].trim().replace(/\s+/g, " "), vals });
}

const byShopName = Object.fromEntries(raw.ingredients.map(x => [x.shopName, x]));
let compared = 0, fields = 0;
const mismatches = [], notFound = [];
for (const w of word) {
  const ing = byShopName[w.name];
  if (!ing) { notFound.push(w.name); continue; }
  compared++;
  for (const k of U.KEYS) {
    if (w.vals[k] == null) { mismatches.push(w.name + " · " + k + ": fehlt im Word-Text"); continue; }
    const shown = U.parseNum(w.vals[k]);
    // Der Shop rundet wie Number.toFixed inkl. Gleitkomma-Effekt (0.15 → "0.1", 0.075 → "0.07", 10.85 → "10.8")
    const expected = Number((ing.per100[k] * ing.vmos.displayAmount / 100).toFixed(DEC[k]));
    fields++;
    if (Math.abs(shown - expected) > 1e-9) mismatches.push(w.name + " · " + k + ": Word " + w.vals[k] + " ≠ Shop-Anzeige " + expected);
  }
}

console.log("Word-Produkte: " + word.length + " · abgeglichen: " + compared + " (" + fields + " Werte)");
if (notFound.length) console.log("Nicht im Shop-Datensatz: " + notFound.join(", "));
const bugs = raw._meta.displayBugs || [];
if (bugs.length) console.log("Hinweis: Die Shop-Anzeige (und damit das Word-Dokument) rechnet bei " + bugs.map(b => b.shopName + " mit " + b.shopRechnetMit + " " + b.unit).join(", ") + " — die App rechnet mit der Portion laut Name.");
if (mismatches.length) { console.log("\nABWEICHUNGEN (" + mismatches.length + "):\n  " + mismatches.join("\n  ")); process.exit(1); }
console.log("Alle Word-Werte stimmen mit der nachgerechneten Shop-Anzeige überein ✓");
