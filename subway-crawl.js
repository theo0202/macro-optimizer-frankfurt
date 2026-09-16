// Subway Frankfurt (Wolt, „Create Your Own“) → data/subway-raw.json (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung passiert in den
// Tabellen unten). Aufruf: node subway-crawl.js · danach node subway-update.js
// Quellen: offizielle Nährwertinformation Subway Deutschland (September 2026; data/subway-naehrwerte.txt, aus der PDF erzeugt mit subway-pdf.py);
// Menü, Preise und Auswahlregeln aus der Wolt-API (consumer-assortment) der Filiale Frankfurt Zeil.
//
// Rechenbasis: die offiziellen Werte PRO PORTION (15 cm). Footlong = Werte ×2 („Für Footlong-Nährwertangaben bitte die Werte verdoppeln (ein
// Footlong = zwei 15-cm-Portionen), ausgenommen Salate“ — „Salate“ meint die Salat-Gerichte, nicht die Toppings; User 16.09.2026).
// Der komplette Tabelleninhalt (auch Wraps, Salate, Baked Potatoes, Beilagen, Getränke, Cookies) steht unter products im Datensatz, im Tracker
// sind nur die Sub-Bausteine (User 16.09.2026).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const NUTRI = path.join(__dirname, "data", "subway-naehrwerte.txt");
const OUT = path.join(__dirname, "data", "subway-raw.json");
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
// Datenquelle des Rechners: Frankfurt Zeil (Preise = Liste des Users vom 16.09.2026); die übrigen Frankfurter Filialen werden nur verglichen
const PRIMARY = "subway-frankfurt-zeil";
const COMPARE = ["subway-franfurt-skyline-plaza", "subway-frankfurt-nordwestzentrum"];
const CATEGORY = "Create Your Own";

// Abschnitte der Nährwerttabelle (Reihenfolge wie im PDF)
const SECTIONS = ["Sandwich", "Wraps", "Salads", "\"Unsere Kreationen\" Subs", "Baked Potato", "Panini", "Footlong Sidekicks", "Beilagen", "Getränke", "Saucen", "Cookies", "Käse", "Zutaten/Toppings", "Brot", "Einzel-Zutaten"];
// Sub-Bausteine: id → [Abschnitt, Zeilenname im PDF]
const COMPONENTS = {
  italian: ["Brot", "Italian"], sesam: ["Brot", "Sesam"], cheese_oregano: ["Brot", "Cheese Oregano"], honey_oat: ["Brot", "Honey Oat"],
  vollkornbrot: ["Brot", "Vollkornbrot"], weizenwrap: ["Brot", "Weizenwrap"], glutenfrei: ["Brot", "Glutenfrei"],
  scheibenkaese: ["Käse", "Scheibenkäse"], mozzarella_emmental_mix: ["Käse", "Mozzarella-Emmental-Mix"], frischkaese: ["Käse", "Frischkäse"],
  cheddar: ["Käse", "Cheddar"], vegan_slices: ["Käse", "Vegan Slices (vegan)"],
  bbq_sauce: ["Saucen", "BBQ Sauce (vegan)"], caesar_sauce: ["Saucen", "Caesar Sauce"], chipotle_southwest: ["Saucen", "Chipotle Southwest Sauce"],
  x_spicy_chipotle: ["Saucen", "X-spicy Chipotle Sauce (vegan)"], honey_wholegrain_mustard: ["Saucen", "Honey & Wholegrain Mustard Sauce"],
  lite_mayonnaise: ["Saucen", "Lite Mayonnaise"], joghurt: ["Saucen", "Joghurt"], sweet_onion: ["Saucen", "Sweet Onion (vegan)"],
  garlic_herb: ["Saucen", "Garlic & Herb (vegan)"], balsamic_vinegar: ["Saucen", "Balsamic Vinegar (vegan)"], olivenoel: ["Saucen", "Olivenöl (vegan)"],
  ketchup: ["Saucen", "Ketchup"],
  jalapenos: ["Zutaten/Toppings", "Jalapeños"], oliven: ["Zutaten/Toppings", "Oliven"], gewuerzgurken: ["Zutaten/Toppings", "Gewürzgurken"],
  mais: ["Zutaten/Toppings", "Mais"], salat: ["Zutaten/Toppings", "Salat"], tomaten: ["Zutaten/Toppings", "Tomaten"], gurken: ["Zutaten/Toppings", "Gurken"],
  paprika: ["Zutaten/Toppings", "Paprika"], zwiebeln: ["Zutaten/Toppings", "Zwiebeln"], rucola: ["Zutaten/Toppings", "Rucola"],
  nachos: ["Zutaten/Toppings", "Nachos (Doritos® Nacho Cheese)"], guacamole: ["Zutaten/Toppings", "Guacamole"], roestzwiebeln: ["Zutaten/Toppings", "Röstzwiebeln"],
  peperoni_salami: ["Einzel-Zutaten", "Peperoni-Salami"], salami: ["Einzel-Zutaten", "Salami"], tuna: ["Einzel-Zutaten", "Tuna (mit Lite Mayonnaise)"],
  philly_beef: ["Einzel-Zutaten", "Philly Beef"], beef_chili: ["Einzel-Zutaten", "Beef Chili"],
  pulled_chicken_breast: ["Einzel-Zutaten", "Rotisserie-Style Chicken/Pulled Chicken Breast"], chicken_teriyaki: ["Einzel-Zutaten", "Chicken Teriyaki"],
  chicken_fajita: ["Einzel-Zutaten", "Chicken Fajita"], chicken_tandoori: ["Einzel-Zutaten", "Chicken Tandoori"], ham: ["Einzel-Zutaten", "Ham"],
  bbq_rib: ["Einzel-Zutaten", "BBQ Rib"], bacon: ["Einzel-Zutaten", "Bacon"], spicy_vegan_patty: ["Einzel-Zutaten", "Spicy Vegan Patty"],
  pb_chicken_teriyaki: ["Einzel-Zutaten", "Plant-based Chicken Teriyaki"], omelette: ["Einzel-Zutaten", "Omelette"], nacho_chicken: ["Einzel-Zutaten", "Nacho Chicken"],
};
// Veggie Delite® = Sub ohne Protein: eigener Baustein mit 0-Werten (wie im London-Tool; Brot, Veggies, Saucen zählen wie bei jedem Sub)
const NO_PROTEIN = { id: "veggie_delite", name: "Veggie Delite® (kein Protein)", pdfName: null, section: "Create Your Own", note: "Sub ohne Protein-Baustein: 0-Werte (Brot, Käse, Veggies, Saucen werden wie bei jedem Sub gewählt)" };

