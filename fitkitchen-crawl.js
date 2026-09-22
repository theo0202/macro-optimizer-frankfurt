// Fit Kitchen Frankfurt (Wolt) → data/fitkitchen-raw.json: node fitkitchen-crawl.js
// Quellen (User 22.09.2026):
//   · Speisekarte von fit-kitchen.de (die Nährwerte stehen dort nur in Bildern) → von den Screenshots des Users in
//     data/fitkitchen-menu.json übertragen, Seite „Burger“ im Browser gegen die Website geprüft. Je Gericht nur kcal,
//     Kohlenhydrate, Fett, Eiweiß; Soßen je 30 mL
//   · Wolt-API (Venue „fit-kitchen“, Client-Version-Header): welche Gerichte bestellbar sind, Namen, Kategorien, Preise, Optionen
// Nur was es bei Wolt gibt, kommt in den Tracker (User 22.09.2026). Wolt-Artikel ohne Werte auf der Karte → _meta.noData.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "fitkitchen-raw.json");
const MENU = path.join(__dirname, "data", "fitkitchen-menu.json");
const SLUG = "fit-kitchen";
const WOLT_API = "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + SLUG + "/assortment?language=de";
const WOLT_PAGE = "https://wolt.com/de/deu/frankfurt/restaurant/" + SLUG;
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };

// Wolt-Kategorie (ohne Emojis, großgeschrieben) → Tracker-Kategorie. Reihenfolge = Reihenfolge der Chips (wie bei Wolt)
const CATS = [
  { wolt: "BURGER", id: "burger", name: "Burger" },
  { wolt: "SALATE", id: "salads", name: "Salate" },
  { wolt: "BEILAGEN", id: "sides", name: "Beilagen" },
  { wolt: "PIZZA", id: "pizza", name: "Pizza" },
  { wolt: "WRAPS", id: "wraps", name: "Wraps" },          // am 22.09.2026 erst beim zweiten Abruf in der Wolt-API (ganztägig, nicht deaktiviert)
  { wolt: "DESSERTS", id: "desserts", name: "Desserts" }, // (noch) nicht bei Wolt — die Karte hat Werte
  { wolt: "DIPS", id: "dips", name: "Dips" },
];
// Duplikate bzw. kein Essen
const SKIPPED_CATS = { "WOLT SPECIAL": "Duplikate (Pizza Margherita, Süßkartoffeln, Chicken Mozzarella Burger)", "BESTECK": "kein Essen (Besteck)",
  "ALKOHOLFREIE GETRÄNKE": "Getränke — wie bei den anderen Restaurants nicht im Tracker, die Karte nennt dafür auch keine Werte" };

