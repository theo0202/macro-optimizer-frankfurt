// Gemeinsame Helfer für alle <key>-update.js-Skripte (Node, keine Dependencies).
// Setzt die Datenqualitäts-Regeln aus CLAUDE.md um: LMIV-Zahlen parsen, Plausibilität prüfen (NIE still korrigieren),
// den Block zwischen // __<KEY>_DATA_START__ und // __<KEY>_DATA_END__ in index.html ersetzen (CRLF-sicher).
"use strict";
const fs = require("fs");

const KEYS = ["kcal", "fat", "sat", "carbs", "sugars", "fibre", "protein", "salt"];

function round(v, d) { const f = Math.pow(10, d == null ? 2 : d); return Math.round(v * f) / f; }

// JSON lesen (BOM-tolerant, z.B. für von PowerShell geschriebene Dateien)
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

// Deutsche Nährwert-Angabe (LMIV) → Zahl:
//   "12,5" → 12.5 · "1.234" → 1234 · "1.234,5" → 1234.5 · "<0,5" → 0.5 · "-" / "–" → 0 · Zahlen bleiben Zahlen
//   Einheiten am Ende (g, mg, kcal, kJ) werden ignoriert. Leeres/Unlesbares wirft einen Fehler (nie still 0).
//   Achtung: "1.500" gilt als Tausenderpunkt (1500). Englische Dezimalpunkte sind nur mit 1–2 Nachkommastellen eindeutig.
function parseNum(v) {
  if (typeof v === "number") { if (!isFinite(v) || v < 0) throw new Error("Ungültiger Nährwert: " + v); return v; }
  if (v == null) throw new Error("Nährwert fehlt");
  let s = String(v).replace(/\u00a0/g, " ").trim();
  s = s.replace(/^[<≤]\s*/, "").replace(/\s*(kcal|kj|mg|g)$/i, "").trim();
  if (/^[-–—]+$/.test(s)) return 0; // "-", "--", "–" = nicht enthalten
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // Tausenderpunkt (+ Dezimalkomma)
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");                                      // Dezimalkomma
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Unlesbarer Nährwert: " + JSON.stringify(v));
  return parseFloat(s);
}

// Nur Natrium angegeben → Salz = Natrium × 2,5 (beides in g; mg vorher durch 1000 teilen)
function saltFromSodium(sodiumG) { return round(parseNum(sodiumG) * 2.5, 2); }

// per-100g-Werte auf die Portion umrechnen. Ohne Portionsgewicht → Fehler (Item dann weglassen und dem User melden)
function scalePer100(p100, grams) {
  if (!(grams > 0)) throw new Error("Portionsgewicht fehlt");
  const o = {};
  for (const k of KEYS) o[k] = round(parseNum(p100[k]) * grams / 100, 1);
  return o;
}