// Wolt „Create Your Own“: Sub → Protein-Baustein (Einzel-Zutat)
const SUB_MAP = {
  "Beef Chili": "beef_chili", "Chicken Teriyaki": "chicken_teriyaki", "Plant-based Chicken Teriyaki": "pb_chicken_teriyaki", "Chicken Fajita": "chicken_fajita",
  "Chicken Tandoori": "chicken_tandoori", "Pulled Chicken Breast": "pulled_chicken_breast", "Philly Beef & Cheese": "philly_beef", "BBQ Rib": "bbq_rib",
  "Ham": "ham", "Spicy Vegan Patty": "spicy_vegan_patty", "Veggie Delite®": "veggie_delite",
};
const SUB_REMOVED = { "Italian B.M.T.®": "User 16.09.2026: Sub raus (Einzel-Zutaten bleiben für Extras)", "Salami": "User 16.09.2026: Sub raus", "Tuna": "User 16.09.2026: Sub raus (Tuna bleibt als Extra)" };
const SUB_NO_DATA = {
  "BBQ Pulled Pork": "kein Einzel-Baustein „Pulled Pork“ in der Tabelle (nur das fertige Sandwich)",
  "BBQ Pulled Plant": "weder Einzel-Baustein noch Sandwich in der Tabelle",
  "Plant-based Dölicious Chicken (V)": "„Plant-based Döner-Style Chicken“ steht nicht in der Tabelle (nur als Baked Potato)",
  "Nacho Chicken Classic": "„Nacho Chicken“ steht nur je Bite (18 g) in der Tabelle; wie viele Bites ein Sub hat, ist nicht angegeben",
};
// Wolt-Gruppen (Name → id + Art); Reihenfolge = Wolt
const GROUPS = {
  "Brot": { id: "brot", kind: "base" },
  "Zubereitungsart": { id: "zubereitung", kind: "prep" },
  "Käse": { id: "kaese", kind: "side" },
  "Extras": { id: "extras", kind: "extra" },
  "Veggies": { id: "veggies", kind: "extra", own: true, pick: true },
  "Saucen": { id: "saucen", kind: "extra", own: true },
  "Seasonings": { id: "seasonings", kind: "extra", own: true },
};
const NONE = new Set(["ohne Käse", "ohne Veggies", "ohne Saucen", "ohne Seasonings"]);
// Wolt-Option → Baustein (je Gruppe). Unbekannte Optionen brechen den Crawl ab (Tabelle ergänzen, nicht raten).
const OPTION_MAP = {
  brot: { "Cheese Oregano": "cheese_oregano", "Honey Oat": "honey_oat", "Sesam": "sesam", "Vollkorn": "vollkornbrot", "Italian": "italian", "Glutenfrei": "glutenfrei" },
  kaese: { "Scheibenkäse": "scheibenkaese", "Cheddar": "cheddar", "Mozzarella-Emmental-Mix": "mozzarella_emmental_mix" },
  extras: { "Bacon": "bacon", "Chicken Teriyaki": "chicken_teriyaki", "Frischkäse": "frischkaese", "Tuna": "tuna", "Peperoni-Salami": "peperoni_salami", "Ham": "ham" },
  veggies: { "Eisbergsalat": "salat", "Rucola": "rucola", "Tomaten": "tomaten", "Gurken": "gurken", "Rote Paprika": "paprika", "Rote Zwiebeln": "zwiebeln",
    "Schwarze Oliven": "oliven", "Jalapeños": "jalapenos", "Mais": "mais", "Gewürzgurke": "gewuerzgurken" },
  saucen: { "X-spicy Chipotle Southwest": "x_spicy_chipotle", "Chipotle Southwest": "chipotle_southwest", "Sweet Onion": "sweet_onion", "Caesar": "caesar_sauce",
    "Joghurt": "joghurt", "Lite Mayonnaise": "lite_mayonnaise", "Balsamico Essig": "balsamic_vinegar", "Olivenöl": "olivenoel",
    "Honey & Wholegrain Mustard": "honey_wholegrain_mustard", "Garlic & Herb (Vegan)": "garlic_herb", "BBQ Sauce (vegan)": "bbq_sauce", "Ketchup": "ketchup" },
  seasonings: { "Röstzwiebeln": "roestzwiebeln" },
};
const EXTRA_PROTEIN = "Extra Fleisch / Protein"; // = eine weitere Portion der Sub-Einzelzutat (Variante des Subs)
// Nie vorschlagen (User 16.09.2026): Käse nur in der Gruppe „Käse“, dort nie Frischkäse und Vegan Cheese
const NEVER = {
  kaese: { "Frischkäse": "User 16.09.2026: in der Käse-Gruppe nie", "Vegan Cheese": "User 16.09.2026: in der Käse-Gruppe nie" },
  extras: { "Extra Käse": "User 16.09.2026: nie", "Cheddar": "User 16.09.2026: nie (Käse nur über die Gruppe „Käse“)", "Doritos Nacho Cheese": "User 16.09.2026: nie",
    "Mozzarella-Emmental-Mix": "User 16.09.2026: nie (Käse nur über die Gruppe „Käse“)" },
};
// Wolt-Optionen ohne offizielle Werte → nie im Rechner, nur dokumentiert (keine Schätzungen)
const NO_DATA = {
  extras: { "Sour Cream": "steht nicht in der Tabelle (nur „Sour Cream Baked Potato“)", "Pulled Pork": "kein Einzel-Baustein in der Tabelle", "Pulled Plant": "nicht in der Tabelle" },
  seasonings: { "Meersalz": "nicht in der Tabelle", "Pfefferkörner": "nicht in der Tabelle" },
};
// Extras, die „No sauce“ mit ausblendet (User 16.09.2026: „auch Sour Cream und Frischkäse“)
const SAUCE_LIKE = new Set(["frischkaese"]);
// Gesperrt (bleibt im Datensatz, nie im Rechner) — Rückfrage an den User offen
const BLOCKED = {
  garlic_herb: "Portion (14 g: 22 kcal, 0,19 g Fett, 4,9 g KH) passt nicht zu je 100 g (570 kcal, 60 g Fett → 80 kcal je 14 g); KH/Zucker je Portion = BBQ Sauce → Portionszeile vermutlich fehlerhaft. Gesperrt bis zur Entscheidung des Users",
};
// Standard-Veggies (User 16.09.2026): Eisbergsalat, Tomaten, Rote Paprika, Rote Zwiebeln, Mais
const STD_VEGGIES = ["salat", "tomaten", "paprika", "zwiebeln", "mais"];

