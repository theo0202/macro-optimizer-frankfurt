// Dean & David Frankfurt (Wolt): „Mix Your Own Salad bar“ + „Mix Your Own Bowl bar“ → data/deandavid-raw.json (Quelle der Wahrheit, NICHT
// von Hand editieren — Kuratierung passiert in den Tabellen unten). Aufruf: node deandavid-crawl.js · danach node deandavid-update.js
// Quellen: offizielle Nährwerttabelle (data/deandavid-naehrwerte.txt) und Allergenliste (data/deandavid-allergene.json), beide aus den PDFs
// von deananddavid.com erzeugt mit deandavid-pdf.py; Menü, Preise und Auswahlregeln aus der Wolt-API (consumer-assortment).
//
// Rechenbasis: die offiziellen Werte PRO PORTION der Tabelle (Mix-Your-Own-Bausteine). Ballaststoffe stehen nicht in der Tabelle → 0.
// Portionsgewicht nur zur Info (kJ je Portion / kJ je 100 g).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const NUTRI = path.join(__dirname, "data", "deandavid-naehrwerte.txt");
const ALLERG = path.join(__dirname, "data", "deandavid-allergene.json");
const OUT = path.join(__dirname, "data", "deandavid-raw.json");
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
// Datenquelle des Rechners: Welle (Menü identisch mit Mainzer Landstraße und Tower 185 und mit der Liste des Users vom 16.09.2026);
// die übrigen Frankfurter Filialen werden nur verglichen
const PRIMARY = "deandavid-frankfurt-welle";
const COMPARE = ["deandavid-mainzer-landstrasse", "deandavid-tower-185", "deandavid-myzeil", "deandavid-bockenheim", "dean-david-frankfurt-bahnhofsplatz"];
const ITEMS = { salad: "Mix Your Own Salad bar", bowl: "Mix Your Own Bowl bar" };