// Wolt-Name → Eintrag der Karte („Abschnitt/Name“). Unterschiedliche Schreibweisen der Plattform, gleiche Gerichte
const WOLT_TO_MENU = {
  "Classic Burger": "burger/Classic",
  "Chili Cheese Burger": "burger/Chili-Cheese",
  "Chicken Mozzarella Burger": "burger/Chicken-Mozzarlla",        // so (mit Tippfehler) auf der Karte
  "Veggie Burger": "burger/Veggie",
  "Veganer Burger": "burger/Veganer Burger",
  "Mango Cheese Beef Burger": "burger/Mango-Cheese-Beef",
  "Avocado Chicken Burger": "burger/Avocado-Chicken",
  "BBQ Burger": "burger/Barbecue",
  "Hackfleisch Wrap": "wraps/Hackfleisch Wrap",
  "Hähnchen Wrap": "wraps/Hähnchen Wrap",
  "Falafel Wrap": "wraps/Falafel Wrap",
  "Mango Beef Wrap": "wraps/Mango-Beef Wrap",
  "Avocado Chicken Wrap": "wraps/Avocado-Chicken Wrap",
  "Pizza Margherita": "pizza/Margherita",
  "Pizza Salami Putenschinken Champignons": "pizza/Salami-Putenschinken-Champignon",
  "Pizza Veggie Rucola": "pizza/Veggie-Rucola",
  "Pizza Chicken": "pizza/Chicken",
  "Pizza Beef": "pizza/Beef",
  "Pizza Sucuk Jalapenos": "pizza/Sucuk-Jalapeños",
  "Coleslaw": "sides/Coleslaw",
  "Mayonnaise": "dips/Mayonnaise",
  "Ketchup": "dips/Ketchup",
  "Avocado Dip": "sauces/Avocado",
  "BBQ Dip": "sauces/BBQ",
  "Chili Cheese Dip": "sauces/Chili-Cheese",
  "Curry Mayonnaise Dip": "sauces/Curry",   // Annahme: die einzige Curry-Soße der Karte (auch im Chicken Mozzarella Burger) — dem User genannt
  "Mango Dip": "sauces/Mango",
};
// Wolt-Artikel ohne veröffentlichte Werte (bleiben draußen, _meta.noData)
const NO_DATA = {
  "Hähnchenbrust Champignons Salat": "die Karte nennt für die Salate keine Nährwerte",
  "Falafel Salat": "die Karte nennt für die Salate keine Nährwerte",
  "Gemischter Salat": "die Karte nennt keine Nährwerte",
  "Heißluft frittierte Süßkartoffeln": "die Karte nennt keine Nährwerte",
  "Heißluft frittierte Pommes": "die Karte nennt keine Nährwerte",
  "Starter": "die Karte nennt keine Nährwerte (3 kleine Brötchen mit Kräuterbutter)",
  "Chili Cheese Fries": "die Karte nennt keine Nährwerte",
  "Classic Dip": "die Soßen-Tabelle der Karte hat keine Zeile für die Classic-Soße",
};
const SAUCE_CAT = "dips";
const HERB_RE = /koriander|cilantro|minze|\bmint\b/i;
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebs|hummer|lobster|langust|muschel|mussel|auster|oyster|tintenfisch|calamar|squid|sepia|oktopus|octopus|meeresfr/i;
const SHELLFISH_CODES = new Set(["b", "i"]);   // Legende der Karte: b) Krebstiere, i) Weichtiere

const clean = s => String(s || "").replace(/[^\p{L}\p{N}& ]/gu, " ").replace(/\s+/g, " ").trim().toUpperCase();

