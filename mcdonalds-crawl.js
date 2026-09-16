// McDonald's Frankfurt (Wolt, An der Hauptwache) → data/mcdonalds-raw.json (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung passiert in
// den Tabellen unten). Aufruf: node mcdonalds-crawl.js · danach node mcdonalds-update.js
// Quellen: offizielle Nährwerte von mcdonalds.com/de (Produktliste je Kategorie-Seite, Werte je Produkt über die Website-Schnittstelle
// /dnaapp/itemDetails, die auch die Produktseiten nutzt) · Menü, Namen, Preise und Pflicht-Auswahlen aus der Wolt-API der Filiale An der Hauptwache.
// Frühstück und Getränke gehören nicht zum Tracker (User 16.09.2026); McMenüs, Happy Meals und Bundles sind Kombinationen mit Getränk.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "mcdonalds-raw.json");
const SITE = "https://www.mcdonalds.com";
const CATEGORY_PAGE = slug => SITE + "/de/de-de/produkte/alle-produkte/" + slug + ".html";
const ITEM_API = id => SITE + "/dnaapp/itemDetails?country=DE&language=de&showLiveData=true&item=" + id;
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
const PRIMARY = "mcdonalds-an-der-hauptwache"; // User 16.09.2026
// Website-Kategorien, deren Produkte (Nährwerte) gelesen werden; Frühstück, Getränke und McMenüs nicht
const SITE_CATEGORIES = ["burger", "mcwrap", "mccrispy", "mcnuggets-fingerfood", "veggie-und-plantbased", "beilagen-extras", "desserts", "mcsmart-snacks", "happy-meal", "mccafe"];
const SKIPPED_SITE_CATEGORIES = { fruehstueck: "Frühstück (User 16.09.2026: ignorieren)", getraenke: "Getränke (User 16.09.2026: ignorieren)", mcmenu: "McMenüs = Burger + Beilage + Getränk" };
// Wolt-Kategorien → Tracker-Kategorie (id, Default an/aus); übrige Wolt-Kategorien werden nicht gelesen
const WOLT_CATEGORIES = {
  "Burger": { id: "burger", on: true }, "McWrap®": { id: "mcwrap", on: true }, "McNuggets® & Fingerfood": { id: "nuggets", on: true },
  "Beilagen & Extras": { id: "beilagen", on: true }, "Desserts": { id: "desserts", on: false },
  "McSmart Menü & Snacks": { dupOnly: true }, "Veggie & Plant-Based": { dupOnly: true },
};
const SKIPPED_WOLT_CATEGORIES = { "Highlights": "Duplikate", "McMenü®": "Menüs mit Getränk", "Bundle Deals": "Bundles mit Getränken", "Happy Meal®": "Kinder-Menü mit Getränk", "Getränke": "Getränke (User 16.09.2026)", "McCafé®": "Getränke; Gebäck steht auch unter Desserts" };
// Wolt-Produkte, die nicht in den Tracker gehören
const WOLT_SKIP = [
  [/ Mehrweg$/, "Mehrweg-Variante (gleiches Produkt, Pfandbecher)"],
  [/^Milchshake /, "Getränk (User 16.09.2026)"],
  [/^Iced Coffee Shake /, "Getränk (User 16.09.2026)"],
  [/ Trio$/, "Auswahl-Paket aus zwei Einzel-McPops (die Einzelstücke sind im Tracker)"],
];
// Wolt-Name → Website-Name, wo die Normalisierung nicht reicht
const WOLT_TO_SITE = {
  "McFlurry® Kitkat White mit Erdbeer Sauce": "McFlurry® KitKat® White Erdbeersauce",
  "Frucht-Quatsch 80g": "Fruchtquatsch 80g",
};
// Saucen, Dips und Dressings (Schalter „No sauces & dressings“) — nur in „Beilagen & Extras“ (sonst träfe es z.B. „McFlurry® Kitkat White mit Erdbeer Sauce“)
const SAUCE_RE = /Sauce|Dip |Dip$|Ketchup|Mayonnaise|Dressing/;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
// Vergleichsschlüssel: ohne ®/™, Mengenangaben und „(Extra)“, Bindestriche/„+“/„&“ vereinheitlicht, Groß-/Kleinschreibung egal
const matchKey = s => normName(s).toLowerCase().replace(/[®™]/g, "").replace(/\(extra\)/g, "").replace(/\b\d+\s?(ml|g|l)\b/g, "").replace(/[-–]/g, " ").replace(/\s*[+&]\s*/g, " & ").replace(/\s+/g, " ").trim();
const H_HTML = { Accept: "text/html", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const H_JSON = { Accept: "application/json", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
// Wolt liefert neue Artikel nur an Clients mit Versionsangabe (siehe subway-crawl.js)
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
const decode = s => s.replace(/&#34;/g, '"').replace(/&amp;/g, "&").replace(/&reg;/g, "®");
const NUTRIENTS = { energy_kcal: "kcal", fat: "fat", saturated_fat: "sat", carbohydrate: "carbs", sugar: "sugars", fiber: "fibre", protein: "protein", salt: "salt" };
const num = v => (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v) : null);

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];

  // ── Website: Produkt-ids je Kategorie ──
  const siteProducts = new Map(); // id → { id, name, categories:[] }
  for (const slug of SITE_CATEGORIES) {
    const html = await get(CATEGORY_PAGE(slug), H_HTML);
    const re = /<li class="cmp-category__item" data-product-id="(\d+)">\s*<a href="([^"]+)"[^>]*?dc:title&#34;:&#34;(.*?)&#34;/g;
    let m, n = 0;
    while ((m = re.exec(html))) {
      n++;
      const id = +m[1];
      if (!siteProducts.has(id)) siteProducts.set(id, { id, name: normName(decode(m[3])), page: SITE + m[2], categories: [] });
      siteProducts.get(id).categories.push(slug);
    }
    if (!n) problems.push("Website: Kategorie „" + slug + "“ ohne Produkte (Seitenaufbau geändert?)");
    await sleep(500);
  }

  // ── Website: Nährwerte je Produkt ──
  const products = [];
  for (const p of siteProducts.values()) {
    let item;
    try { item = (await get(ITEM_API(p.id), H_JSON, true)).item; } catch (e) { problems.push("Website: Nährwerte für „" + p.name + "“ (" + p.id + ") nicht lesbar: " + e.message); continue; }
    await sleep(250);
    const nf = ((item.nutrient_facts || {}).nutrient) || [];
    const byId = Object.fromEntries(nf.map(x => [x.nutrient_name_id, x]));
    const perServing = {}, per100 = {};
    let ok = true;
    for (const [src, key] of Object.entries(NUTRIENTS)) {
      const x = byId[src];
      const v = x ? num(String(x.value)) : null;
      if (v == null) { ok = false; problems.push("Website: „" + p.name + "“ ohne " + src); continue; }
      perServing[key] = v;
      const h = x && typeof x.hundred_g_per_product === "string" ? num(x.hundred_g_per_product) : null;
      if (h != null) per100[key] = h;
    }
    if (!ok) continue;
    const serving = byId.primary_serving_size ? num(String(byId.primary_serving_size.value).split("/")[0]) : null;
    const allergens = typeof item.item_allergen === "string" ? item.item_allergen : "";
    const ingredients = typeof item.item_ingredient_statement === "string" ? item.item_ingredient_statement : "";
    const prod = { siteId: p.id, name: normName(item.item_name) || p.name, marketingName: normName(item.item_marketing_name), listName: p.name, page: p.page, siteCategories: p.categories,
      servingG: serving, perServing, per100: Object.keys(per100).length === 8 ? per100 : null, allergens, ingredients };
    if (/krebstier|weichtier/i.test(allergens)) prod.shellfish = true;
    const issues = U.checkItem(perServing);
    if (issues.length) anomalies.push({ name: prod.listName, issues });
    products.push(prod);
  }

  // ── Wolt: Menü An der Hauptwache ──
  const assort = await get(WOLT_API(PRIMARY), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  const siteByKey = new Map();
  for (const pr of products) for (const nm of [pr.listName, pr.name, pr.marketingName]) if (nm) { const k = matchKey(nm); if (!siteByKey.has(k)) siteByKey.set(k, pr); }
  const items = [], skipped = [], noData = [], seen = new Map();
  const unknownCats = [];
  // Haupt-Kategorien zuerst, Duplikat-Kategorien (McSmart, Veggie) danach nur zur Kontrolle
  const dupRank = c => (WOLT_CATEGORIES[normName(c.name)] || {}).dupOnly ? 1 : 0;
  const cats = [...(assort.categories || [])].sort((x, y) => dupRank(x) - dupRank(y));
  for (const c of cats) {
    const cname = normName(c.name);
    const def = WOLT_CATEGORIES[cname];
    if (!def) { if (!SKIPPED_WOLT_CATEGORIES[cname]) unknownCats.push(cname); continue; }
    for (const id of c.item_ids || []) {
      const it = byItem[id];
      if (!it) continue;
      const name = normName(it.name);
      const skip = WOLT_SKIP.find(([re]) => re.test(name));
      if (skip) { if (!skipped.some(s => s.startsWith(name + " "))) skipped.push(name + " (" + U.round(it.price / 100, 2) + " €) — " + skip[1]); continue; }
      const key = matchKey(WOLT_TO_SITE[name] || name);
      if (seen.has(key)) { const prev = seen.get(key); if (prev.price !== U.round(it.price / 100, 2)) problems.push("Wolt: „" + name + "“ mit zwei Preisen (" + prev.price + " / " + U.round(it.price / 100, 2) + " €)"); continue; }
      if (def.dupOnly) { problems.push("Wolt: „" + name + "“ steht nur in der Duplikat-Kategorie „" + cname + "“"); continue; }
      const pr = siteByKey.get(key);
      if (!pr) { noData.push(name + " (" + U.round(it.price / 100, 2) + " €) — kein Produkt mit Nährwerten auf mcdonalds.com/de"); seen.set(key, { price: U.round(it.price / 100, 2) }); continue; }
      // Pflicht-Auswahlen mit „Ohne …“ (Saucen der Nuggets, Dressing der Salate, Zutaten des McFlurry) → Hinweis für den Order Guide
      const required = [];
      let blocked = null;
      for (const ref of it.options || []) {
        const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
        if (!(cfg.min >= 1)) continue;
        const none = (g.values || []).find(v => /^Ohne /.test(normName(v.name)));
        if (!none) { blocked = "Pflicht-Auswahl „" + normName(ref.name) + "“ ohne „Ohne …“-Option"; break; }
        required.push({ group: normName(ref.name), none: normName(none.name) });
      }
      if (blocked) { skipped.push(name + " (" + U.round(it.price / 100, 2) + " €) — " + blocked); seen.set(key, { price: U.round(it.price / 100, 2) }); continue; }
      const entry = { name, siteName: pr.listName, siteId: pr.siteId, cat: def.id, price: U.round(it.price / 100, 2), required, sauce: def.id === "beilagen" && SAUCE_RE.test(name) };
      items.push(entry);
      seen.set(key, entry);
    }
  }
  if (unknownCats.length) problems.push("Wolt: unbekannte Kategorie(n) " + unknownCats.map(c => "„" + c + "“").join(", ") + " (WOLT_CATEGORIES oder SKIPPED_WOLT_CATEGORIES ergänzen)");
  for (const [w, sname] of Object.entries(WOLT_TO_SITE)) if (!products.some(p => p.listName === sname)) problems.push("WOLT_TO_SITE: Website-Produkt „" + sname + "“ fehlt");
  const onWolt = new Set(items.map(i => i.siteId));
  const notOnWolt = products.filter(p => !onWolt.has(p.siteId)).map(p => p.listName);
  const dislikes = products.filter(p => onWolt.has(p.siteId) && /koriander|minze/i.test(p.ingredients)).map(p => p.listName + ": " + (p.ingredients.match(/[^.,:;]*(koriander|minze)[^.,:;]*/i) || [""])[0].trim());
  const shellfish = products.filter(p => p.shellfish).map(p => p.listName);

  const out = {
    _meta: {
      restaurant: "McDonald's", fetchedAt,
      sources: {
        nutrition: { site: SITE + "/de/de-de/produkte/alle-produkte.html", api: ITEM_API("{id}"), categories: SITE_CATEGORIES, skippedCategories: SKIPPED_SITE_CATEGORIES },
        wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY), categories: Object.keys(WOLT_CATEGORIES), skippedCategories: SKIPPED_WOLT_CATEGORIES },
      },
      basis: "Offizielle Werte je Portion (Produkt) von mcdonalds.com/de; Wolt-Namen und -Preise der Filiale An der Hauptwache. Nuggets, Potato Dippers, Salate und McFlurry Mix & Match ohne die inklusive Sauce/Dressing/Zutat (Order Guide: „Ohne …“).",
      decisions: [
        "User 16.09.2026: McDonald's als Tracker, Produkte und Nährwerte von mcdonalds.com/de; Frühstück und Getränke ignorieren",
        "User 16.09.2026: „Must include“ — ein oder mehrere Produkte, die jede vorgeschlagene Bestellung enthält",
        "User 16.09.2026: Plattform Wolt, Filiale McDonald's An der Hauptwache (Namen, Verfügbarkeit, Preise)",
      ],
      mapping: Object.fromEntries(items.filter(i => i.name !== i.siteName).map(i => [i.name, i.siteName])),
      skipped, noData, notOnWolt, anomalies, shellfish: shellfish.length ? shellfish : "kein Produkt mit Krebs- oder Weichtieren laut Allergenangabe (Filet-O-Fish = Fisch, erlaubt)",
      dislikes: dislikes.length ? dislikes : "kein Tracker-Produkt mit Koriander oder Minze in der Zutatenliste",
    },
    products,
    wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), cats: Object.values(WOLT_CATEGORIES).filter(c => c.id).map(c => ({ id: c.id, name: Object.keys(WOLT_CATEGORIES).find(k => WOLT_CATEGORIES[k] === c), on: c.on })), items },
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(products.length + " Website-Produkte mit Nährwerten, " + items.length + " Wolt-Produkte im Tracker → " + path.relative(__dirname, OUT));
  for (const c of out.wolt.cats) console.log("  " + c.name + (c.on ? "" : " (aus)") + ": " + items.filter(i => i.cat === c.id).map(i => i.name + " " + i.price + " €" + (i.required.length ? " [" + i.required.map(r => r.none).join("/") + "]" : "")).join(" · "));
  console.log("Zuordnung abweichend: " + Object.entries(out._meta.mapping).map(([w, s]) => w + " = " + s).join(" · "));
  console.log("Ohne Nährwerte: " + (noData.join(" · ") || "–"));
  console.log("Weggelassen: " + skipped.join(" · "));
  console.log("Nicht bei Wolt: " + notOnWolt.join(", "));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.dislikes) ? out._meta.dislikes.join(" · ") : out._meta.dislikes));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}
main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