// Mix-Your-Own-Bausteine der Nährwerttabelle: id → [Zeilenname wie im PDF-Text (inkl. Abschnittsname davor), Anzeigename, Abschnitt]
const PDF_ROWS = {
  blattsalatmix: ["Basis - Blattsalatmix", "Premium Blattsalatmix", "basis"],
  quinoa_vollkornreis: ["Bowl Basis - Quinoa Vollkornreis", "Quinoa-Vollkornreis", "bowlbasis"],
  jasmin_duftreis: ["Bowl-Basis - Jasmin-Duftreis", "Jasmin-Duftreis", "bowlbasis"],
  landbrot: ["Brot Brot 1 Scheibe", "Landbrot (1 Scheibe)", "brot"],
  caesar: ["Caesar", "Caesar Dressing", "dressing"],
  rucola: ["Rucola", "Rucola Dressing", "dressing"],
  tahini_lemon: ["Dressings Tahini Lemon", "Tahini Lemon", "dressing"],
  honey_mustard: ["Honey Mustard", "Honey Mustard", "dressing"],
  balsamico_ahorn: ["Balsamico-Ahorn", "Balsamico-Ahorn", "dressing"],
  soja_sesam_sauce: ["Soja Sesam Sauce", "Soja Sesam Sauce", "bowlsauce"],
  lemon_herbs_sauce: ["Lemon Herbs Sauce", "Lemon Herbs Sauce", "bowlsauce"],
  teriyaki_sauce: ["Teriyaki Sauce", "Teriyaki Sauce", "bowlsauce"],
  spicy_ginger_sauce: ["Spicy Ginger Sauce", "Spicy Ginger Sauce", "bowlsauce"],
  birne: ["Basic - Birne", "Birne", "basic"],
  croutons: ["Basic - Croûtons", "Croûtons", "basic"],
  crunchy_onions: ["Basic - Crunchy Onions", "Crunchy Onions", "basic"],
  edamame: ["Basic - Edamame", "Edamame", "basic"],
  erdnuesse: ["Basic - Erdnüsse", "Erdnüsse", "basic"],
  freilandei: ["Basic - Freilandei", "Freilandei", "basic"],
  fruehlingszwiebeln: ["Basic - Frühlingszwiebeln", "Frühlingszwiebeln", "basic"],
  granatapfelkerne: ["Basic - Granatapfelkerne", "Granatapfelkerne", "basic"],
  gurken: ["Basic - Gurken", "Gurken", "basic"],
  karotten: ["Basic - Karotten", "Karotten", "basic"],
  kirschtomaten: ["Basic - Kirschtomaten", "Kirschtomaten", "basic"],
  kuerbis: ["Basic - Kürbis", "Kürbis", "basic"],
  kuerbis_sonnenblumenkern_mix: ["Basic - Kürbis-Sonnenblumkern-Mix", "Kürbis-Sonnenblumenkern-Mix", "basic"],
  mango: ["Basic - Mango", "Mango", "basic"],
  miso_mayo: ["Basic - Miso Mayo", "Miso Mayo", "basic"],
  oliventapenade: ["Basic - Oliventapenade", "Oliventapenade", "basic"],
  paprika: ["Mix Your Own Basic - Paprika", "Paprika", "basic"],
  cranberries: ["Basic - Cranberries", "Cranberries", "basic"],
  rote_bete: ["Basic - Rote Bete", "Rote Bete", "basic"],
  rotkohl_mariniert: ["Basic - Rotkohl mariniert", "Rotkohl mariniert", "basic"],
  walnuesse: ["Basic - Walnüsse", "Walnüsse", "basic"],
  weintrauben: ["Basic - Weintrauben", "Weintrauben", "basic"],
  avocado: ["Extra - Avocado", "Avocado", "extra"],
  falafel: ["Extra - Falafel", "Falafel", "extra"],
  italian_hardcheese_flakes: ["Extra - Italian Hardcheese Flakes", "Italian Hardcheese Flakes", "extra"],
  grillgemuese: ["Extra - Grillgemüse", "Grillgemüse", "extra"],
  haehnchen_filetstreifen: ["Extra - Hähnchen-Filetstreifen", "Hähnchen-Filetstreifen", "extra"],
  hummus: ["Extra - Hummus", "Hummus", "extra"],
  halloumi: ["Extra - Halloumi", "Halloumi", "extra"],
  raeucherlachs: ["Extra - Räucherlachs", "Räucherlachs", "extra"],
  planted_chicken: ["Extra - planted.chicken", "planted.chicken", "extra"],
  roast_potatoes: ["Extra - Roast Potatoes", "Roast Potatoes", "extra"],
  rinderstreifen: ["Extra - Rinderstreifen", "Rinderstreifen", "extra"],
  schafskaese: ["Extra - Schafskäse", "Schafskäse", "extra"],
  suesskartoffel_chunks: ["Extra - Süßkartoffel Chunks", "Süßkartoffel Chunks", "extra"],
  ziegenkaese: ["Extra - Ziegenkäse", "Ziegenkäse", "extra"],
};
// Zeilen der Allergenliste (Namen weichen teils ab — dokumentiert in _meta.allergenNameDiffs)
const ALLERGEN_ROWS = {
  blattsalatmix: "Basis - Blattsalatmix", quinoa_vollkornreis: "Bowl Basis - Quinoa Vollkornreis", jasmin_duftreis: "Bowl Basis - Jasmin-Duftreis", landbrot: "Landbrot",
  caesar: "Caesar", rucola: "Rucola", tahini_lemon: "Tahini Lemon", honey_mustard: "Honey Mustard", balsamico_ahorn: "Balsamico-Ahorn",
  soja_sesam_sauce: "Soja Sesam Sauce", lemon_herbs_sauce: "Lemon Herbs Sauce", teriyaki_sauce: "Teriyaki Sauce", spicy_ginger_sauce: "Spicy Ginger Sauce",
  birne: "Basic - Birne", croutons: "Basic - Croûtons", crunchy_onions: "Basic - Crunchy Onions", edamame: "Basic - Edamame", erdnuesse: "Basic - Erdnüsse",
  freilandei: "Basic - Ei", fruehlingszwiebeln: "Basic - Frühlingszwiebeln", granatapfelkerne: "Basic - Granatapfelkerne", gurken: "Basic - Gurken",
  karotten: "Basic - Karotten", kirschtomaten: "Basic - Kirschtomaten", kuerbis: "Basic - Kürbis", kuerbis_sonnenblumenkern_mix: "Basic - Kürbis-Sonnenblumkern-Mix",
  mango: "Basic - Mango", miso_mayo: "Basic - Miso Mayo", oliventapenade: "Basic - Oliventapenade", paprika: "Basic - Paprika", cranberries: "Basic - Preiselbeeren",
  rote_bete: "Basic - Rote Bete", rotkohl_mariniert: "Basic - Rotkohl mariniert", walnuesse: "Basic - Walnüsse", weintrauben: "Basic - Weintrauben",
  avocado: "Extra - Avocado", falafel: "Extra - Green Falafel", italian_hardcheese_flakes: "Extra - Gran Moravia (ital. Hartkäse)", grillgemuese: "Extra - gegrilltes Gemüse",
  haehnchen_filetstreifen: "Extra - gegrilltes Hähnchen-Filet", hummus: "Extra - Hummus", halloumi: "Extra - Halloumi", raeucherlachs: "Extra - Premium Räucherlachs",
  planted_chicken: "Extra - planted.chicken classic", roast_potatoes: "Extra - Roast Potatoes", rinderstreifen: "Extra - gegrillte Rinderstreifen",
  schafskaese: "Extra - Schafskäse", suesskartoffel_chunks: "Extra - Süßkartoffel Scheiben", ziegenkaese: "Extra - französischer Ziegenkäse",
};
const NOT_ALLERGENS = new Set(["Knoblauch", "Zwiebel", "Alkohol", "Rind", "Schärfegrad", "Vegetarier", "Veganer", "Schwangere"]);

