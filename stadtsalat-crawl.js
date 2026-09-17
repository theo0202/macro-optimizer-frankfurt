// Stadtsalat Frankfurt (Wolt): 17 Gerichte laut User-Liste → data/stadtsalat-raw.json (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung
// passiert in den Tabellen unten). Aufruf: node stadtsalat-crawl.js · danach node stadtsalat-update.js
// Quellen (User 17.09.2026):
// · Wolt-API „stadtsalat-frankfurt“ (mit Client-Version-Headern): Gerichte, Preise, Gruppen „Protein“, „Dressing (Inklusive)“, „Dressing (Extra)“,
//   „Extra Zutaten“ inkl. Grenzen und Vorauswahl
// · Stadtsalat-Shop-API (api.stadtsalat.de, die Website stadtsalat.de/frankfurt nutzt sie): Lieferstore der Liefergruppe Frankfurt (liefert laut API auch
//   für Wolt) → je Produkt die offiziellen Nährwerte der Portion (8 Werte), Portionsgewicht, Zutaten mit Mengen (parts), Standard-Dressing (includes),
//   Allergene; Produktgruppen = Protein-Varianten eines Gerichts (je Protein ein eigenes Produkt mit eigenen Werten)
// · Kontrolle: Nährwert- und Allergenliste stadtsalat.de/allergene (__NEXT_DATA__) und die im Konfigurator abgelesene Anzeige
//   (data/stadtsalat-konfigurator.json: jede Protein-Variante, „Double up!“, jede Wolt-Extra-Zutat ×1/×2 — am 17.09.2026 durchgeklickt)
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "stadtsalat-raw.json");
const KONFIG = path.join(__dirname, "data", "stadtsalat-konfigurator.json");
const WOLT_SLUG = "stadtsalat-frankfurt";
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = "https://wolt.com/de/deu/frankfurt/restaurant/" + WOLT_SLUG;
const SS_API = "https://api.stadtsalat.de";
const SS_CITY = "frankfurt";
const SS_PAGE = "https://stadtsalat.de/frankfurt";
const SS_ALLERGENE = "https://stadtsalat.de/allergene";

// User 17.09.2026: bei Wolt verfügbare Gerichte (Liste des Users), aus denen der Tracker wählt
const DISHES = ["Falafel Crush", "Feel Good", "Protein Fit", "Harvest Time", "Metabolic Balance", "Holy Greek", "Caesar's Classic", "Mexican Taco",
  "CAESAR PROTEIN PLATE", "Peachy Feta", "SWEET POTATO SNACK", "Omega Protein Plate", "Peachy Burrata", "Fresh Kick", "Falafel Protein Plate", "Green Power",
  "Ranch Protein Plate"];
// Wolt-Gruppen der Gerichte → Art
const GROUPS = { "Protein": "protein", "Dressing (Inklusive)": "dressing", "Dressing (Extra)": "dressingExtra", "Extra Zutaten": "extras" };
// Zusatzverkauf in jedem Gericht (eigene Wolt-Artikel, nicht Teil der Bowl) → nicht im Tracker
const CROSS_SELL = { "Sides": "Beilagen als zusätzliche Artikel (SWEET POTATO SNACK ist als eigenes Gericht im Tracker)", "Drinks": "Getränke", "Desserts": "Desserts", "Sonstiges": "Besteck/Servietten" };
// Koriander/Minze (User 13.09.2026): Dressings mit Minze nie vorschlagen. Der Crawl sucht Koriander/Minze in Namen und Beschreibungen und bricht ab,
// wenn ein Dressing oder eine Extra-Zutat mit Treffer hier nicht steht
const NEVER = {
  "Joghurt-Minze": "Minze (Name) — User 13.09.2026: Minze nie vorschlagen",
  "Gurke-Tahini": "Minze laut Stadtsalat-Beschreibung („ergänzt um frische Gurke, Ingwer, Minze und Limettensaft“) — User 13.09.2026: Minze nie vorschlagen",
};
const HERB_RE = /koriander|minze|cilantro/i;
// Schalentier (User 13.09.2026): Allergen-ids der Shop-API
const SHELLFISH_ALLERGENS = new Set(["crustaceans", "molluscs", "mollusks", "shellfish"]);
const SHELLFISH_NAME_RE = /garnele|shrimp|krabbe|krebs|hummer|muschel|tintenfisch|calamar|oktopus|meeresfr/i;
// Toleranz Produktwerte ↔ Summe der Zutaten (Rundung der Shop-Werte je 100 g)
const PART_TOL = { kcal: 0.5, g: 0.1 };

