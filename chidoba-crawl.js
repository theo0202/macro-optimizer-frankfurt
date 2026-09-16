// Chidoba Frankfurt (Wolt, Kaiserstraße): Cups + Salate (+ Snack „Chili con Carne“) → data/chidoba-raw.json (Quelle der Wahrheit, NICHT von Hand
// editieren — Kuratierung passiert in den Tabellen unten). Aufruf: node chidoba-crawl.js · danach node chidoba-update.js
// Quellen: offizieller Nährwertrechner chidoba.com/nutrition (je Produktart eine Seite; jede Zutat trägt ihre Werte je Portion als data-Attribute
// am Auswahlfeld — kein Durchklicken nötig) · Menü, Namen, Preise und Auswahlregeln aus der Wolt-API der Filiale Kaiserstraße (User 16.09.2026).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "chidoba-raw.json");
const CALC = type => "https://www.chidoba.com/nutrition?type=" + encodeURIComponent(type);
const CALC_TYPES = ["Burrito", "Taco 1er", "Taco 3er", "Cup", "Salat", "Sides", "Snacks", "Dips"];
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
const PRIMARY = "chidobi-mexican-grill"; // = „chidoba MEXICAN GRILL® - Frankfurt Kaiserstraße“ (Kaiserstraße 49), User 16.09.2026