// Wolt-Gruppen (Name → Art); Reihenfolge = Wolt
const GROUPS = {
  "WELCHES DRESSING MÖCHTEST DU? (MYO SALAD)": { id: "dressing", kind: "dip" },
  "WÄHLE DEIN DRESSING (MYO BOWL)": { id: "dressing", kind: "dip" },
  "WÄHLE DEINE BOWL BASE": { id: "basis", kind: "base" },
  "BROT MIT DAZU?": { id: "brot", kind: "side" },
  "EXTRA BROT/DRESSING DAZU?": { id: "extra_brot_dressing", kind: "extraBreadDressing" },
  "WÄHLE DEINE EXTRAS": { id: "extras", kind: "extras" },
};
const NONE = new Set(["ohne Dressing/Sauce", "ohne Dressing", "ohne Brot"]);
// Wolt-Option → Baustein der Tabelle. Unbekannte Optionen brechen den Crawl ab (Tabelle ergänzen, nicht raten).
const WOLT_MAP = {
  "Balsamico Ahornsirup Dressing": "balsamico_ahorn", "Caesar Dressing": "caesar", "Rucola Dressing": "rucola", "Sweet Honey Mustard": "honey_mustard", "Tahini Lemon": "tahini_lemon",
  "Spicy Ginger Sauce": "spicy_ginger_sauce", "Teriyaki Sauce": "teriyaki_sauce", "Lemon Herbs Sauce": "lemon_herbs_sauce", "Soja Sesam Sauce": "soja_sesam_sauce",
  "Jasmin-Duftreis": "jasmin_duftreis", "Quinoa-Vollkornreis": "quinoa_vollkornreis", "Mit knusprigem Landbrot": "landbrot",
  "Kürbis": "kuerbis", "Avocado extra": "avocado", "Hummus extra": "hummus", "Schafskäse extra": "schafskaese", "Süßkartoffel extra": "suesskartoffel_chunks",
  "Chicken extra": "haehnchen_filetstreifen", "gegrilltes Gemüse extra": "grillgemuese", "Ziegenkäse extra": "ziegenkaese", "Lachs extra": "raeucherlachs",
  "Rind extra": "rinderstreifen", "Halloumi extra": "halloumi", "Edamame extra": "edamame", "Granatapfelkerne extra": "granatapfelkerne", "Rote Bete extra": "rote_bete",
  "Walnüsse extra": "walnuesse", "Croutons extra": "croutons", "Crunchy Onions extra": "crunchy_onions", "Erdnüsse extra": "erdnuesse", "Ei extra": "freilandei",
  "Gurken extra": "gurken", "Karotten extra": "karotten", "Paprika extra": "paprika", "Tomaten extra": "kirschtomaten", "Weintrauben extra": "weintrauben",
  "Geg. Kartoffeln extra": "roast_potatoes", // User 16.09.2026: = „Extra - Roast Potatoes“
  "Frühlingszwiebeln extra": "fruehlingszwiebeln",
};
// Wolt-Optionen ohne offizielle Werte bzw. bewusst weggelassen → nie im Rechner, nur dokumentiert (keine Schätzungen)
const NO_DATA = {
  "Pumpkin spice Gewürz": "steht nicht in der Nährwerttabelle",
  "Marinierte Zwiebeln": "steht nicht in der Nährwerttabelle",
};
const OMITTED = {
  "Sonnenblumenkerne extra": "User 16.09.2026: nicht „Basic - Kürbis-Sonnenblumkern-Mix“ zuordnen → nicht im Rechner",
};
const EXTRA_BREAD = "extra Brot", EXTRA_DRESSING = "Extra Dressing/Sauce";
// Proteine (User 16.09.2026): jede Bestellung ≥1 davon, mehrfach bis zum Portionen-Chip; alle anderen Toppings je 1×
const PROTEINS = new Set(["haehnchen_filetstreifen", "raeucherlachs", "rinderstreifen", "halloumi", "ziegenkaese", "schafskaese"]);