const KEY_MAP = { kcal: "energyKcal", fat: "fat", sat: "saturatedFattyAcids", carbs: "carbohydrates", sugars: "sugar", fibre: "fibers", protein: "protein", salt: "salt" };
const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const lower = s => normName(s).toLowerCase();
const euro = v => U.round(v, 2);
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
const H_JSON = { Accept: "application/json", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const H_HTML = Object.assign({}, H_JSON, { Accept: "text/html" });
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
const payload = j => (j && j.payload !== undefined ? j.payload : j);

// Nährwerte eines Shop-Produkts (Portion) → LMIV-Schlüssel; fehlt ein Wert → null
function nutrients(di) {
  const n = (di && di.nutrients) || {};
  const out = {};
  for (const [k, src] of Object.entries(KEY_MAP)) {
    if (n[src] == null || String(n[src]).trim() === "" || !isFinite(Number(n[src]))) return null;
    out[k] = Number(n[src]);
  }
  return out;
}
// Zutaten eines Produkts: Gramm = Portionsgewicht der Zutat × Anzahl (Einheit „piece“: portionSize = Stückzahl, das Gewicht steht in portionWeight)
function partsOf(p) {
  return (p.parts || []).map(pt => {
    const ing = pt.ingredient || {}, di = ing.dietaryInfo || {};
    return { id: ing.id, name: normName(ing.name), count: Number(pt.count), unit: ing.unit, grams: U.round(Number(di.portionWeight) * Number(pt.count), 2), per100: nutrients(di) };
  });
}
function sumParts(parts) {
  const s = Object.fromEntries(U.KEYS.map(k => [k, 0]));
  let w = 0;
  for (const pt of parts) { w += pt.grams; for (const k of U.KEYS) s[k] += (pt.per100 ? pt.per100[k] : 0) * pt.grams / 100; }
  return { weight: U.round(w, 2), values: Object.fromEntries(U.KEYS.map(k => [k, U.round(s[k], 2)])) };
}
function shopProduct(p, problems) {
  const di = p.dietaryInfo || {};
  const values = nutrients(di);
  if (!values) problems.push("Shop: Produkt „" + p.name + "“ (" + p.id + ") ohne vollständige Nährwerte");
  if (!(Number(di.portionWeight) > 0)) problems.push("Shop: Produkt „" + p.name + "“ (" + p.id + ") ohne Portionsgewicht");
  const parts = partsOf(p);
  return {
    id: p.id, name: normName(p.name), price: euro(Number(p.price && p.price.withVat)), available: !!p.available, weight: Number(di.portionWeight), values,
    parts: parts.map(({ per100, ...x }) => x), includes: (p.includes || []).map(x => x.id),
    allergens: (di.allergens || []).map(a => ({ id: a.id, name: a.name })), ingredients: (p.publicIngredientInfos || []).map(x => normName(x.name)),
    tags: p.productTags || [], _parts: parts,
  };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [], infos = [];

  // ── Stadtsalat: Liefergruppe → Lieferstore, Shop mit Zutaten, Produktgruppen, Allergenliste ──
  const dg = payload(await get(SS_API + "/info/deliverygroups/" + SS_CITY, H_JSON, true));
  const store = (dg.deliveryStores || []).find(s => s.id === dg.defaultDeliveryStore);
  if (!store) throw new Error("Stadtsalat: Lieferstore „" + dg.defaultDeliveryStore + "“ nicht in der Liefergruppe " + SS_CITY);
  if (!(store.deliveryTypes || []).includes("WOLT_DELIVERY")) problems.push("Stadtsalat: Lieferstore " + store.id + " ohne WOLT_DELIVERY (" + (store.deliveryTypes || []).join(", ") + ")");
  const shop = payload(await get(SS_API + "/shop/" + store.id, H_JSON, true));
  const productGroups = payload(await get(SS_API + "/product/productGroup", H_JSON, true));
  const allergeneHtml = await get(SS_ALLERGENE, H_HTML, false);
  const nd = allergeneHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!nd) throw new Error("stadtsalat.de/allergene: __NEXT_DATA__ fehlt (Seitenaufbau geändert?)");
  const allergeneGroups = JSON.parse(nd[1]).props.pageProps.groups;

  const shopById = new Map((shop.products || []).map(p => [p.id, p]));
  const shopByName = name => (shop.products || []).filter(p => lower(p.name) === lower(name));
  const used = new Map(); // id → shopProduct()
  const useProduct = p => { if (!used.has(p.id)) used.set(p.id, shopProduct(p, problems)); return used.get(p.id); };

  // ── Wolt ──
  const assort = await get(WOLT_API(WOLT_SLUG), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  const catOf = id => { const c = (assort.categories || []).find(c => (c.item_ids || []).includes(id)); return c ? normName(c.name) : null; };

  // Wolt-Gruppen eines Gerichts lesen (Grenzen, Vorauswahl, Preise, Stepper-Maxima)
  const woltGroups = (it, dish) => {
    const out = {}, crossSell = [];
    for (const ref of it.options || []) {
      const gname = normName(ref.name), kind = GROUPS[gname];
      const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
      if (!kind) { if (CROSS_SELL[gname]) crossSell.push(gname); else problems.push("Wolt: unbekannte Gruppe „" + gname + "“ (" + dish + ")"); continue; }
      const def = (g.values || []).find(v => v.id === g.default_value);
      out[kind] = {
        name: gname, min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1, default: def ? normName(def.name) : null,
        options: (g.values || []).map(v => ({ name: normName(v.name), price: euro((v.price || 0) / 100), maxQty: (v.multi_choice_config && v.multi_choice_config.total_range && v.multi_choice_config.total_range.max) || 1 })),
      };
    }
    return { groups: out, crossSell };
  };

  const dishes = [], extrasByName = new Map(), dressingsByName = new Map(), groupSig = { extras: null, dressing: null, dressingExtra: null };
  const priceDiffs = [], crossSellSeen = new Set();
  for (const dname of DISHES) {
    const hits = Object.values(byItem).filter(i => normName(i.name) === dname);
    if (!hits.length) { problems.push("Wolt: Gericht „" + dname + "“ nicht gefunden"); continue; }
    const it = hits[0];
    // derselbe Name mehrfach (z.B. in zwei Kategorien) nur mit gleichem Preis und gleichen Optionen
    const sigOf = x => JSON.stringify([x.price, (x.options || []).map(o => [normName(o.name), JSON.stringify(((byOpt[o.option_id] || {}).values || []).map(v => [normName(v.name), v.price]))])]);
    if (hits.some(x => sigOf(x) !== sigOf(it))) problems.push("Wolt: Gericht „" + dname + "“ " + hits.length + "× mit unterschiedlichem Preis/Optionen");
    const price = euro(it.price / 100);
    const { groups, crossSell } = woltGroups(it, dname);
    crossSell.forEach(x => crossSellSeen.add(x));
    const hasBowlGroups = !!(groups.dressing || groups.extras);
    if (hasBowlGroups && !(groups.dressing && groups.dressingExtra && groups.extras)) problems.push("Wolt: " + dname + " ohne alle Gruppen Dressing (Inklusive) / Dressing (Extra) / Extra Zutaten");
    // Extras und Dressings müssen in allen Gerichten gleich sein (Namen, Preise, Grenzen)
    for (const k of ["extras", "dressing", "dressingExtra"]) if (groups[k]) {
      const sig = JSON.stringify([groups[k].min, groups[k].max, groups[k].options]);
      if (groupSig[k] == null) groupSig[k] = sig;
      else if (groupSig[k] !== sig) problems.push("Wolt: Gruppe „" + groups[k].name + "“ bei " + dname + " anders als bei den übrigen Gerichten");
    }
    const dish = { name: dname, cat: catOf(it.id), price, description: normName(it.description), unitInfo: it.unit_info || null, bowl: hasBowlGroups, variants: [] };
    if (groups.protein) {
      // Protein-Wahl → Stadtsalat-Produktgruppe gleichen Namens; je Wolt-Protein das Varianten-Produkt
      const pg = (productGroups || []).filter(x => lower(x.name) === lower(dname));
      if (pg.length !== 1) { problems.push("Stadtsalat: Produktgruppe „" + dname + "“ " + pg.length + "× gefunden (erwartet 1)"); continue; }
      dish.shopGroup = pg[0].id;
      dish.proteinGroup = { name: groups.protein.name, min: groups.protein.min, max: groups.protein.max, default: groups.protein.default };
      for (const o of groups.protein.options) {
        const item = pg[0].items.filter(x => lower(x.shortName) === lower(o.name) || lower(x.variantLongName) === lower(o.name));
        if (item.length !== 1) { problems.push("Stadtsalat: " + dname + " — Protein „" + o.name + "“ " + item.length + "× in der Produktgruppe"); continue; }
        const p = shopById.get(item[0].id), addon = shopById.get(item[0].variantProductReference);
        if (!p) { problems.push("Stadtsalat: Produkt " + item[0].id + " (" + dname + " " + o.name + ") nicht im Shop"); continue; }
        if (!addon) { problems.push("Stadtsalat: Protein-Produkt " + item[0].variantProductReference + " (" + o.name + ") nicht im Shop"); continue; }
        const sp = useProduct(p);
        dish.variants.push({ protein: o.name, proteinProduct: addon.id, product: p.id, optionPrice: o.price, price: euro(price + o.price), default: o.name === groups.protein.default });
        if (Math.abs(sp.price - euro(price + o.price)) > 0.001) priceDiffs.push(dname + " " + o.name + ": Wolt " + euro(price + o.price) + " € ≠ Stadtsalat " + sp.price + " €");
      }
      const shopOnly = pg[0].items.filter(x => shopById.has(x.id) && !groups.protein.options.some(o => lower(o.name) === lower(x.shortName)));
      if (shopOnly.length) infos.push(dname + ": nur bei Stadtsalat, nicht bei Wolt: " + shopOnly.map(x => x.shortName).join(", "));
    } else {
      const ps = shopByName(dname);
      if (ps.length !== 1) { problems.push("Stadtsalat: Produkt „" + dname + "“ " + ps.length + "× gefunden (erwartet 1)"); continue; }
      if ((productGroups || []).some(x => lower(x.name) === lower(dname))) problems.push("Stadtsalat: „" + dname + "“ hat eine Produktgruppe, Wolt aber keine Protein-Wahl");
      const sp = useProduct(ps[0]);
      dish.variants.push({ protein: null, proteinProduct: null, product: ps[0].id, optionPrice: 0, price, default: true });
      if (Math.abs(sp.price - price) > 0.001) priceDiffs.push(dname + ": Wolt " + price + " € ≠ Stadtsalat " + sp.price + " €");
    }
    if (hasBowlGroups) {
      dish.dressingGroup = { name: groups.dressing.name, min: groups.dressing.min, max: groups.dressing.max, default: groups.dressing.default };
      for (const o of groups.dressing.options) if (!dressingsByName.has(o.name)) dressingsByName.set(o.name, { name: o.name });
      for (const o of groups.dressingExtra.options) Object.assign(dressingsByName.get(o.name) || {}, { extraPrice: o.price, extraMaxQty: o.maxQty });
      for (const o of groups.extras.options) if (!extrasByName.has(o.name)) extrasByName.set(o.name, { name: o.name, price: o.price, maxQty: o.maxQty });
      dish.dressingExtraGroup = { name: groups.dressingExtra.name, min: groups.dressingExtra.min, max: groups.dressingExtra.max };
      dish.extrasGroup = { name: groups.extras.name, min: groups.extras.min, max: groups.extras.max };
    }
    dishes.push(dish);
  }
  for (const d of dressingsByName.values()) if (!(d.extraPrice >= 0)) problems.push("Wolt: Dressing „" + d.name + "“ fehlt in „Dressing (Extra)“");

  // ── Extras und Dressings → Shop-Produkte (Name, Zutat, Preis) ──
  const ingredientProducts = (shop.products || []).filter(p => (p.productTags || []).some(t => /^(ingredient|addon)/.test(t)));
  const matchIngredient = (name, re) => ingredientProducts.filter(p => lower(p.name) === lower(name) && (!re || (p.productTags || []).some(t => re.test(t))));
  const extras = [];
  for (const e of extrasByName.values()) {
    const hits = matchIngredient(e.name).filter(p => !(p.productTags || []).includes("ingredient.dressing"));
    if (hits.length !== 1) { problems.push("Stadtsalat: Extra „" + e.name + "“ " + hits.length + "× gefunden (erwartet 1)"); continue; }
    const sp = useProduct(hits[0]);
    if (sp._parts.length !== 1 || sp._parts[0].count !== 1) problems.push("Stadtsalat: Extra „" + e.name + "“ besteht nicht aus genau einer Zutat");
    if (Math.abs(sp.price - e.price) > 0.001) priceDiffs.push("Extra " + e.name + ": Wolt " + e.price + " € ≠ Stadtsalat " + sp.price + " €");
    extras.push({ wolt: e.name, product: sp.id, part: sp._parts[0] && sp._parts[0].id, price: e.price, maxQty: e.maxQty });
  }
  const dressings = [];
  for (const d of dressingsByName.values()) {
    const hits = matchIngredient(d.name, /^ingredient\.dressing$/);
    if (hits.length !== 1) { problems.push("Stadtsalat: Dressing „" + d.name + "“ " + hits.length + "× gefunden (erwartet 1)"); continue; }
    const sp = useProduct(hits[0]);
    if (Math.abs(sp.price - d.extraPrice) > 0.001) priceDiffs.push("Dressing (Extra) " + d.name + ": Wolt " + d.extraPrice + " € ≠ Stadtsalat " + sp.price + " €");
    const rec = { wolt: d.name, product: sp.id, extraPrice: d.extraPrice, extraMaxQty: d.extraMaxQty };
    if (NEVER[d.name]) rec.never = NEVER[d.name];
    dressings.push(rec);
  }
  for (const n of Object.keys(NEVER)) if (!dressingsByName.has(n)) problems.push("NEVER: Dressing „" + n + "“ gibt es bei Wolt nicht mehr");

  // Koriander/Minze: Namen und Beschreibungen von Dressings und Extras (Treffer ohne NEVER-Eintrag → Abbruch), Zutaten der Gerichte (nur Hinweis)
  const descOf = p => [p.name, p.longDescription, ...(p.parts || []).flatMap(pt => [pt.ingredient && pt.ingredient.name, pt.ingredient && pt.ingredient.longDescription])].filter(Boolean).join(" ").replace(/<[^>]+>/g, " ");
  for (const d of dressings) if (HERB_RE.test(descOf(shopById.get(d.product))) && !d.never) problems.push("Koriander/Minze im Dressing „" + d.wolt + "“ — in NEVER eintragen oder begründen");
  for (const e of extras) if (HERB_RE.test(descOf(shopById.get(e.product)))) problems.push("Koriander/Minze in der Extra-Zutat „" + e.wolt + "“ — Regel klären");
  const partToExtra = new Map(extras.map(e => [e.part, e.wolt]));

  // ── Varianten: Werte, Zutaten, Protein-Portionen, enthaltene Extra-Zutaten, Standard-Dressing ──
  const dressingByProduct = new Map(dressings.map(d => [d.product, d.wolt]));
  const coriander = [], partDiffs = [], partName = new Map();
  for (const dish of dishes) {
    const variantParts = [];
    for (const v of dish.variants) {
      const sp = used.get(v.product);
      v.weight = sp.weight;
      v.values = sp.values;
      v.ingredients = sp.ingredients;
      v.allergens = sp.allergens.map(a => a.name);
      if (sp.allergens.some(a => SHELLFISH_ALLERGENS.has(a.id)) || sp._parts.some(pt => SHELLFISH_NAME_RE.test(pt.name))) v.shellfish = true;
      // enthaltene Wolt-Extra-Zutaten (für „Must include“/„Exclude items“): Zutat-id der Teile = Zutat des Extra-Produkts
      v.contains = {};
      for (const pt of sp._parts) { const e = partToExtra.get(pt.id); if (e) v.contains[e] = U.round((v.contains[e] || 0) + pt.count, 2); }
      if (v.proteinProduct) {
        const protPart = shopById.get(v.proteinProduct).parts[0].ingredient.id;
        v.proteinQty = sp._parts.filter(pt => pt.id === protPart).reduce((a, pt) => a + pt.count, 0);
        if (!(v.proteinQty >= 1)) problems.push("Stadtsalat: " + dish.name + " " + v.protein + " enthält das Protein nicht (" + v.product + ")");
      }
      if (sp._parts.some(pt => /koriander/i.test(pt.name))) v.coriander = true;
      // Standard-Dressing: Wolt-Vorauswahl = Shop includes
      const inc = sp.includes.map(id => dressingByProduct.get(id) || id);
      if (dish.bowl && (inc.length !== 1 || inc[0] !== dish.dressingGroup.default)) anomalies.push({ name: dish.name + (v.protein ? " " + v.protein : ""), issues: ["Standard-Dressing Wolt „" + dish.dressingGroup.default + "“ ≠ Stadtsalat „" + inc.join(", ") + "“"] });
      if (!dish.bowl && inc.length) problems.push("Stadtsalat: " + dish.name + " hat ein Standard-Dressing, Wolt aber keine Dressing-Gruppe");
      // Produktwerte ↔ Summe der Zutaten
      const sum = sumParts(sp._parts), issues = [];
      for (const k of U.KEYS) {
        const d = U.round(sp.values[k] - sum.values[k], 2);
        if (Math.abs(d) > (k === "kcal" ? PART_TOL.kcal : PART_TOL.g)) issues.push(k + " " + (d > 0 ? "+" : "") + d);
      }
      if (Math.abs(sp.weight - sum.weight) > 0.51) issues.push("Gewicht " + sp.weight + " g ≠ Zutaten " + sum.weight + " g");
      if (issues.length) partDiffs.push({ name: dish.name + (v.protein ? " " + v.protein : ""), product: v.product, issues });
      const plaus = U.checkItem(sp.values);
      if (plaus.length) anomalies.push({ name: dish.name + (v.protein ? " " + v.protein : ""), issues: plaus });
      for (const pt of sp._parts) partName.set(pt.id, pt.name);
      variantParts.push({ v, parts: sp._parts.filter(pt => !v.proteinProduct || pt.id !== shopById.get(v.proteinProduct).parts[0].ingredient.id).map(pt => pt.id + "×" + pt.count).sort().join(",") });
    }
    if (dish.variants.some(v => v.coriander)) coriander.push(dish.name + " (Koriander, " + used.get(dish.variants[0].product)._parts.filter(pt => /koriander/i.test(pt.name)).map(pt => pt.grams + " g").join(", ") + ")");
    // gleiche Zutaten außer dem Protein in allen Varianten eines Gerichts?
    if (variantParts.length > 1) {
      const counts = new Map();
      for (const x of variantParts) counts.set(x.parts, (counts.get(x.parts) || 0) + 1);
      const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      for (const x of variantParts) if (x.parts !== main) {
        const a = new Set(main.split(",")), b = new Set(x.parts.split(","));
        const nm = y => { const [id, c] = y.split("×"); return (partName.get(id) || id) + (c !== "1" ? " ×" + c : ""); };
        const missing = [...a].filter(y => !b.has(y)).map(nm), extra = [...b].filter(y => !a.has(y)).map(nm);
        anomalies.push({ name: dish.name + " " + x.v.protein, issues: ["Zutaten außer dem Protein anders als in den übrigen Varianten: " + (missing.length ? "ohne " + missing.join(", ") : "") + (extra.length ? (missing.length ? "; " : "") + "zusätzlich " + extra.join(", ") : "")] });
      }
    }
  }
  for (const pd of partDiffs) anomalies.push({ name: pd.name, issues: ["Produktwerte ≠ Summe der Zutaten (" + pd.issues.join(", ") + ")"] });
  for (const id of [...extras.map(e => e.product), ...dressings.map(d => d.product)]) {
    const sp = used.get(id), plaus = U.checkItem(sp.values);
    if (plaus.length) anomalies.push({ name: sp.name, issues: plaus });
    if (sp.allergens.some(a => SHELLFISH_ALLERGENS.has(a.id))) problems.push("Schalentier-Allergen in „" + sp.name + "“ — Regel prüfen");
  }
  for (const e of extras) { const sp = used.get(e.product); Object.assign(e, { weight: sp.weight, values: sp.values, allergens: sp.allergens.map(a => a.name) }); }
  for (const d of dressings) { const sp = used.get(d.product); Object.assign(d, { weight: sp.weight, values: sp.values, allergens: sp.allergens.map(a => a.name) }); }

  // ── Kontrolle 1: Nährwert-/Allergenliste stadtsalat.de/allergene (kcal gerundet, Fett/KH/Eiweiß/Salz/Ballaststoffe, Gewicht) ──
  const num = v => Number(String(v).replace(/ g$/, "").replace(/\./g, "").replace(",", "."));
  const MACRO = { "Fett": "fat", "Kohlenhydrate": "carbs", "Eiweiß": "protein", "Salz": "salt", "Ballaststoffe": "fibre" };
  const allergeneDiffs = [], allergeneMissing = [];
  let allergeneChecked = 0;
  for (const sp of used.values()) {
    const rows = Object.values(allergeneGroups).flatMap(g => g.products).filter(x => lower(x.name) === lower(sp.name));
    if (!rows.length) { allergeneMissing.push(sp.name); continue; }
    const iss = rows.map(row => {
      const out = [];
      if (Math.round(sp.values.kcal) !== row.kcal) out.push("kcal " + row.kcal + " ≠ " + sp.values.kcal);
      for (const m of row.macros || []) { const k = MACRO[m.label]; if (k && Math.abs(num(m.value) - sp.values[k]) > 0.0051) out.push(m.label + " " + m.value + " ≠ " + sp.values[k]); }
      if (Math.round(num(row.portionWeight)) !== Math.round(sp.weight)) out.push("Gewicht " + row.portionWeight + " ≠ " + sp.weight);
      return out;
    }).sort((a, b) => a.length - b.length)[0];
    allergeneChecked++;
    if (iss.length) allergeneDiffs.push(sp.name + ": " + iss.join("; "));
  }

  // ── Kontrolle 2: Konfigurator-Anzeige (data/stadtsalat-konfigurator.json), Rundung wie auf der Seite ──
  const konfigDiffs = [];
  let konfigChecked = 0;
  if (fs.existsSync(KONFIG)) {
    const K = U.readJSON(KONFIG);
    const F = ["weight", "kcal", "fat", "sat", "carbs", "sugars", "fibre", "protein", "salt", "price"];
    const vec = (sp, mult) => [sp.weight * mult, ...["kcal", "fat", "sat", "carbs", "sugars", "fibre", "protein", "salt"].map(k => sp.values[k] * mult), sp.price * mult];
    const shownOf = (i, v) => i === 0 ? Math.round(v) : i === 1 ? Math.floor(v + 1e-9) : Math.round(v * 100) / 100;
    const cmp = (label, shown, raw) => { konfigChecked++; const bad = F.filter((f, i) => Math.abs(shown[i] - shownOf(i, raw[i])) > 0.0051).map(f => f + " " + shown[F.indexOf(f)] + " ≠ " + shownOf(F.indexOf(f), raw[F.indexOf(f)])); if (bad.length) konfigDiffs.push(label + ": " + bad.join(", ")); };
    const spOf = id => used.get(id) || (shopById.get(id) ? shopProduct(shopById.get(id), problems) : null);
    for (const x of K.variants) { const sp = spOf(x.product); if (!sp) { konfigDiffs.push(x.product + " fehlt im Shop"); continue; } cmp(x.dish + " " + (x.protein || ""), x.shown, vec(sp, 1)); }
    for (const x of K.doubleUp) { const a = spOf(x.product), b = spOf(x.addon); cmp("Double up " + x.product, x.shown, vec(a, 1).map((v, i) => v + vec(b, 1)[i])); }
    const base = spOf(K.extras.base);
    for (const x of K.extras.items) {
      const b = spOf(x.addon), e = extras.find(y => y.wolt === x.wolt);
      if (!e || e.product !== x.addon) konfigDiffs.push("Extra " + x.wolt + ": Konfigurator-Produkt " + x.addon + " ≠ Zuordnung " + (e && e.product));
      cmp("Extra " + x.wolt + " ×1", x.x1, vec(base, 1).map((v, i) => v + vec(b, 1)[i]));
      cmp("Extra " + x.wolt + " ×2", x.x2, vec(base, 1).map((v, i) => v + vec(b, 2)[i]));
    }
    const missingDishes = dishes.filter(d => d.bowl).flatMap(d => d.variants.map(v => v.product)).filter(id => !K.variants.some(x => x.product === id));
    if (missingDishes.length) konfigDiffs.push("nicht im Konfigurator abgelesen: " + missingDishes.join(", "));
  } else konfigDiffs.push("data/stadtsalat-konfigurator.json fehlt");

  const shellfish = [...used.values()].filter(sp => sp.allergens.some(a => SHELLFISH_ALLERGENS.has(a.id)) || SHELLFISH_NAME_RE.test(sp.name)).map(sp => sp.name);
  const allergenIds = [...new Set((shop.products || []).flatMap(p => ((p.dietaryInfo || {}).allergens || []).map(a => a.id + " = " + a.name)))].sort();
  const products = Object.fromEntries([...used.values()].map(({ _parts, ...sp }) => [sp.id, sp]));

  const out = {
    _meta: {
      source: "Stadtsalat-Shop-API " + SS_API + " (Lieferstore " + store.id + ", Liefergruppe " + SS_CITY + "; Website " + SS_PAGE + ") + Wolt-API " + WOLT_SLUG + " (" + WOLT_PAGE + ")",
      fetchedAt,
      store: { id: store.id, name: store.name, deliveryTypes: store.deliveryTypes },
      basis: "Offizielle Werte je Portion aus der Shop-API: Gericht je Protein-Variante (ohne Dressing), Extra-Zutat und Dressing je Portion; die Website zeigt genau diese Werte (Konfigurator: Gericht + Add-ons, ohne Dressings)",
      rules: [
        "Wolt: je Gericht ein Artikel; Protein-Wahl (genau 1) bei " + dishes.filter(d => d.proteinGroup).map(d => d.name).join(", "),
        "Wolt: „Dressing (Inklusive)“ Pflicht (genau 1 von " + dressings.length + ", ohne „ohne Dressing“), vorausgewählt = Standard-Dressing des Gerichts",
        "Wolt: „Dressing (Extra)“ je +2,00 €, bis 5 je Dressing, zusammen bis 10 · „Extra Zutaten“ bis 10 je Zutat, zusammen bis 10",
        "Wolt: Preis = Gericht + Protein-Option + Extras (+ Extra-Dressings); die Protein-Aufpreise stehen bei Wolt absolut (Bio-Tofu 0 €), Stadtsalat zeigt sie relativ zur Standard-Wahl",
        "SWEET POTATO SNACK: eigener Wolt-Artikel ohne Optionen",
      ],
      decisions: [
        "User 17.09.2026: Stadtsalat (Wolt) mit den bei Wolt verfügbaren Gerichten " + DISHES.join(", "),
        "User 17.09.2026: Nährwerte von stadtsalat.de; Proteine und Add-ons im Konfigurator einzeln an- und abwählen und die Änderung nehmen (erledigt: data/stadtsalat-konfigurator.json)",
        "User 17.09.2026: Schalter „No dressing“ per Default AN",
      ],
      assumptions: [
        "Wolt-Protein-Option = Stadtsalat-Produkt derselben Variante (Preise identisch: Wolt Gericht + Option = Stadtsalat-Preis)",
        "Wolt-„Extra Zutaten“ = Stadtsalat-Add-on gleichen Namens mit dessen Portion (Preise identisch; im Konfigurator geprüft: Anzeige = Gericht + n × Add-on)",
        "Doppelte Protein-Portion bei Wolt = Protein-Wahl + dasselbe Protein unter „Extra Zutaten“ (Stadtsalat: „Double up!“ = dasselbe Add-on, gleicher Preis)",
        "Wolt-„Dressing (Extra)“ = eine weitere Portion des Dressings laut Shop-API",
      ],
      never: dressings.filter(d => d.never).map(d => d.wolt + " — " + d.never),
      coriander,
      shellfish: shellfish.length ? shellfish : "keine Zutat mit Krebs- oder Weichtieren (Allergen-ids der Shop-API: " + allergenIds.join(", ") + ")",
      anomalies,
      priceDiffs,
      infos,
      crossSell: [...crossSellSeen].map(g => g + " — " + CROSS_SELL[g]),
      allergene: { url: SS_ALLERGENE, checked: allergeneChecked, diffs: allergeneDiffs, notListed: allergeneMissing },
      konfigurator: { file: "data/stadtsalat-konfigurator.json", checked: konfigChecked, diffs: konfigDiffs },
    },
    wolt: { slug: WOLT_SLUG, page: WOLT_PAGE, dishes },
    extras,
    dressings,
    products,
  };

  if (allergeneDiffs.length) problems.push("Allergenliste ≠ Shop-API: " + allergeneDiffs.join(" | "));
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(dishes.length + " Gerichte, " + dishes.reduce((a, d) => a + d.variants.length, 0) + " Varianten, " + extras.length + " Extras, " + dressings.length + " Dressings → " + path.relative(__dirname, OUT));
  for (const d of dishes) console.log("  " + d.name + " (" + d.cat + ", " + d.price + " €): " + d.variants.map(v => (v.protein || "—") + " " + v.price + " € " + Math.round(v.values.kcal) + " kcal").join(" · ") + (d.bowl ? " · Dressing " + d.dressingGroup.default : ""));
  console.log("Extras: " + extras.map(e => e.wolt + " " + e.price + " € (" + e.weight + " g)").join(" · "));
  console.log("Dressings: " + dressings.map(d => d.wolt + " (" + d.weight + " g" + (d.never ? ", NIE" : "") + ")").join(" · "));
  console.log("Preisabweichungen Wolt ↔ Stadtsalat: " + (priceDiffs.length ? priceDiffs.join(" · ") : "keine"));
  console.log("Allergenliste: " + allergeneChecked + " Produkte geprüft, " + allergeneDiffs.length + " Abweichungen" + (allergeneMissing.length ? ", nicht gelistet: " + allergeneMissing.join(", ") : ""));
  console.log("Konfigurator: " + konfigChecked + " Anzeigen geprüft, " + (konfigDiffs.length ? "ABWEICHUNGEN:\n  " + konfigDiffs.join("\n  ") : "alle identisch"));
  console.log("Nie (Minze): " + out._meta.never.join(" · "));
  console.log("Koriander in Gerichten: " + coriander.join(" · "));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Zusatzverkauf (nicht im Tracker): " + out._meta.crossSell.join(" · "));
  if (infos.length) console.log("Hinweise: " + infos.join(" · "));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}

if (require.main === module) main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