// Wolt-Produkte im Tracker: Name → Produktart + Protein (Rechner-Zeile „Fleisch“)
const PRODUCTS = {
  "Chicken Cup": { type: "cup", protein: "Chicken" }, "Beef Cup": { type: "cup", protein: "Beef" }, "Filetsteak Cup": { type: "cup", protein: "Filetsteak" }, "Barbacoa Cup": { type: "cup", protein: "Barbacoa" },
  "Chicken Salat": { type: "salat", protein: "Chicken" }, "Beef Salat": { type: "salat", protein: "Beef" }, "Filetsteak Salat": { type: "salat", protein: "Filetsteak" },
};
const PRODUCT_NO_DATA = {
  "Veggie Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ hat im Rechner keine Werte (dort nur gegrilltes Gemüse)",
  "Planted Chicken Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Vegan Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Veggie Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Vegan Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Planted Chicken Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
};
const TYPE_CALC = { cup: "Cup", salat: "Salat" };
const PROTEIN_ING = { Chicken: "chicken", Beef: "beef", Filetsteak: "filetsteak", Barbacoa: "barbacoa" };
// Wolt-Gruppen je Produktart (Name → Art)
const GROUPS = {
  "Deine Basis": { id: "basis", kind: "base" },
  "Wähle deine Zutaten": { id: "zutaten", kind: "standard" },
  "Deine Cream": { id: "cream", kind: "cream" }, "Deine Soße": { id: "cream", kind: "cream" },
  "Deine Salsa": { id: "salsa", kind: "salsa" },
  "Deine Extras": { id: "extras", kind: "extras" },
};
const NONE = new Set(["Ohne Basis", "Ohne Creme", "Ohne Cream", "Ohne Salsa"]);
// Basis (Cup): Wolt-Name → Rechner-Zeile (Abschnitt „Füllung“)
const BASE_MAP = { "Gewürzreis": ["gewuerzreis", "gewürzter Reis"], "Cubes": ["cubes", "Cubes"] };
// Standard-Zutaten (Wolt: „Ohne …“ zum Abwählen) → Baustein; optional = der Optimizer darf abwählen (User 16.09.2026: nur Black Beans);
// sauce = fällt mit „No sauce/cheese/dips“ weg; noData = keine Werte im Rechner → wird immer abgewählt
const STANDARD_MAP = {
  "Ohne Black Beans": { ing: "black_beans", calc: "Black Beans", name: "Black Beans", optional: true },
  "Ohne gegrillte Paprika & rote Zwiebeln": { ing: "gegrilltes_gemuese", calc: "gegrilltes Gemüse", name: "gegrillte Paprika & rote Zwiebeln" },
  "Ohne Eisbergsalat": { ing: "eisbergsalat", calc: "Eisbergsalat", name: "Eisbergsalat" },
  "Ohne Cheddar Jack Cheese": { ing: "cheddar_jack_cheese", calc: "Cheddar Jack Cheese", name: "Cheddar Jack Cheese", sauce: true },
  "Ohne Limette": { ing: "limette", calc: "Limette", name: "Limette", defaultOff: "User 16.09.2026: Limette standardmäßig immer raus" },
  "Ohne California Dressing": { ing: "california_dressing", calc: "California Dressing", name: "California Dressing", sauce: true },
  "Ohne Tortilla Strips": { noData: "Tortilla Strips haben im Rechner keine Werte → der Order Guide wählt sie immer ab" },
};
const CREAM_MAP = { "Sour Cream": ["sour_cream", "Sour Cream"] };
const SALSA_MAP = { "Mild": ["salsa", "Salsa Mild oder Medium"] };
// Salsa mit gleichen Werten, die zusätzlich bestellt werden darf (User 16.09.2026: „Salsa Mild und Medium“ auch bei „No sauce/cheese/dips“)
const SALSA_ALSO = ["Medium"];
const SALSA_SAME = { "Medium": "gleiche Rechner-Zeile wie Mild („Salsa Mild oder Medium“) → nicht doppelt angeboten", "Scharf": "„Salsa Hot“ hat genau die Werte von Mild/Medium → nicht doppelt angeboten" };
const EXTRA_MAP = {
  "Beef": ["beef", "Beef (extra)"], "Chicken": ["chicken", "Chicken (extra)"], "Barbacoa": ["barbacoa", "Barbacoa (extra)"], "Filetsteak": ["filetsteak", "Filetsteak (extra)"],
  "Guacamole": ["guacamole", "1 Kugel Guacamole", true], "Cheesesauce": ["cheesesauce", "Cheesesauce", true], "Cheddar Jack Cheese": ["cheddar_jack_cheese", "Cheddar Jack Cheese", true],
};
const NO_DATA = {
  "Chili Creme": "nicht im Rechner", "Chili Cream": "nicht im Rechner", "Jalapeños": "nicht im Rechner", "Chili con Carne": "Extra-Portion im Cup/Salat nicht im Rechner (nur der Snack)",
  "Planted Chicken": "als Extra nicht im Rechner", "Habanero Sauce": "nicht im Rechner", "Tabasco": "nicht im Rechner",
};
// Koriander (User 13.09.2026: nie vorschlagen, wenn prominent)
const NEVER = { "Korianderreis": "Koriander (User 13.09.2026)", "Cilantro Creme": "Koriander (User 13.09.2026); keine Werte im Rechner", "Cilantro Cream": "Koriander (User 13.09.2026); keine Werte im Rechner" };
// Salat-Basis (immer drin): Rechner „Salat“ → Füllung „Eisbergsalat“
const SALAD_BASE = { ing: "salatbasis", calc: "Eisbergsalat", name: "Eisbergsalat (Salat-Basis)" };
const CHILI = { wolt: "Chili con Carne", calc: "Chili con Carne", ing: "chili_con_carne" };
const ALLERGENS = { gluten: "Gluten", krebstiere: "Krebstiere", eier: "Eier", fisch: "Fisch", erdnuesse: "Erdnüsse", sojabohnen: "Soja", milch: "Milch", nuesse: "Schalenfrüchte", sellerie: "Sellerie", senf: "Senf", sesamkoerner: "Sesam", schwefeldioxid: "Schwefeldioxid/Sulfite", mollusken: "Weichtiere", lupin: "Lupinen" };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const H_HTML = { Accept: "text/html", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const toNum = v => (v == null || String(v).trim() === "" ? null : (/^\d+(\.\d+)?$/.test(String(v).trim()) ? parseFloat(v) : NaN));

// Rechner-Seite: Abschnitte („2. Füllung“ …) mit Auswahlfeldern; Werte je Portion; Natrium in mg → Salz = Natrium × 2,5
function parseCalculator(html, problems, type) {
  const heads = [...html.matchAll(/<div class="nu-digit">([^<]*)<\/div>\s*<div class="nu-category">([^<]*)<\/div>/g)].map(m => ({ idx: m.index, name: normName(decode(m[2])) }));
  const out = [];
  for (let c = 0; c < heads.length; c++) {
    if (c === 0) continue; // „1. Produkt“ = Auswahl der Produktart
    const part = html.slice(heads[c].idx, c + 1 < heads.length ? heads[c + 1].idx : html.length);
    const items = [];
    for (const m of part.matchAll(/<label class="container">\s*<input([\s\S]*?)>\s*<span class="checkmark"><\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/g)) {
      const a = Object.fromEntries([...m[1].matchAll(/data-([a-z_]+)="([^"]*)"/g)].map(x => [x[1], x[2]]));
      const label = normName(decode(m[2].replace(/<[^>]+>/g, "")));
      const raw = { kcal: toNum(a.kalorien), fat: toNum(a.fett), sat: toNum(a.fett_gesaettigt), carbs: toNum(a.kohlehydrate), sugars: toNum(a.zucker), fibre: toNum(a.ballaststoffe), protein: toNum(a.protein), natrium: toNum(a.natrium) };
      if (Object.values(raw).some(v => Number.isNaN(v))) { problems.push("Rechner " + type + ": unlesbare Zahl bei „" + label + "“"); continue; }
      const empty = Object.values(raw).every(v => v == null);
      const perPortion = empty ? null : Object.fromEntries(U.KEYS.map(k => [k, k === "salt" ? U.round((raw.natrium || 0) * 2.5 / 1000, 3) : U.round(raw[k] || 0, 2)]));
      const flags = Object.keys(a).filter(k => a[k] === "JA");
      items.push({ label, section: heads[c].name, multi: /type="checkbox"/.test(m[1]), perPortion, natriumMg: raw.natrium, allergens: flags.filter(f => ALLERGENS[f]).map(f => ALLERGENS[f]), hints: flags.filter(f => !ALLERGENS[f]) });
    }
    out.push({ section: heads[c].name, items });
  }
  return out;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];

  // ── Nährwertrechner (alle Produktarten als Datensatz) ──
  const calculator = {};
  for (const type of CALC_TYPES) {
    calculator[type] = parseCalculator(await get(CALC(type), H_HTML), problems, type);
    if (!calculator[type].length) problems.push("Rechner: Produktart „" + type + "“ ohne Abschnitte (Seitenaufbau geändert?)");
    await sleep(600);
  }
  const calcRow = (type, label, section) => {
    const hits = calculator[type].flatMap(s => s.items).filter(i => i.label === label && (!section || i.section === section));
    if (hits.length !== 1) { problems.push("Rechner " + type + ": „" + label + "“ " + hits.length + "× gefunden (erwartet 1)"); return null; }
    if (!hits[0].perPortion) { problems.push("Rechner " + type + ": „" + label + "“ ohne Werte"); return null; }
    return hits[0];
  };
  // Bausteine je Produktart (die Werte können sich zwischen Cup und Salat unterscheiden, z.B. Barbacoa)
  const components = [];
  const comp = (tp, ing, calcType, label, section, name) => {
    const row = calcRow(calcType, label, section);
    if (!row) return null;
    const id = tp + "_" + ing;
    let c = components.find(x => x.id === id);
    if (!c) {
      c = { id, ing, type: tp, name: name || row.label, calcType, calcLabel: row.label, section: row.section, perPortion: row.perPortion, natriumMg: row.natriumMg, allergens: row.allergens, hints: row.hints };
      if (row.allergens.includes("Krebstiere") || row.allergens.includes("Weichtiere")) c.shellfish = true;
      const issues = U.checkItem(row.perPortion);
      if (issues.length) anomalies.push({ name: calcType + " / " + row.label, issues });
      components.push(c);
    }
    return c;
  };

  // ── Wolt Kaiserstraße ──
  const assort = await get(WOLT_API(PRIMARY), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  const items = Object.values(byItem);
  const productNoData = [], never = new Map(), noData = new Map(), same = new Map();
  const menus = { cup: null, salat: null };
  const products = [];
  for (const it of items) {
    const name = normName(it.name);
    if (PRODUCT_NO_DATA[name]) { if (!productNoData.some(x => x.startsWith(name + " "))) productNoData.push(name + " (" + U.round(it.price / 100, 2) + " €) — " + PRODUCT_NO_DATA[name]); continue; }
    const def = PRODUCTS[name];
    if (!def) continue;
    if (products.some(p => p.name === name)) continue;
    const calcType = TYPE_CALC[def.type];
    const prot = comp(def.type, PROTEIN_ING[def.protein], calcType, def.protein, "Fleisch", def.protein);
    const groups = [], sig = [];
    for (const ref of it.options || []) {
      const gname = normName(ref.name), gd = GROUPS[gname];
      const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
      if (!gd) { problems.push("Wolt: unbekannte Gruppe „" + gname + "“ (" + name + ")"); continue; }
      const grp = { id: gd.id, name: gname, kind: gd.kind, min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1, none: null, options: [], removals: [] };
      if (gd.kind === "standard") grp.ohneOrder = [];
      for (const v of g.values || []) {
        const vn = normName(v.name), price = U.round(v.price / 100, 2);
        sig.push(gname + "|" + vn + "|" + price);
        if (NONE.has(vn)) { grp.none = vn; continue; }
        if (NEVER[vn]) { never.set(gname + "|" + vn, "„" + vn + "“ (" + gname + ") — " + NEVER[vn]); continue; }
        if (gd.kind === "standard") {
          grp.ohneOrder.push(vn);
          const sd = STANDARD_MAP[vn];
          if (!sd) { problems.push("Wolt: unbekannte Standard-Zutat „" + vn + "“ (" + name + ")"); continue; }
          if (sd.noData) { grp.removals.push(vn); noData.set(vn, "„" + vn.replace(/^Ohne /, "") + "“ (Standard-Zutat Salat) — " + sd.noData); continue; }
          const c = comp(def.type, sd.ing, calcType, sd.calc, "Zutaten", sd.name);
          if (!c) continue;
          grp.options.push(Object.assign({ name: sd.name, removeName: vn, component: c.id, ing: sd.ing, price: 0, optional: !!sd.optional, sauce: !!sd.sauce }, sd.defaultOff ? { defaultOff: true } : {}));
          continue;
        }
        const map = gd.kind === "base" ? BASE_MAP : gd.kind === "cream" ? CREAM_MAP : gd.kind === "salsa" ? SALSA_MAP : EXTRA_MAP;
        if (gd.kind === "salsa" && SALSA_SAME[vn]) { same.set(vn, "Salsa „" + vn + "“ — " + SALSA_SAME[vn]); continue; }
        if (gd.kind === "extras" && vn === "Cheesesauce" && def.type === "salat") { noData.set("Salat|Cheesesauce", "„Cheesesauce“ (Extra im Salat) — der Salat-Rechner führt keine Cheesesauce"); continue; }
        if (NO_DATA[vn]) { noData.set(vn, "„" + vn + "“ (" + gname + (price ? ", +" + price.toFixed(2).replace(".", ",") + " €" : "") + ") — " + NO_DATA[vn]); continue; }
        const mm = map[vn];
        if (!mm) { problems.push("Wolt: nicht zugeordnete Option „" + vn + "“ in „" + gname + "“ (" + name + ")"); continue; }
        const c = comp(def.type, mm[0], calcType, mm[1], gd.kind === "base" ? "Füllung" : "Zutaten", gd.kind === "extras" ? vn : null);
        if (!c) continue;
        const o = { name: vn, component: c.id, ing: mm[0], price, maxQty: 1 };
        if (mm[2] || gd.kind === "cream") o.sauce = true;
        if (gd.kind === "salsa") o.also = SALSA_ALSO.slice();
        grp.options.push(o);
      }
      groups.push(grp);
    }
    products.push({ name, type: def.type, protein: PROTEIN_ING[def.protein], component: prot ? prot.id : null, price: U.round(it.price / 100, 2), signature: sig.join(",") });
    // Gruppen je Produktart einmal ablegen; alle Produkte einer Art müssen dieselben Optionen und Preise haben
    if (!menus[def.type]) menus[def.type] = { groups, signature: sig.join(",") };
    else if (menus[def.type].signature !== sig.join(",")) problems.push("Wolt: Optionen von „" + name + "“ weichen von den anderen " + def.type + "-Produkten ab");
  }
  for (const n of Object.keys(PRODUCTS)) if (!products.some(p => p.name === n)) problems.push("Wolt: Produkt „" + n + "“ fehlt");
  // Salat-Basis + Snack
  const saladBase = comp("salat", SALAD_BASE.ing, "Salat", SALAD_BASE.calc, "Füllung", SALAD_BASE.name);
  const chiliItem = items.find(i => normName(i.name) === CHILI.wolt);
  if (!chiliItem) problems.push("Wolt: Snack „" + CHILI.wolt + "“ fehlt");
  const chiliComp = comp("snack", CHILI.ing, "Snacks", CHILI.calc, "Snacks", CHILI.wolt);
  const chiliOpts = chiliItem ? (chiliItem.options || []).map(ref => { const g = byOpt[ref.option_id] || {}; const cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {}; return normName(ref.name) + " [" + cfg.min + "–" + cfg.max + "]: " + (g.values || []).map(v => normName(v.name) + (v.price ? " +" + U.round(v.price / 100, 2) : "")).join(", "); }) : [];
  // Werte-Unterschiede Cup ↔ Salat derselben Zutat dokumentieren
  const typeDiffs = [];
  for (const c of components.filter(x => x.type === "cup")) {
    const s = components.find(x => x.type === "salat" && x.ing === c.ing);
    if (!s) continue;
    const d = U.KEYS.filter(k => Math.abs(c.perPortion[k] - s.perPortion[k]) > 1e-9);
    if (d.length) typeDiffs.push(c.name + ": Cup " + d.map(k => k + " " + c.perPortion[k]).join(", ") + " · Salat " + d.map(k => k + " " + s.perPortion[k]).join(", "));
  }
  if (typeDiffs.length) anomalies.push({ name: "Cup ↔ Salat", issues: ["Rechner nennt je Produktart andere Werte (Tracker nutzt je Produktart die eigene Zeile): " + typeDiffs.join(" · ")] });
  if (chiliComp && Math.abs(chiliComp.perPortion.fibre - chiliComp.perPortion.protein) < 1e-9) anomalies.push({ name: "Snacks / Chili con Carne", issues: ["Ballaststoffe = Eiweiß (je " + chiliComp.perPortion.protein + " g) — möglicher Übertragungsfehler, unverändert übernommen"] });
  const lowNa = components.filter(c => c.natriumMg != null && c.natriumMg < 3 && !/Limette|Eisbergsalat/.test(c.name)).map(c => c.calcType + " / " + c.calcLabel + " " + c.natriumMg + " mg");
  if (lowNa.length) anomalies.push({ name: "Natrium", issues: ["auffällig niedrig (Salz ≈ 0): " + lowNa.join(", ")] });
  const coriander = components.filter(c => c.hints.includes("koriander_fri") || c.hints.includes("koriander_gew")).map(c => c.calcType + " / " + c.calcLabel + ": " + [c.hints.includes("koriander_fri") ? "frischer Koriander" : null, c.hints.includes("koriander_gew") ? "Koriander (Gewürz)" : null].filter(Boolean).join(" + "));

  const out = {
    _meta: {
      restaurant: "chidoba MEXICAN GRILL", fetchedAt,
      sources: { nutrition: { calculator: CALC("{Produktart}"), types: CALC_TYPES }, wolt: { venue: PRIMARY, name: "chidoba MEXICAN GRILL® - Frankfurt Kaiserstraße", page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY) } },
      basis: "Offizielle Werte je Portion aus dem chidoba-Nährwertrechner (data-Attribute je Zutat), getrennt je Produktart (Cup, Salat, Snacks). Salz = Natrium (mg) × 2,5 / 1000. Wolt-Namen und -Preise der Filiale Kaiserstraße.",
      rules: "Jede Bestellung = ein Cup oder Salat (Protein laut Artikel) mit seinen Standard-Zutaten; Cup: Basis 0–1 (Gewürzreis, Cubes); Cream 0–1, Salsa 0–1, Extras je 1× (Wolt bis 7); optional 1× Snack „Chili con Carne“ als zweiter Artikel.",
      decisions: [
        "User 16.09.2026: Chidoba als Tracker; relevant nur „Cup“, „Salat“ und „Chili con Carne“ (Snacks); Nährwerte aus dem Rechner auf chidoba.com",
        "User 16.09.2026: Schalter „No Sauce/Cheese/Dips“ Default AN (keine Cheesesauce, Salsa, Sour Cream, Cheddar Jack Cheese, Guacamole)",
        "User 16.09.2026: Plattform Wolt, Filiale Kaiserstraße (Namen, Verfügbarkeit, Preise)",
        "User 16.09.2026: Schalter „Add Chili con carne“ (Default AUS) — an: der Optimizer darf 1× Chili con Carne als zweiten Artikel dazunehmen, wenn es die Ziele besser trifft",
        "User 16.09.2026: Standard-Zutaten fix, nur Black Beans darf der Optimizer abwählen",
        "User 16.09.2026: Limette standardmäßig immer raus (Order Guide „Ohne Limette“; als Pflicht-Zutat bleibt sie drin)",
        "User 16.09.2026: Salsa Mild und Medium auch bei „No sauce/cheese/dips“ erlaubt (gleiche Rechner-Zeile → Order Guide „Mild or Medium“)",
        "User 16.09.2026: Bestellfenster Chicken Cup / Chicken Salat abgeglichen (Gruppen, Grenzen, „Ohne …“-Reihenfolge, Extras-Preise) — der Order Guide folgt ihm",
      ],
      assumptions: [
        "„No Sauce/Cheese/Dips“ wählt auch die Standard-Zutaten Cheddar Jack Cheese und (Salat) California Dressing ab",
        "Extra Cheddar Jack Cheese = eine weitere Portion laut Rechner",
        "Tortilla Strips (Standard im Salat) haben keine Werte → der Order Guide wählt sie immer ab",
      ],
      products: products.map(p => p.name + " " + p.price + " €"), productNoData, never: [...never.values()], noData: [...noData.values()], sameValues: [...same.values()],
      chili: chiliItem ? { name: CHILI.wolt, price: U.round(chiliItem.price / 100, 2), description: normName(chiliItem.description), options: chiliOpts, note: "Werte = Standard-Zusammenstellung laut Rechner (inkl. Sour Cream und Tortilla Strips laut Wolt-Beschreibung); wird nicht umgebaut" } : null,
      anomalies, coriander,
      shellfish: components.some(c => c.shellfish) ? components.filter(c => c.shellfish).map(c => c.name) : "kein Baustein mit Krebs- oder Weichtieren laut Rechner",
    },
    calculator,
    components,
    wolt: {
      venue: PRIMARY, page: WOLT_PAGE(PRIMARY),
      products: products.map(({ signature, ...p }) => p),
      menus: { cup: menus.cup && menus.cup.groups, salat: menus.salat && menus.salat.groups },
      saladBase: saladBase ? saladBase.id : null,
      chili: chiliItem && chiliComp ? { name: CHILI.wolt, component: chiliComp.id, ing: CHILI.ing, price: U.round(chiliItem.price / 100, 2), category: "SNACKS 🥪" } : null,
    },
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(components.length + " Bausteine (" + CALC_TYPES.length + " Rechner-Seiten) → " + path.relative(__dirname, OUT));
  console.log("Produkte: " + out._meta.products.join(" · "));
  for (const tp of ["cup", "salat"]) console.log(tp + ": " + out.wolt.menus[tp].map(g => g.name + " [" + g.min + "–" + g.max + "] " + g.options.map(o => o.name + (o.price ? " +" + o.price : "") + (o.optional ? " (abwählbar)" : "") + (o.sauce ? " (sauce)" : "")).join(", ") + (g.none ? " + „" + g.none + "“" : "") + (g.removals.length ? " · immer: " + g.removals.join(", ") : "")).join("\n       "));
  console.log("Chili con Carne: " + JSON.stringify(out._meta.chili));
  console.log("Nicht im Tracker (Produkte): " + productNoData.join(" · "));
  console.log("Ohne Werte: " + out._meta.noData.join(" · "));
  console.log("Nie (Koriander): " + out._meta.never.join(" · "));
  console.log("Gleiche Werte: " + out._meta.sameValues.join(" · "));
  console.log("Koriander in Bausteinen: " + coriander.join(" · "));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}
main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