const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const euro = cents => U.round(cents / 100, 2);
// Wolt liefert neue Artikel („What's New“, z.B. Beef Chili) nur an Clients mit Versionsangabe aus — ohne diese Header fehlen sie in der
// Antwort (am 16.09.2026 im Browser nachvollzogen: gleiche Anfrage mit client-version → Artikel da)
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function getJSON(url) {
  const r = await fetch(url, { headers: WOLT_HEADERS });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return r.json();
}

// Nährwerttabelle: Zeilen „Name Serviergröße kJ kcal Fett gesFett KH Zucker Ballaststoffe Eiweiß Salz 100 kJ kcal …“ (20 Zahlen, Dezimalpunkt)
const COLS = ["kj", "kcal", "fat", "sat", "carbs", "sugars", "fibre", "protein", "salt"];
function parseNutrition(problems) {
  const rows = [];
  let page = 0, section = null;
  for (const raw of fs.readFileSync(NUTRI, "utf8").split(/\r?\n/)) {
    const line = normName(raw);
    const pm = line.match(/^=== SEITE (\d+) ===$/);
    if (pm) { page = +pm[1]; continue; }
    if (SECTIONS.includes(line)) { section = line; continue; }
    const m = line.match(/^(.*?)\s+((?:\d+(?:\.\d+)?\s+){19}\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const v = m[2].split(" ").map(Number);
    if (!section) { problems.push("Tabelle: Zeile ohne Abschnitt: " + line); continue; }
    if (v[10] !== 100) { problems.push("Tabelle: Zeile „" + m[1] + "“ ohne „100“ an Position 11"); continue; }
    rows.push({ page, section, name: m[1], weightG: v[0], perPortion: Object.fromEntries(COLS.map((k, i) => [k, v[1 + i]])), per100: Object.fromEntries(COLS.map((k, i) => [k, v[11 + i]])) });
  }
  return rows;
}
const macros = o => Object.fromEntries(U.KEYS.map(k => [k, o[k]]));

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];

  // ── Nährwerttabelle: alle Produkte + Sub-Bausteine ──
  const rows = parseNutrition(problems);
  for (const s of SECTIONS) if (!rows.some(r => r.section === s)) problems.push("Tabelle: Abschnitt „" + s + "“ ohne Zeilen");
  const products = rows.map(r => ({ section: r.section, name: r.name, page: r.page, weightG: r.weightG, kj: { perPortion: r.perPortion.kj, per100: r.per100.kj }, perPortion: macros(r.perPortion), per100: macros(r.per100) }));
  for (const p of products) {
    const a = U.checkItem(p.perPortion), b = U.checkItem(p.per100);
    const issues = [...a.map(x => "je Portion: " + x), ...b.map(x => "je 100 g: " + x)];
    if (issues.length) anomalies.push({ section: p.section, name: p.name, issues });
  }
  const ingredients = [];
  for (const [id, [section, name]] of Object.entries(COMPONENTS)) {
    const hits = products.filter(p => p.section === section && p.name === name);
    if (hits.length !== 1) { problems.push("Tabelle: „" + section + " / " + name + "“ " + hits.length + "× gefunden (erwartet 1)"); continue; }
    const p = hits[0];
    const ing = { id, name: p.name, pdfName: p.name, section, page: p.page, portionG: p.weightG, kj: p.kj, per100: p.per100, perPortion: p.perPortion };
    if (BLOCKED[id]) { ing.blocked = true; ing.blockedReason = BLOCKED[id]; }
    ingredients.push(ing);
    // Portion ≠ je 100 g × Serviergröße (über die Rundung der Tabelle hinaus) → dokumentieren
    const off = U.KEYS.filter(k => Math.abs(p.per100[k] * p.weightG / 100 - p.perPortion[k]) > Math.max(k === "kcal" ? 1.5 : 0.3, 0.08 * Math.max(p.perPortion[k], p.per100[k] * p.weightG / 100)));
    if (off.length) {
      const txt = "je Portion passt nicht zu je 100 g × " + p.weightG + " g bei " + off.map(k => k + " (" + p.perPortion[k] + " statt " + U.round(p.per100[k] * p.weightG / 100, 2) + ")").join(", ");
      const known = anomalies.find(a => a.section === section && a.name === name);
      if (known) known.issues.push(txt); else anomalies.push({ section, name, issues: [txt] });
    }
  }
  const zero = Object.fromEntries(U.KEYS.map(k => [k, 0]));
  ingredients.push(Object.assign({}, NO_PROTEIN, { page: null, portionG: 0, kj: { perPortion: 0, per100: 0 }, per100: zero, perPortion: zero }));
  const byId = Object.fromEntries(ingredients.map(x => [x.id, x]));

  // ── Wolt „Create Your Own“ (Frankfurt Zeil) ──
  const assort = async slug => { const j = await getJSON(WOLT_API(slug)); await sleep(1200); return j; };
  const cyoItems = j => {
    const cat = (j.categories || []).find(c => normName(c.name) === CATEGORY);
    if (!cat) return null;
    const byItem = Object.fromEntries((j.items || []).map(i => [i.id, i])), byOpt = Object.fromEntries((j.options || []).map(o => [o.id, o]));
    return cat.item_ids.map(id => {
      const it = byItem[id];
      if (!it) return { id, missing: true };
      const refs = it.options || [];
      const sizeRef = refs.find(r => /^Deine Größe/.test(normName(r.name)));
      const sizeG = sizeRef ? byOpt[sizeRef.option_id] : null;
      const sizes = {};
      for (const v of (sizeG && sizeG.values) || []) sizes[/FOOTLONG/.test(v.name) ? "footlong" : /15-CM/.test(v.name) ? "small" : "?"] = { id: v.id, name: normName(v.name), price: v.price };
      const groups = { small: [], footlong: [] };
      for (const ref of refs) {
        if (ref === sizeRef) continue;
        const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
        const pre = ref.prerequisite_values || [];
        const size = Object.keys(sizes).find(k => pre.includes(sizes[k].id));
        if (!size || !groups[size]) return { id, name: normName(it.name), broken: "Gruppe „" + normName(ref.name) + "“ ohne Größe" };
        groups[size].push({ name: normName(ref.name), min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1,
          values: (g.values || []).map(v => ({ name: normName(v.name), price: v.price, max: v.multi_choice_config && v.multi_choice_config.total_range ? v.multi_choice_config.total_range.max : 1 })) });
      }
      return { id, name: normName(it.name), price: it.price, disabled: !!it.disabled_info, description: normName(it.description), sizeGroup: sizeRef ? normName(sizeRef.name) : null, sizes, groups };
    });
  };
  const prim = await assort(PRIMARY);
  const items = cyoItems(prim);
  if (!items) { problems.push("Wolt (" + PRIMARY + "): Kategorie „" + CATEGORY + "“ fehlt"); }
  const removed = [], noData = [], mapped = new Set(), skipped = new Map(); // skipped: „Gruppe|Option“ → { kind, why, prices }
  const sizesOut = { small: { label: "15-CM", factor: 1, subs: [], groups: [] }, footlong: { label: "FOOTLONG (30-CM)", factor: 2, subs: [], groups: [] } };
  for (const it of items || []) {
    if (it.missing) { problems.push("Wolt: Artikel " + it.id + " fehlt in der Antwort (Client-Header prüfen)"); continue; }
    if (it.broken) { problems.push("Wolt: " + it.name + ": " + it.broken); continue; }
    if (SUB_REMOVED[it.name]) { removed.push(it.name + " (" + euro(it.price) + " €) — " + SUB_REMOVED[it.name]); continue; }
    if (SUB_NO_DATA[it.name]) { noData.push("Sub „" + it.name + "“ (" + euro(it.price) + " €) — " + SUB_NO_DATA[it.name]); continue; }
    const ingId = SUB_MAP[it.name];
    if (!ingId || !byId[ingId]) { problems.push("Wolt: unbekanntes Sub „" + it.name + "“ (SUB_MAP ergänzen)"); continue; }
    if (it.disabled) problems.push("Wolt: Sub „" + it.name + "“ ist deaktiviert");
    mapped.add(ingId);
    for (const size of ["small", "footlong"]) {
      const S = sizesOut[size], sz = it.sizes[size];
      if (!sz) { problems.push("Wolt: " + it.name + " ohne Größe " + size); continue; }
      const sub = { name: it.name, ingredient: ingId, itemPrice: euro(it.price), sizeName: sz.name, sizePrice: euro(sz.price), price: euro(it.price + sz.price), extraProtein: null, groupMin: {}, groupMax: {}, none: {} };
      const seen = new Set();
      for (const g of it.groups[size]) {
        const def = GROUPS[g.name];
        if (!def) { problems.push("Wolt: unbekannte Gruppe „" + g.name + "“ (" + it.name + ")"); continue; }
        seen.add(def.id);
        sub.groupMin[def.id] = g.min; sub.groupMax[def.id] = g.max;
        let grp = S.groups.find(x => x.id === def.id);
        if (!grp) { grp = { id: def.id, name: g.name, kind: def.kind, own: !!def.own, pick: !!def.pick, none: null, values: null, options: [] }; if (def.kind === "prep") grp.choices = g.values.map(v => v.name); S.groups.push(grp); }
        const vals = [];
        for (const v of g.values) {
          if (NONE.has(v.name)) { sub.none[def.id] = v.name; grp.none = v.name; continue; }
          if (def.id === "extras" && v.name === EXTRA_PROTEIN) { sub.extraProtein = { name: v.name, price: euro(v.price) }; continue; }
          vals.push(v.name + "=" + v.price + "/" + v.max);
          if (def.kind === "prep") continue;
          const nev = (NEVER[def.id] || {})[v.name], nod = (NO_DATA[def.id] || {})[v.name];
          if (nev || nod) {
            const k = g.name + "|" + v.name, e = skipped.get(k) || { kind: nev ? "never" : "noData", text: g.name + ": „" + v.name + "“", why: nev || nod, prices: {} };
            e.prices[size] = euro(v.price);
            skipped.set(k, e);
            continue;
          }
          const ing = (OPTION_MAP[def.id] || {})[v.name];
          if (!ing || !byId[ing]) { problems.push("Wolt: nicht zugeordnete Option „" + v.name + "“ in „" + g.name + "“ (OPTION_MAP ergänzen)"); continue; }
          mapped.add(ing);
          if (!grp.options.some(o => o.name === v.name)) {
            const o = { name: v.name, ingredient: ing, role: def.kind, maxQty: Math.max(1, v.max || 1), price: euro(v.price) };
            if (def.pick) o.pick = true;
            if (SAUCE_LIKE.has(ing)) o.sauce = true;
            grp.options.push(o);
          }
        }
        // Optionen und Preise müssen bei allen Subs gleich sein (sonst stimmt das gemeinsame Menü nicht)
        const sig = vals.join(",");
        if (grp.values == null) grp.values = sig;
        else if (grp.values !== sig) problems.push("Wolt: „" + g.name + "“ (" + size + ") weicht bei „" + it.name + "“ ab: " + sig + " statt " + grp.values);
      }
      for (const gid of Object.values(GROUPS).map(d => d.id)) if (!seen.has(gid)) problems.push("Wolt: " + it.name + " (" + size + ") ohne Gruppe " + gid);
      if (ingId !== "veggie_delite" && !sub.extraProtein) problems.push("Wolt: " + it.name + " (" + size + ") ohne „" + EXTRA_PROTEIN + "“");
      S.subs.push(sub);
    }
  }
  for (const S of Object.values(sizesOut)) for (const g of S.groups) {
    g.min = Math.min(...S.subs.map(s => s.groupMin[g.id]));
    g.max = Math.max(...S.subs.map(s => s.groupMax[g.id]));
    delete g.values;
  }
  const never = [];
  for (const e of skipped.values()) (e.kind === "never" ? never : noData).push(e.text + " (15-CM " + e.prices.small + " € / Footlong " + e.prices.footlong + " €) — " + e.why);
  // Menü laut User-Liste vom 16.09.2026 (Preise der Subs) — Abweichungen melden
  const USER_PRICES = { "Beef Chili": 9.79, "BBQ Pulled Pork": 9.29, "BBQ Pulled Plant": 9.29, "Plant-based Dölicious Chicken (V)": 8.39, "Chicken Teriyaki": 8.99, "Plant-based Chicken Teriyaki": 8.99,
    "Chicken Fajita": 8.99, "Tuna": 8.39, "Chicken Tandoori": 8.99, "Pulled Chicken Breast": 9.29, "Philly Beef & Cheese": 9.29, "BBQ Rib": 8.99, "Italian B.M.T.®": 8.39, "Ham": 7.59,
    "Salami": 7.59, "Spicy Vegan Patty": 8.39, "Veggie Delite®": 6.49, "Nacho Chicken Classic": 8.19 };
  const userDiffs = [];
  for (const [n, p] of Object.entries(USER_PRICES)) { const it = (items || []).find(i => i.name === n); if (!it || it.missing) userDiffs.push(n + " fehlt bei Wolt"); else if (euro(it.price) !== p) userDiffs.push(n + ": Wolt " + euro(it.price) + " € statt " + p + " €"); }
  if ((items || []).length !== Object.keys(USER_PRICES).length) userDiffs.push("Wolt hat " + (items || []).length + " statt " + Object.keys(USER_PRICES).length + " Create-Your-Own-Subs");

  // Vergleich mit den übrigen Frankfurter Filialen (nur dokumentiert)
  const venues = {};
  for (const slug of COMPARE) {
    let j;
    try { j = await assort(slug); } catch (e) { venues[slug] = "Abruf fehlgeschlagen: " + e.message; continue; }
    const its = cyoItems(j);
    if (!its) { venues[slug] = "keine Kategorie „" + CATEGORY + "“"; continue; }
    const notes = [];
    for (const it of its) {
      if (it.missing) { notes.push("Artikel " + it.id + " fehlt"); continue; }
      const p = (items || []).find(x => x.name === it.name);
      if (!p) notes.push(it.name + " nur hier");
      else if (p.price !== it.price) notes.push(it.name + " " + euro(it.price) + " € (Zeil " + euro(p.price) + " €)");
    }
    venues[slug] = notes.length ? notes.join(" · ") : "Preise identisch";
  }

  const components = ingredients.filter(x => x.pdfName);
  const notInTracker = components.filter(x => !mapped.has(x.id)).map(x => x.section + ": " + x.pdfName);
  const out = {
    _meta: {
      restaurant: "Subway", fetchedAt,
      sources: {
        nutrition: { file: "data/subway-naehrwerte.txt", pdf: "Kopie von Germany Nutritional Information Full Menu C4 2026.pdf (vom User bereitgestellt, 16.09.2026)", stand: "Nährwertinformationen September 2026 (Deutschland), PDF erstellt 07.08.2026" },
        wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY), category: CATEGORY },
      },
      basis: "Offizielle Werte PRO PORTION (15 cm). Footlong = alle Werte ×2 (PDF: „ein Footlong = zwei 15-cm-Portionen“, ausgenommen Salat-Gerichte), auch Käse, Extras, Veggies, Saucen und Seasonings.",
      rules: "Ein Sub = genau ein Create-Your-Own-Artikel (Protein-Baustein) + genau ein Brot, Käse 0–1, Extras je 1× (Wolt bis 15), Veggies je 1×, Saucen bis 2 (15-CM) bzw. 3 (Footlong; Plant-based Chicken Teriyaki nur 2), Seasonings bis 3. Zubereitungsart (getoastet/ungetoastet) ohne Einfluss auf die Nährwerte. Preis = Artikelpreis + Größe + Optionen (Glutenfrei, Extras).",
      decisions: [
        "User 16.09.2026: Subway (Wolt) als Tracker aus „Create Your Own“: Sub → Brot → Käse → Extras → Veggies → Saucen → Seasonings; zwei Größen „15-CM“ / „Footlong“ (Footlong = Werte ×2, gilt auch für die Toppings)",
        "User 16.09.2026: Schalter „No sauce“ (Default AN; blendet auch Frischkäse und Sour Cream bei den Extras aus) und „No cheese“ (Default AN)",
        "User 16.09.2026: Schalter „Standard veggies“ = Eisbergsalat, Tomaten, Rote Paprika, Rote Zwiebeln, Mais",
        "User 16.09.2026: Extras nie: Extra Käse, Cheddar, Doritos Nacho Cheese, Mozzarella-Emmental-Mix; Käse nur über die Gruppe „Käse“, dort nie Frischkäse und Vegan Cheese",
        "User 16.09.2026: Subs „Italian B.M.T.®“, „Salami“ und „Tuna“ raus — die Einzel-Zutaten bleiben (Extras)",
        "User 16.09.2026: Brot und Sub als Mehrfachauswahl wie im London-Tool („Bread / Protein sub (pick one or more — optimizer chooses the best)“)",
        "User 16.09.2026: Produkte außerhalb des Sub-Baus (Wraps, Salate, Baked Potatoes, Beilagen, Getränke, Cookies …) nur im Datensatz, nicht im Tracker",
      ],
      assumptions: [
        "„Standard veggies“ startet AN: Veggies wählt der Optimizer nie selbst (sonst viele fast gleiche Ergebnisse); ohne den Schalter nur die über „Must include“ gewählten Veggies",
        "„Extra Fleisch / Protein“ = eine weitere Portion des Sub-Bausteins (Tabelle nennt je Zutat nur eine Portion); bei Veggie Delite® nicht angeboten",
        "Extras Bacon, Chicken Teriyaki, Tuna, Peperoni-Salami, Ham = je eine Portion laut „Einzel-Zutaten“; Frischkäse = Portion laut „Käse“",
        "Doppeltes Fleisch bei Ham bzw. Chicken Teriyaki nur über „Extra Fleisch / Protein“: das gleichnamige Extra wird bei diesem Sub nicht vorgeschlagen (gleiche Werte → sonst Doppel-Ergebnisse)",
        "Veggie Delite® = Sub ohne Protein-Baustein (0-Werte) wie im London-Tool",
      ],
      mapping: Object.assign({}, Object.fromEntries(Object.entries(SUB_MAP).map(([w, id]) => ["Sub " + w, byId[id] ? (byId[id].pdfName || byId[id].name) : id])),
        ...Object.entries(OPTION_MAP).map(([g, m]) => Object.fromEntries(Object.entries(m).map(([w, id]) => [g + ": " + w, byId[id] ? byId[id].pdfName : id])))),
      stdVeggies: STD_VEGGIES,
      removed, noData, never, blocked: Object.entries(BLOCKED).map(([id, why]) => (byId[id] ? byId[id].pdfName : id) + ": " + why),
      notInTracker, userPrices: userDiffs.length ? userDiffs : "alle 18 Preise wie in der Liste des Users", venues, anomalies,
      shellfish: "Keine Allergenliste ausgewertet; kein Produkt- oder Zutatenname mit Krebs-/Weichtieren (Tuna = Fisch, erlaubt)",
      dislikes: "Koriander/Minze: kein Baustein mit Koriander oder Minze im Namen; Zutatenlisten liegen nicht vor",
    },
    ingredients,
    products,
    wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), category: CATEGORY, small: sizesOut.small, footlong: sizesOut.footlong },
  };
  for (const id of STD_VEGGIES) if (!sizesOut.small.groups.some(g => g.id === "veggies" && g.options.some(o => o.ingredient === id))) problems.push("Standard-Veggie " + id + " fehlt bei Wolt");
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(products.length + " Tabellenzeilen, " + ingredients.length + " Sub-Bausteine → " + path.relative(__dirname, OUT));
  for (const size of ["small", "footlong"]) {
    const S = sizesOut[size];
    console.log("\nWolt " + S.label + ": " + S.subs.length + " Subs (" + S.subs.map(s => s.name + " " + s.price + " €" + (s.extraProtein ? " / +" + s.extraProtein.price : "")).join(" · ") + ")");
    console.log("  " + S.groups.map(g => g.name + " [" + g.min + "–" + g.max + "] " + (g.kind === "prep" ? g.choices.join("/") : g.options.length + " Optionen") + (g.none ? " + „" + g.none + "“" : "")).join(" · "));
    const capDiff = S.subs.filter(s => Object.entries(s.groupMax).some(([g, m]) => m < S.groups.find(x => x.id === g).max)).map(s => s.name + " " + JSON.stringify(s.groupMax));
    if (capDiff.length) console.log("  kleinere Grenzen: " + capDiff.join(" · "));
  }
  console.log("\nRaus (User): " + removed.join(" · "));
  console.log("Ohne offizielle Werte: " + noData.join(" · "));
  console.log("Nie (User): " + never.join(" · "));
  console.log("Gesperrt: " + out._meta.blocked.join(" · "));
  console.log("Nicht im Tracker: " + notInTracker.join(", "));
  console.log("User-Preise: " + (Array.isArray(out._meta.userPrices) ? out._meta.userPrices.join(" · ") : out._meta.userPrices));
  console.log("Filialen: " + Object.entries(venues).map(([s, n]) => s + ": " + n).join("\n          "));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.section + " / " + a.name + ": " + a.issues.join("; ")).join("\n  "));
}
main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