async function main() {
  const problems = [], anomalies = [], noData = [], coriander = [], shellfish = [], priceDiffs = [], mapping = [], preselected = [];
  const menu = U.readJSON(MENU);
  const byKey = {};
  for (const sec of menu.sections) for (const it of sec.items) {
    const key = sec.id + "/" + it.name;
    if (byKey[key]) problems.push("Karte: " + key + " doppelt");
    for (const k of ["kcal", "carbs", "fat", "protein"]) if (typeof it[k] !== "number" || !(it[k] >= 0)) problems.push("Karte: " + key + " ohne " + k);
    byKey[key] = { ...it, section: sec.id };
  }

  const res = await fetch(WOLT_API, { headers: WOLT_HEADERS });
  if (!res.ok) throw new Error("Wolt-API: HTTP " + res.status);
  const a = await res.json();
  const itemsById = Object.fromEntries((a.items || []).map(i => [i.id, i]));
  const optById = Object.fromEntries((a.options || []).map(o => [o.id, o]));
  const cats = [], items = [], seen = new Set(), usedMenu = new Set(), woltCats = [];
  for (const c of a.categories || []) {
    const wname = clean(c.name);
    woltCats.push(wname);
    if (SKIPPED_CATS[wname]) continue;
    const cat = CATS.find(x => x.wolt === wname);
    if (!cat) { problems.push("Unbekannte Wolt-Kategorie „" + c.name + "“ (CATS ergänzen)"); continue; }
    if (!cats.some(x => x.id === cat.id)) cats.push({ id: cat.id, name: cat.name, wolt: c.name });
    for (const iid of c.item_ids || []) {
      const w = itemsById[iid];
      if (!w) { problems.push("Kategorie „" + c.name + "“: Artikel " + iid + " ohne Daten (Client-Version-Header?)"); continue; }
      if (seen.has(w.name)) continue;
      seen.add(w.name);
      const price = U.round(w.price / 100, 2);
      // Optionsgruppen: alle optional? Vorauswahl mit Aufpreis würde den Wolt-Kartenpreis verändern
      const options = (w.options || []).map(o => {
        const def = optById[o.option_id] || o;
        const range = (o.multi_choice_config || def.multi_choice_config || {}).total_range || {};
        const values = (def.values || o.values || []);
        const dflt = o.default_value != null ? o.default_value : def.default_value;
        return { name: (o.name || def.name || "").trim(), min: range.min || 0, max: range.max, defaults: dflt ? [].concat(dflt).map(v => (values.find(x => x.id === v) || {}).name || v) : [] };
      });
      for (const o of options) {
        if (o.min > 0) problems.push(w.name + ": Pflicht-Gruppe „" + o.name + "“ (min " + o.min + ") — im Tracker nicht vorgesehen");
        if (o.defaults.length) preselected.push(w.name + ": „" + o.name + "“ vorausgewählt: " + o.defaults.join(", "));
      }
      const item = { name: w.name, cat: cat.id, price, description: (w.description || "").trim(), options };
      if (NO_DATA[w.name]) { noData.push(w.name + " (" + cat.name + ", " + price.toFixed(2) + " €) — " + NO_DATA[w.name]); item.noData = NO_DATA[w.name]; items.push(item); continue; }
      const mk = WOLT_TO_MENU[w.name];
      if (!mk) { problems.push("Wolt-Artikel ohne Zuordnung: „" + w.name + "“ (" + c.name + ") — WOLT_TO_MENU oder NO_DATA ergänzen"); continue; }
      const m = byKey[mk];
      if (!m) { problems.push(w.name + ": Karten-Eintrag „" + mk + "“ fehlt"); continue; }
      usedMenu.add(mk);
      item.menu = mk;
      item.menuName = m.name;
      item.values = { kcal: m.kcal, carbs: m.carbs, fat: m.fat, protein: m.protein };
      item.codes = m.codes;
      if (m.portion) item.portion = m.portion;
      if (cat.id === SAUCE_CAT) item.sauce = true;
      if (m.price != null && Math.abs(m.price - price) > 0.001) priceDiffs.push(w.name + ": Karte " + m.price.toFixed(2) + " € · Wolt " + price.toFixed(2) + " €");
      if (w.name.replace(/[- ]/g, "").toLowerCase() !== m.name.replace(/[- ]/g, "").toLowerCase()) mapping.push(w.name + " = " + m.name + (mk === "sauces/Curry" ? " (Annahme: einzige Curry-Soße der Karte)" : ""));
      const codes = String(m.codes || "").split(/[,\s]+/).filter(Boolean);
      if (codes.some(x => SHELLFISH_CODES.has(x)) || SHELLFISH_RE.test(w.name + " " + m.name + " " + (m.description || "") + " " + item.description)) { item.shellfish = true; shellfish.push(w.name); }
      const herbs = (m.description || "") + " " + item.description;
      if (HERB_RE.test(herbs)) coriander.push(w.name + " (" + herbs.match(HERB_RE)[0] + ")");
      const issues = U.checkItem({ kcal: m.kcal, fat: m.fat, sat: 0, carbs: m.carbs, sugars: 0, fibre: 0, protein: m.protein, salt: 0 });
      if (issues.length) anomalies.push({ name: w.name, issues });
      items.push(item);
    }
  }
  for (const k of Object.keys(WOLT_TO_MENU)) if (!seen.has(k)) problems.push("WOLT_TO_MENU: „" + k + "“ gibt es bei Wolt nicht mehr");
  const notOnWolt = Object.keys(byKey).filter(k => !usedMenu.has(k) && !/^sauces\/Tahine$/.test(k)).map(k => k.replace("/", ": "));

  const out = {
    _meta: {
      source: "Speisekarte fit-kitchen.de (Nährwerte je Gericht, als data/fitkitchen-menu.json aus den Screenshots des Users übertragen) + Wolt-API Venue „" + SLUG + "“ (Namen, Kategorien, Preise)",
      menu: { file: "data/fitkitchen-menu.json", url: menu._meta.url, capturedAt: menu._meta.capturedAt, check: "Seite 05 (Burger) am 22.09.2026 im Browser mit der Website verglichen: identisch" },
      fetchedAt: new Date().toISOString(),
      basis: "Offizielle Werte je Gericht laut Speisekarte (Standard-Zusammenstellung, Soßen der Gerichte sind enthalten). Fit Kitchen nennt nur Kalorien, Kohlenhydrate, Fett und Eiweiß → gesättigte Fettsäuren, Zucker, Ballaststoffe und Salz = 0. Dips je 30 mL laut Soßen-Tabelle",
      notDeclared: ["sat", "sugars", "fibre", "salt"],
      rules: [
        "Nur Artikel, die es bei Wolt gibt; Namen und Preise wie bei Wolt (die Karte hat andere Restaurant-Preise)",
        "Wolt-Optionen (Extra Soße, Extras, Extra Patty, Deine Soße, Tahine) sind optional und haben keine Nährwerte → nicht im Optimizer",
      ],
      decisions: [
        "User 22.09.2026: Fit Kitchen (Wolt) als Tracker mit Kategorien; Produkte und Nährwerte laut Speisekarte, nur was es bei Wolt gibt",
        "User 22.09.2026: Schalter „No sauces“ (Default AN) — betrifft die Dips; Soßen, die schon im Gericht stecken, bleiben natürlich",
        "User 22.09.2026: Schalter „No desserts“ — Wolt führt keine Desserts, der Schalter erscheint erst, wenn Fit Kitchen dort Desserts anbietet",
      ],
      venue: { slug: SLUG, page: WOLT_PAGE, categories: woltCats },
      skippedCategories: SKIPPED_CATS,
      mapping,
      priceDiffs,
      // Die Wolt-API nennt für die optionalen Gruppen (min 0) ein default_value — wie bei Compleat und Lorys ist das KEINE Vorauswahl:
      // die Wolt-Karte zeigt genau den Artikelpreis (Liste des Users 22.09.2026, z.B. Classic Burger 8,20 € = API-Preis)
      optionDefaults: { note: "default_value optionaler Gruppen, im Wolt-Bestellfenster nicht vorausgewählt (Kartenpreis = Artikelpreis)", list: preselected },
      noData,
      notOnWolt,
      legend: menu._meta.legend,
      shellfish: shellfish.length ? shellfish : "kein Gericht mit b) Krebstiere oder i) Weichtiere laut Legende der Karte, keins mit Krebs-/Weichtier im Namen",
      coriander: coriander.length ? coriander : "keine Beschreibung nennt Koriander oder Minze (Tomatensoße „mit Kräutern“ und Joghurt-Kräuter-Soße ohne Angabe der Kräuter)",
      anomalies,
    },
    wolt: { slug: SLUG, page: WOLT_PAGE, cats, items },
    menu: menu.sections,
  };
  if (problems.length) { console.error("PROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  const withData = items.filter(x => !x.noData);
  console.log(withData.length + " Wolt-Artikel mit Werten (von " + items.length + ") → " + path.relative(__dirname, OUT));
  for (const c of cats) {
    const list = withData.filter(x => x.cat === c.id);
    console.log("  " + c.name + " (" + list.length + "): " + list.map(x => x.name + " " + x.values.kcal + " kcal / P " + x.values.protein + " · " + x.price.toFixed(2) + " €").join(" · "));
  }
  console.log("Ohne Werte (" + noData.length + "): " + noData.join(" · "));
  console.log("Auf der Karte, nicht bei Wolt: " + notOnWolt.join(" · "));
  console.log("Zuordnung: " + mapping.join(" · "));
  console.log("Preise Karte ≠ Wolt (" + priceDiffs.length + "): " + priceDiffs.join(" · "));
  console.log("default_value optionaler Gruppen (keine Vorauswahl): " + preselected.length);
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(" · ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.coriander) ? out._meta.coriander.join(" · ") : out._meta.coriander));
  console.log("Auffälligkeiten (" + anomalies.length + "):" + (anomalies.length ? "\n  " + anomalies.map(x => x.name + ": " + x.issues.join("; ")).join("\n  ") : " keine"));
}

module.exports = { CATS, WOLT_TO_MENU, NO_DATA };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