const normName = s => String(s || "").replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return r.json();
}

// Nährwerttabelle: Zeilen mit 16 Zahlen (kJ, kcal, Fett, ges. Fett, KH, Zucker, Eiweiß, Salz — je pro 100 g/ml und pro Portion)
function parseNutrition() {
  const rows = [];
  let page = 0;
  for (const line of fs.readFileSync(NUTRI, "utf8").split(/\r?\n/)) {
    const pm = line.match(/^=== SEITE (\d+) ===$/);
    if (pm) { page = +pm[1]; continue; }
    const m = line.match(/^(.*?)\s+((?:\d+(?:,\d+)?\s+){15}\d+(?:,\d+)?)\s*$/);
    if (!m) continue;
    rows.push({ page, name: normName(m[1]), v: m[2].trim().split(/\s+/).map(U.parseNum) });
  }
  return rows;
}
const COLS = ["kj", "kcal", "fat", "sat", "carbs", "sugars", "protein", "salt"];
const vals = (v, off) => Object.fromEntries(COLS.map((k, i) => [k, v[i * 2 + off]]));

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [], allergenNameDiffs = [];

  // ── Bausteine aus der Nährwerttabelle ──
  const rows = parseNutrition();
  const ingredients = [];
  for (const [id, [line, name, section]] of Object.entries(PDF_ROWS)) {
    const hits = rows.filter(r => r.name === line);
    if (hits.length !== 1) { problems.push("Tabelle: Zeile „" + line + "“ " + hits.length + "× gefunden (erwartet 1)"); continue; }
    const r = hits[0], p100 = vals(r.v, 0), pp = vals(r.v, 1);
    const ing = {
      id, name, pdfName: line.replace(/^(Dressings|Brot|Mix Your Own) /, ""), section, page: r.page,
      portionG: p100.kj > 0 ? Math.round(pp.kj / p100.kj * 100) : null,
      kj: { per100: p100.kj, perPortion: pp.kj },
      per100: Object.fromEntries(U.KEYS.map(k => [k, k === "fibre" ? 0 : p100[k]])),
      perPortion: Object.fromEntries(U.KEYS.map(k => [k, k === "fibre" ? 0 : pp[k]])),
    };
    const issues = U.checkItem(ing.perPortion);
    if (issues.length) anomalies.push({ id, name: line, issues });
    ingredients.push(ing);
  }
  const byId = Object.fromEntries(ingredients.map(x => [x.id, x]));
  // Doppelte Zeilen außerhalb von „Mix Your Own“ (Abschnitt „Bowl Basis“ auf Seite 2) mit abweichenden Werten → dokumentieren
  for (const [id, other] of [["quinoa_vollkornreis", "Quinoa Vollkornreis Mix"], ["jasmin_duftreis", "Jasmin-Duftreis"]]) {
    const r = rows.find(x => x.name === other), ing = byId[id];
    if (!r || !ing) continue;
    const diff = [];
    COLS.forEach((k, i) => { if (r.v[i * 2] !== (k === "kj" ? ing.kj.per100 : ing.per100[k])) diff.push(k + " je 100 g " + r.v[i * 2] + " statt " + (k === "kj" ? ing.kj.per100 : ing.per100[k])); if (r.v[i * 2 + 1] !== (k === "kj" ? ing.kj.perPortion : ing.perPortion[k])) diff.push(k + " je Portion " + r.v[i * 2 + 1] + " statt " + (k === "kj" ? ing.kj.perPortion : ing.perPortion[k])); });
    if (diff.length) anomalies.push({ id, name: ing.pdfName, issues: ["Seite 2 („Bowl Basis“, Zeile „" + other + "“) weicht ab: " + diff.join(", ") + " → Rechner nutzt die Mix-Your-Own-Zeile"] });
  }
  // Portion ≠ je 100 g × Portionsgewicht (Rundung der Tabelle) → nur grobe Abweichungen dokumentieren
  for (const x of ingredients) {
    if (!x.portionG) continue;
    const off = U.KEYS.filter(k => k !== "fibre" && Math.abs(x.per100[k] * x.portionG / 100 - x.perPortion[k]) > Math.max(k === "kcal" ? 0.5 : 0.15, 0.06 * x.perPortion[k]));
    if (off.length) anomalies.push({ id: x.id, name: x.pdfName, issues: ["je Portion passt nicht zu je 100 g × " + x.portionG + " g bei " + off.map(k => k + " (" + x.perPortion[k] + " statt " + U.round(x.per100[k] * x.portionG / 100, 2) + ")").join(", ")] });
  }

  // ── Allergene ──
  const allerg = U.readJSON(ALLERG);
  const cleanRow = n => normName(String(n).replace(/[\uE000-\uF8FF]/g, " ").replace(/\s*Keine Allergene enthalten\s*$/, "").replace(/(\s+A\d(,\s*A\d)*)+\s*$/, ""));
  const shellfish = [];
  for (const x of ingredients) {
    const want = ALLERGEN_ROWS[x.id];
    const hits = allerg.rows.filter(r => cleanRow(r.name) === want);
    if (hits.length < 1) { problems.push("Allergenliste: Zeile „" + want + "“ fehlt (" + x.id + ")"); continue; }
    const r = hits[0];
    const gluten = (String(r.name).match(/A\d/g) || []);
    x.allergens = r.marks.filter(m => !NOT_ALLERGENS.has(m)).map(m => m === "Gluten Hinweis" ? "Gluten" + (gluten.length ? " (" + gluten.join(", ") + ")" : "") : m === "Nüsse Hinweis" ? "Schalenfrüchte" + (r.codes.length ? " (" + r.codes.join(", ") + ")" : "") : m);
    x.hints = r.marks.filter(m => NOT_ALLERGENS.has(m));
    if (want !== x.pdfName) allergenNameDiffs.push(x.pdfName + " = Allergenliste „" + want + "“");
    if (r.marks.some(m => m === "Krebstiere" || m === "Weichtiere")) { x.shellfish = true; shellfish.push(x.pdfName + ": " + x.allergens.join(", ")); }
  }

  // ── Wolt-Menüs ──
  const venues = {};
  const assort = async slug => { const j = await getJSON(WOLT_API(slug)); await sleep(1200); return j; };
  const menuOf = (j, itemName) => {
    const it = (j.items || []).find(i => normName(i.name) === itemName);
    if (!it) return null;
    const byOpt = Object.fromEntries((j.options || []).map(o => [o.id, o]));
    return { price: it.price, disabled: !!it.disabled_info, groups: (it.options || []).map(ref => {
      const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
      return { name: normName(ref.name), min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1,
        values: (g.values || []).map(v => ({ name: normName(v.name), price: v.price, max: v.multi_choice_config && v.multi_choice_config.total_range ? v.multi_choice_config.total_range.max : 1 })) };
    }) };
  };
  const prim = await assort(PRIMARY);
  const raw = { salad: null, bowl: null };
  const mapped = new Set(), noData = [], omitted = [];
  for (const [key, itemName] of Object.entries(ITEMS)) {
    const m = menuOf(prim, itemName);
    if (!m) { problems.push("Wolt (" + PRIMARY + "): Item „" + itemName + "“ fehlt"); continue; }
    if (m.disabled) problems.push("Wolt (" + PRIMARY + "): Item „" + itemName + "“ ist deaktiviert");
    const menu = { page: WOLT_PAGE(PRIMARY), venue: PRIMARY, item: itemName, itemPrice: U.round(m.price / 100, 2), require: { base: key === "bowl", protein: true }, fixed: ["blattsalatmix"], groups: [], extraBreadDressing: null };
    for (const g of m.groups) {
      const def = GROUPS[g.name];
      if (!def) { problems.push("Wolt: unbekannte Gruppe „" + g.name + "“ (" + itemName + ")"); continue; }
      if (def.kind === "extraBreadDressing") {
        const d = g.values.find(v => v.name === EXTRA_DRESSING), b = g.values.find(v => v.name === EXTRA_BREAD);
        if (!d || !b || g.values.length !== 2) problems.push("Wolt: „" + g.name + "“ hat nicht genau „" + EXTRA_DRESSING + "“ + „" + EXTRA_BREAD + "“");
        menu.extraBreadDressing = { id: def.id, name: g.name, min: g.min, max: g.max, dressing: d ? { name: d.name, price: U.round(d.price / 100, 2) } : null, bread: b ? { name: b.name, price: U.round(b.price / 100, 2) } : null };
        menu.groups.push({ id: def.id, name: g.name, kind: def.kind, min: g.min, max: g.max, none: null, options: [] });
        continue;
      }
      const grp = { id: def.id, name: g.name, kind: def.kind, min: g.min, max: g.max, none: null, options: [] };
      for (const v of g.values) {
        if (NONE.has(v.name)) { grp.none = v.name; continue; }
        if (NO_DATA[v.name]) { noData.push(itemName + ": „" + v.name + "“ (" + U.round(v.price / 100, 2) + " €) — " + NO_DATA[v.name]); continue; }
        if (OMITTED[v.name]) { omitted.push(itemName + ": „" + v.name + "“ (" + U.round(v.price / 100, 2) + " €) — " + OMITTED[v.name]); continue; }
        const id = WOLT_MAP[v.name];
        if (!id || !byId[id]) { problems.push("Wolt: nicht zugeordnete Option „" + v.name + "“ in „" + g.name + "“ (WOLT_MAP ergänzen)"); continue; }
        mapped.add(id);
        const role = def.kind === "extras" ? (PROTEINS.has(id) ? "protein" : "extra") : def.kind;
        grp.options.push({ name: v.name, ingredient: id, role, maxQty: Math.max(1, v.max || 1), price: U.round(v.price / 100, 2) });
      }
      if ((def.kind === "dip" || def.kind === "side") && !grp.none) problems.push("Wolt: „" + g.name + "“ ohne „ohne …“-Option");
      menu.groups.push(grp);
    }
    if (!menu.extraBreadDressing) problems.push("Wolt: „EXTRA BROT/DRESSING DAZU?“ fehlt (" + itemName + ")");
    raw[key] = menu;
  }
  // Vergleich mit den übrigen Frankfurter Filialen (nur dokumentiert)
  const sig = m => m ? m.groups.map(g => g.name + "[" + g.min + "–" + g.max + "]:" + g.values.map(v => v.name + "=" + v.price).join(",")).join(" | ") : null;
  const primSig = Object.fromEntries(Object.entries(ITEMS).map(([k, n]) => [k, menuOf(prim, n)]));
  for (const slug of COMPARE) {
    let j;
    try { j = await assort(slug); } catch (e) { venues[slug] = "Abruf fehlgeschlagen: " + e.message; continue; }
    const notes = [];
    for (const [k, n] of Object.entries(ITEMS)) {
      const m = menuOf(j, n), pm = primSig[k];
      if (!m) { notes.push(n + " fehlt"); continue; }
      if (sig(m) === sig(pm)) { notes.push(n + " identisch"); continue; }
      const pv = new Set(pm.groups.flatMap(g => g.values.map(v => g.name + "|" + v.name + "|" + v.price))), mv = new Set(m.groups.flatMap(g => g.values.map(v => g.name + "|" + v.name + "|" + v.price)));
      const only = (a, b) => [...a].filter(x => !b.has(x)).map(x => x.split("|").slice(1).join(" "));
      notes.push(n + ": nur " + PRIMARY + " [" + only(pv, mv).join("; ") + "] · nur hier [" + only(mv, pv).join("; ") + "]" + (m.price !== pm.price ? " · Preis " + m.price / 100 + " €" : ""));
    }
    venues[slug] = notes.join(" · ");
  }

  const notOnWolt = ingredients.filter(x => !mapped.has(x.id) && x.id !== "blattsalatmix").map(x => x.pdfName);
  const out = {
    _meta: {
      restaurant: "dean&david", fetchedAt,
      sources: {
        nutrition: { file: "data/deandavid-naehrwerte.txt", pdf: "https://deananddavid.com/wp-content/uploads/2026/09/2026-08-dd-Naehrwertuebersicht.pdf", stand: "August 2026 (PDF vom 18.08.2026)" },
        allergens: { file: "data/deandavid-allergene.json", pdf: "https://deananddavid.com/wp-content/uploads/2026/09/2026-08-dd-Allergenliste-DE-gueltig-bis-Dezember-2026.pdf", stand: "gültig bis Dezember 2026 (Stand 01.09.2026)" },
        wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY) },
      },
      basis: "Offizielle Werte PRO PORTION der Mix-Your-Own-Bausteine. Ballaststoffe sind in der Tabelle nicht angegeben → 0. portionG = kJ je Portion / kJ je 100 g (nur Info).",
      rules: "Salat: Premium Blattsalatmix immer enthalten (fester Bestandteil), keine Basis-Auswahl; Bowl: genau eine Basis (Jasmin-Duftreis oder Quinoa-Vollkornreis) + Blattsalatmix (laut Wolt-Beschreibung). Dressing/Sauce 0–2 Portionen, Brot 0–2 Scheiben: „Mit knusprigem Landbrot“ = 1 Scheibe, „extra Brot“ = +1 Scheibe (+0,30 €), „Extra Dressing/Sauce“ = +1 Portion des gewählten Dressings (+0,80 €). Proteine (Chicken, Lachs, Rind, Halloumi, Ziegenkäse, Schafskäse) mehrfach bis zum Portionen-Chip, jede Bestellung ≥1 Protein; übrige Toppings je 1× (Wolt erlaubt je Topping bis 999×).",
      decisions: [
        "User 16.09.2026: Dean & David (Wolt) mit zwei Trackern „Mix Your Own Salad bar“ und „Mix Your Own Bowl bar“, mit Preisen und Schalter „No dressing“ (Default AN wie alle „No …“-Schalter)",
        "User 16.09.2026: Allergenliste von deananddavid.com herunterladen und für den Schalentier-Check auswerten",
        "User 16.09.2026: ≥1 Protein je Bestellung, Proteine mehrfach (Portionen-Chip), alle anderen Toppings je 1×",
        "User 16.09.2026: „Mit knusprigem Landbrot“ = 1 Scheibe, „extra Brot“ = +1 Scheibe, „Extra Dressing/Sauce“ = +1 Portion",
        "User 16.09.2026: „Geg. Kartoffeln extra“ = „Extra - Roast Potatoes“; „Sonnenblumenkerne extra“ NICHT dem Kürbis-Sonnenblumkern-Mix zuordnen (weglassen)",
      ],
      mapping: Object.fromEntries(Object.entries(WOLT_MAP).map(([w, id]) => [w, byId[id] ? byId[id].pdfName : id])),
      noData, omitted, notOnWolt, venues, anomalies, allergenNameDiffs, shellfish,
      fibre: "Ballaststoffe nicht angegeben → 0 (alle Bausteine)",
      dislikes: "Koriander/Minze: Die offiziellen Listen enthalten keine Zutaten → nicht prüfbar (Lemon Herbs Sauce: Kräuter unbekannt)",
    },
    ingredients,
    salad: raw.salad,
    bowl: raw.bowl,
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(ingredients.length + " Bausteine → " + path.relative(__dirname, OUT));
  for (const k of ["salad", "bowl"]) console.log("Wolt „" + out[k].item + "“ (" + out[k].itemPrice + " €): " + out[k].groups.map(g => g.name + " " + g.options.length + (g.none ? " + „" + g.none + "“" : "")).join(" · ") + " · Extra Brot " + out[k].extraBreadDressing.bread.price + " € / Extra Dressing " + out[k].extraBreadDressing.dressing.price + " €");
  console.log("Proteine: " + [...PROTEINS].map(id => byId[id].pdfName).join(", "));
  console.log("Ohne offizielle Werte: " + noData.join(" · "));
  console.log("Weggelassen: " + omitted.join(" · "));
  console.log("Nicht bei Wolt: " + notOnWolt.join(", "));
  console.log("Schalentier (Krebstiere/Weichtiere): " + (shellfish.join(" · ") || "keine"));
  console.log("Allergen-Namen abweichend: " + allergenNameDiffs.join(" · "));
  console.log("Filialen: " + Object.entries(venues).map(([s, n]) => s + ": " + n).join("\n          "));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}
main().catch(e => { console.error("FEHLER: " + e.message); process.exit(1); });