// ASCII-id aus dem Namen (ä→ae, ö→oe, ü→ue, ß→ss, Akzente weg)
function slugId(name) {
  return String(name).normalize("NFC").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

// Plausibilität je Item → Liste von Auffälligkeiten (leer = ok):
// Energie ± max(15 kcal, 10 %) gegen 4·C + 4·P + 9·F (auch mit +2 kcal/g Ballaststoffe akzeptiert), sat ≤ fat, sugars ≤ carbs
function checkItem(x) {
  const out = [];
  const atw = 4 * x.carbs + 4 * x.protein + 9 * x.fat;
  const tol = Math.max(15, 0.1 * x.kcal);
  if (Math.abs(x.kcal - atw) > tol && Math.abs(x.kcal - (atw + 2 * x.fibre)) > tol)
    out.push("kcal " + x.kcal + " ≠ 4·C+4·P+9·F = " + Math.round(atw));
  if (x.sat > x.fat + 1e-9) out.push("sat " + x.sat + " > fat " + x.fat);
  if (x.sugars > x.carbs + 1e-9) out.push("sugars " + x.sugars + " > carbs " + x.carbs);
  return out;
}

// Prüft alle Items und druckt Auffälligkeiten. Dokumentiert = Name steht in _meta.anomalies (String oder {name, …}).
// Rückgabe: die NICHT dokumentierten → in _meta.anomalies eintragen und dem User nennen (nicht still korrigieren).
function reportAnomalies(items, meta) {
  const docs = ((meta && meta.anomalies) || []).map(a => (typeof a === "string" ? a : String(a.name || "")).toLowerCase());
  const open = [];
  for (const x of items) {
    const issues = checkItem(x);
    if (!issues.length) continue;
    const nm = x.name.toLowerCase();
    const known = docs.some(d => d === nm || d.includes(nm));
    console.log((known ? "  (dokumentiert) " : "  ⚠ NICHT dokumentiert: ") + x.name + " — " + issues.join("; "));
    if (!known) open.push({ name: x.name, issues });
  }
  return open;
}

// Rohdaten-Items (à la carte) → Block-Items: Zahlen parsen, Kategorie prüfen, eindeutige ids, boolesche Flags übernehmen
function buildAcItems(rawItems, cats, flagKeys) {
  const catIds = new Set(cats.map(c => c.id)), used = new Set();
  return rawItems.map(it => {
    const name = String(it.name || "").trim();
    if (!name) throw new Error("Item ohne Namen");
    if (!catIds.has(it.cat)) throw new Error("Unbekannte Kategorie bei " + name + ": " + it.cat);
    let id = it.id || slugId(name);
    while (used.has(id)) id += "_2";
    used.add(id);
    const o = { id, name, cat: it.cat };
    for (const k of KEYS) {
      try { o[k] = parseNum(it[k]); } catch (e) { throw new Error(name + " · " + k + ": " + e.message); }
    }
    for (const f of (flagKeys || [])) if (it[f] === true) o[f] = true;
    return o;
  });
}

// JS-Zeilen eines à-la-carte-Datenblocks: const NAME = { cats:[…], items:[…] };
function acDataLines(constName, cats, items, flagKeys) {
  const q = JSON.stringify;
  const lines = ["const " + constName + " = {", "  cats: ["];
  for (const c of cats) lines.push("    { id:" + q(c.id) + ",name:" + q(c.name) + ",on:" + (c.on !== false) + (c.drink ? ",drink:true" : "") + " },");
  lines.push("  ],", "  items: [");
  for (const x of items) {
    const mac = KEYS.map(k => k + ":" + x[k]).join(",");
    const flags = (flagKeys || []).filter(f => x[f]).map(f => "," + f + ":true").join("");
    lines.push("    { id:" + q(x.id) + ",name:" + q(x.name) + ",cat:" + q(x.cat) + "," + mac + flags + " },");
  }
  lines.push("  ],", "};");
  return lines;
}

// Marker-Zeilen um den Block legen
function wrapBlock(KEY, generator, bodyLines) {
  return ["// __" + KEY + "_DATA_START__ (generiert via: " + generator + " — nicht von Hand editieren)", ...bodyLines, "// __" + KEY + "_DATA_END__"];
}

// Ersetzt den Block (inkl. Marker) in einem HTML-String, übernimmt das Zeilenende der Datei (CRLF/LF). null = Marker fehlen.
function replaceBlock(html, KEY, lines) {
  const re = new RegExp("// __" + KEY + "_DATA_START__[\\s\\S]*?// __" + KEY + "_DATA_END__");
  if (!re.test(html)) return null;
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  return html.replace(re, () => lines.join(eol)); // Funktion statt String: "$" in Namen bleibt wörtlich
}

function writeBlock(file, KEY, lines) {
  const html = fs.readFileSync(file, "utf8");
  const out = replaceBlock(html, KEY, lines);
  if (out == null) {
    console.error(KEY + "-Marker in " + file + " nicht gefunden — erst // __" + KEY + "_DATA_START__ und // __" + KEY + "_DATA_END__ einsetzen");
    process.exit(1);
  }
  fs.writeFileSync(file, out, "utf8");
}

module.exports = { KEYS, round, readJSON, parseNum, saltFromSodium, scalePer100, slugId, checkItem, reportAnomalies, buildAcItems, acDataLines, wrapBlock, replaceBlock, writeBlock };
