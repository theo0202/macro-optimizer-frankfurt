// Holt die offiziellen Compleat-Nährwerte aus dem Compleat-Onlineshop (compleat.vmos.io, Store Frankfurt Nordend), das
// Wolt-Menü „Build your Bowl" (Compleat Nordend) und liest das im Browser erfasste Uber-Eats-Menü „Selbst zusammenstellen"
// (data/compleat-ubereats-menu.json, siehe ubereats-capture.js) → data/compleat-raw.json (Quelle der Wahrheit, NICHT von Hand
// editieren — Kuratierung passiert in den Tabellen unten). Aufruf: node compleat-crawl.js · danach node compleat-update.js
// Kontrolle gegen den Word-Export des Users: node verify-compleat.js
//
// Datenbasis: vmos liefert je Zutat nutritionalMeta PRO 100 g (bzw. 100 ml) plus defaultQuantity (= Mengenangabe im Namen).
// Portionswerte = pro 100 × Portion / 100 (LMIV-Umrechnung). Die Shop-Anzeige rechnet dagegen mit variations[0].value —
// weicht das von der Portion ab, zeigt der Shop falsche Portionswerte an (→ _meta.displayBugs, z.B. Walnusskerne 7 kcal).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const VMOS = "https://vmos2.vmos.io";
const SHOP = "https://compleat.vmos.io";
const TENANT = "eb292469-02d1-4140-85fd-d083e13398de";          // Compleat
const STORE = "bb51e8b9-3301-4bee-bb33-e063fac5ec64";           // Frankfurt Nordend, Glauburgstraße 5
const FALLBACK_MENU = "9a7bd18b-9542-4768-b85a-c48740da87e9";   // „Menu Compleat 2025Q3 - Categories" (Stand 15.09.2026)
const FALLBACK_BUNDLE = "afaa6fe6-4785-4bd7-b6e0-0ea9d4f12c22"; // „Selbst zusammenstellen"
const BUNDLE_NAME = "Selbst zusammenstellen";
const WOLT_SLUG = "compleat-nordend";
const WOLT_API = "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + WOLT_SLUG + "/assortment";
const WOLT_PAGE = "https://wolt.com/de/deu/frankfurt/restaurant/" + WOLT_SLUG;
const WOLT_ITEM = "Build your Bowl";
const UE_FILE = path.join(__dirname, "data", "compleat-ubereats-menu.json");
const UE_ITEM = "Selbst zusammenstellen";
const OUT = path.join(__dirname, "data", "compleat-raw.json");

const VMOS_GROUPS = { "Base": "base", "Proteine": "proteine", "Vitamine": "vitamine", "Toppings": "toppings", "Dips": "dips" };
const WOLT_GROUPS = { "Deine Basis": "base", "Deine Proteine": "protein", "Deine Extras": "extra", "Dein Dip": "dip" };
const WOLT_NONE = { "Ohne Dip": "dip" }; // „keine Auswahl"-Optionen (0 Makros)
// Uber Eats: Gruppen in Uber-Eats-Reihenfolge; die Getränke-Werbung „Stay hydrated! …" (maxPermitted 0) wird ignoriert
const UE_GROUPS = { "Base": "base", "Proteine": "protein", "Vitamine": "vitamine", "Toppings": "toppings", "Dips": "dip" };
const UE_NONE = { "ohne Dip": "dip" };
// Uber-Eats-Optionen ohne offizielle Nährwerte im Compleat-Shop → nicht im Rechner, nur dokumentiert (keine Schätzungen)
const UE_NO_DATA = {
  "Halbe Limette (50g)": "keine offiziellen Nährwerte im Compleat-Shop (Uber Eats nennt nur „adds 20 Cal.“) → nicht im Rechner",
};

// Wolt-Optionsname (Leerraum normalisiert) → Zutat-id (slug des Shop-Namens ohne Mengenangabe).
// Unbekannte/umbenannte Wolt-Optionen brechen den Crawl ab → Tabelle ergänzen, nicht raten.
// (Uber Eats braucht keine Tabelle: dort heißen die Optionen wie im Shop, inkl. „… - Halbe Portion (125g)".)
const WOLT_MAP = {
  "Basmatireis, 250 g": "basmati_reis", "Salat-Mix, 100 g": "salatmix", "Bunter Quinoa, 250 g": "bunter_bio_quinoa", "Protein Nudeln, 200 g": "protein_pasta",
  "Hähnchen, 100 g": "huehnchen", "Veganes Hähnchen, 80 g": "veganes_huehnchen_planted_chicken", "Vegane Hackbällchen, 100 g": "vegane_hackbaellchen",
  "Rinderhackbällchen, 100 g": "rinderhackbaellchen", "Pulled Salmon, 100 g": "pulled_salmon",
  "Erbsen, 50 g": "erbsen", "Babyspinat, 20 g": "baby_spinat", "Tomaten, 50 g": "tomaten", "Edamame, 50 g": "edamame", "Brokkoli, 100 g": "brokkoli",
  "Avocado, 35 g": "avocado", "Karotten, 50 g": "karotten", "Mais, 50 g": "mais", "Gurken, 50 g": "gurke", "Mango, 70 g": "mango", "Feta, 50 g": "feta_kaese",
  "Rote Beete-Falafel, 100 g": "rote_bete_falafel", "Rotkohl, geraspelt, 50 g": "rotkohl_geraspelt", "Schwarzer Sesam, 3 g": "schwarzer_sesam",
  "Granatapfelkerne, 15 g": "granatapfelkerne", "Erdnüsse, 20 g": "erdnuesse", "Walnusskerne, 20 g": "walnusskerne", "Röstzwiebeln, 20 g": "roestzwiebeln",
  "Chili Gewürz, 1 g": "chili_gewuerz", "Grana Padano, 20 g": "grana_padano",
  "Hart gekochtes Ei, 50 g": "hart_gekochtes_ei", // neu bei Wolt am 15.09.2026 (war in der User-Liste noch nicht enthalten)
  "Curvy Curry Dip": "curvy_curry", "Honey Muscle Mustard Dip": "honey_muscle_mustard", "Joghurt-Salatdressing": "joghurt_salatdressing",
  "Power Peanut Dip": "power_peanut", "Sexy Sesame Dip": "sexy_sesame", "Champion Chili-Dip": "champion_chili", "Protein Tsatsiki Dip": "protein_tzatziki",
  "Guacamole": "guacamole", "Rotes Pesto, 80g": "rotes_pesto", "Ajvar, 100g": "ajvar", "Sojasoße , 20ml": "sojasauce",
  "Olivenöl und halbe Zitrone": "olivenoel_salz_halbe_zitrone", "Balsamico Dressing , 80g": "balsamico_dressing",
};

// Haupt-Proteine: nur sie erfüllen „≥1 Protein" (User 15.09.2026: jede Bowl ≥1 Base + ≥1 Protein), auch als halbe Portion.
// Ei, Edamame, Erbsen und Feta stehen bei Uber Eats unter „Proteine", zählen im Rechner aber wie bei Wolt (dort Extras) als Extras.
const PROTEIN_MAIN = new Set(["huehnchen", "veganes_huehnchen_planted_chicken", "rinderhackbaellchen", "vegane_hackbaellchen", "pulled_salmon"]);

// „No crunch"-Schalter (User 15.09.2026): Nüsse, Röstzwiebeln, Sesam
const CRUNCH = new Set(["erdnuesse", "walnusskerne", "roestzwiebeln", "schwarzer_sesam"]);

// Im Rechner gesperrt — bleibt im Datensatz, wird aber auf KEINER Plattform (Wolt, Uber Eats …) vorgeschlagen,
// gesucht oder als Ausschluss angeboten. compleat-update.js lässt gesperrte Zutaten aus allen Plattform-Menüs weg.
const BLOCKED = {
  bunter_bio_quinoa: "Offizielle Werte unplausibel: 130 kcal / 21,3 g KH / 4,5 g Protein je 250 g (= 52 kcal je 100 g) entsprechen eher 100 g gekochter Quinoa (~120 kcal je 100 g). User 15.09.2026: bleibt im Datensatz, im Rechner ausgeschlossen — auch auf künftigen Plattformen (z.B. Uber Eats).",
};

// Manuell geprüfte Auffälligkeiten der offiziellen Daten (Werte werden NICHT korrigiert, nur dokumentiert)
const MANUAL_ANOMALIES = {
  bunter_bio_quinoa: "Portionswerte unplausibel niedrig (siehe BLOCKED)",
  pulled_salmon: "Ballaststoffe 6 g je 100 g, obwohl die Zutaten nur „LACHS, Speisesalz, Rauch“ sind → Quellfehler, unverändert übernommen",
  honey_muscle_mustard: "Ballaststoffe 35 g je 100 g (28 g je 80 g) bei einem Öl-Wasser-Dip unplausibel → Quellfehler, unverändert übernommen",
  avocado: "217 kcal, 12,5 g Fett, davon 10 g gesättigt je 100 g: kcal passen nicht zu den Makros, der Anteil gesättigter Fettsäuren ist für Avocado untypisch → unverändert übernommen",
  edamame: "Fett 0 g, aber 110 kcal je 100 g passen nicht zu 8,5 g KH + 10 g Protein → Fettangabe fehlt vermutlich, unverändert übernommen",
  olivenoel_salz_halbe_zitrone: "Salz 0 g, obwohl „Salz“ im Namen steht; die Zitrone ist nicht eingerechnet → unverändert übernommen",
  chili_gewuerz: "Alle Nährwerte 0 (1 g Gewürz) → unverändert übernommen",
};

const DISLIKE_RE = /koriander|minze|pfefferminz|cilantro|coriander|\bmint\b/i;
const SHELLFISH_ALLERGENS = new Set(["Krebstiere", "Weichtiere"]);
const PER100 = [["kcal", "calories"], ["fat", "fats"], ["sat", "fatSaturates"], ["carbs", "carbs"], ["sugars", "carbsSugar"], ["fibre", "fibre"], ["protein", "proteins"], ["salt", "salt"]];
const LABEL = { kcal: "Energie", fat: "Fett", sat: "gesättigte Fettsäuren", carbs: "Kohlenhydrate", sugars: "Zucker", fibre: "Ballaststoffe", protein: "Eiweiß", salt: "Salz" };

const vmosHeaders = menu => Object.assign({
  "Accept": "application/json, text/plain, */*", "tenant": TENANT, "store": STORE, "x-requested-from": "online", "locale": "de-DE",
  "Origin": SHOP, "Referer": SHOP + "/", "User-Agent": "Mozilla/5.0",
}, menu ? { menu } : {});
async function getJSON(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url + ": " + text.slice(0, 200));
  return JSON.parse(text);
}
const stripHtml = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const normName = s => String(s || "").replace(/\s+/g, " ").trim();
// "Basmati Reis (250g)" → { base:"Basmati Reis", amount:250, unit:"g" } · "Olivenöl (20ml), Salz & halbe Zitrone" → base "Olivenöl, Salz & halbe Zitrone"
function splitPortion(name) {
  const m = name.match(/\s*\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i);
  if (!m) return { base: name, amount: null, unit: null };
  return { base: normName(name.replace(m[0], "")).replace(/\s+,/g, ","), amount: parseFloat(m[1].replace(",", ".")), unit: m[2].toLowerCase() };
}
// "Hühnchen - Halbe Portion (50g)" → { base:"Hühnchen", amount:50, unit:"g" } (sonst null)
function splitHalf(name) {
  const m = name.match(/^(.*) - Halbe Portion \((\d+(?:[.,]\d+)?)\s*(g|ml)\)$/i);
  return m ? { base: normName(m[1]), amount: parseFloat(m[2].replace(",", ".")), unit: m[3].toLowerCase() } : null;
}

async function discoverMenu() {
  try {
    const j = await getJSON(VMOS + "/catalog/v2/menu", vmosHeaders(null));
    const menus = (j.payload || []).filter(m => /menu compleat/i.test(m.displayName || m.name || "") && !/catering/i.test(m.name || ""));
    if (menus.length) return { uuid: menus[0].uuid, name: menus[0].name, discovered: true };
  } catch (e) { console.warn("  Menü-Suche fehlgeschlagen (" + e.message.slice(0, 80) + ") → Fallback"); }
  return { uuid: FALLBACK_MENU, name: "(Fallback)", discovered: false };
}
async function discoverBundle(menu) {
  try {
    const sk = await getJSON(VMOS + "/catalog/v2/menu/categories/skeleton", vmosHeaders(menu));
    for (const cat of Object.keys(sk.payload || {})) {
      const b = await getJSON(VMOS + "/catalog/categories/" + cat + "/bundles?forceStockStatus=1", vmosHeaders(menu));
      const hit = ((b.payload && b.payload.bundles) || []).find(x => normName(x.name) === BUNDLE_NAME);
      if (hit) return { uuid: hit.uuid, category: cat, discovered: true };
    }
  } catch (e) { console.warn("  Bundle-Suche fehlgeschlagen (" + e.message.slice(0, 80) + ") → Fallback"); }
  return { uuid: FALLBACK_BUNDLE, category: null, discovered: false };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  console.log("vmos: Menü + Bundle suchen …");
  const menu = await discoverMenu();
  const bundle = await discoverBundle(menu.uuid);
  console.log("  Menü " + menu.uuid + " " + menu.name + (menu.discovered ? "" : " [FALLBACK]") + " · Bundle " + bundle.uuid + (bundle.discovered ? "" : " [FALLBACK]"));
  const itemTypes = await getJSON(VMOS + "/catalog/bundles/" + bundle.uuid + "/item-types?forceStockStatus=1", vmosHeaders(menu.uuid));
  const diets = await getJSON(VMOS + "/catalog/diets", vmosHeaders(menu.uuid));
  const allergenName = Object.fromEntries(((diets.payload && diets.payload.allergens) || []).map(a => [a.uuid, normName(a.name)]));
  if (!Object.keys(allergenName).length) throw new Error("Allergenliste leer");

  // ── Zutaten (kompletter Shop-Datensatz „Selbst zusammenstellen") ──
  const ingredients = [], byId = {}, halves = [], problems = [], missingDeclared = [], displayBugs = [], dislikes = [], shellfish = [], halfPortionDiffs = [];
  for (const g of itemTypes.payload || []) {
    const group = VMOS_GROUPS[normName(g.name)];
    if (!group) continue; // „base item type" = das Bundle selbst
    for (const it of g.items || []) {
      const name = normName(it.name), m = it.nutritionalMeta || {};
      if (m.calories == null || m.calories === "") { if (!/^ohne /i.test(name)) problems.push("Keine Nährwerte: " + name); continue; }
      const half = splitHalf(name);
      if (half) { halves.push({ base: half.base, amount: half.amount, name, per100: Object.fromEntries(PER100.map(([k, src]) => [k, m[src] === "" || m[src] == null ? 0 : U.parseNum(Number(m[src]))])) }); continue; }
      const sp = splitPortion(name);
      if (sp.amount == null) { problems.push("Keine Mengenangabe im Namen: " + name); continue; }
      const id = U.slugId(sp.base);
      if (byId[id]) { problems.push("Doppelte Zutat-id " + id + " (" + name + ")"); continue; }
      const per100 = {}, missing = [];
      for (const [k, src] of PER100) {
        if (m[src] === "" || m[src] == null) { per100[k] = 0; missing.push(LABEL[k]); }
        else per100[k] = U.parseNum(Number(m[src]));
      }
      if (missing.length) missingDeclared.push(name + ": " + missing.join(", ") + " nicht angegeben → 0");
      const defQ = Number(m.defaultQuantity);
      if (defQ && defQ !== sp.amount) problems.push(name + ": defaultQuantity " + defQ + " ≠ Name " + sp.amount);
      const variations = ((it.customizations && it.customizations[0] && it.customizations[0].variations) || []).map(v => Number(v.value));
      const displayAmount = variations.length ? variations[0] : sp.amount;
      const allergens = (it.allergens || []).map(uuid => {
        if (!allergenName[uuid]) throw new Error("Unbekannte Allergen-UUID " + uuid + " bei " + name + " — Allergenliste prüfen");
        return allergenName[uuid];
      });
      const zutaten = stripHtml(it.ingredients);
      // Verfügbarkeit wird bewusst NICHT übernommen: die Stock-Felder der API sind nicht eindeutig (ausverkauft = Ausschluss-Liste in der App)
      const ing = {
        id, name: sp.base, shopName: name, group, portion: sp.amount, unit: sp.unit, per100,
        perPortion: Object.fromEntries(U.KEYS.map(k => [k, U.round(per100[k] * sp.amount / 100, 2)])),
        allergens, ingredients: zutaten || null,
        vmos: { uuid: it.itemUUID || it.uuid, displayAmount },
      };
      if (displayAmount !== sp.amount) {
        const shown = Math.round(per100.kcal * displayAmount / 100), real = Math.round(per100.kcal * sp.amount / 100);
        displayBugs.push({ id, shopName: name, shopRechnetMit: displayAmount, portion: sp.amount, unit: sp.unit, shopZeigtKcal: shown, richtigKcal: real });
      }
      if (CRUNCH.has(id)) ing.crunch = true;
      if (BLOCKED[id]) ing.blocked = BLOCKED[id];
      if (allergens.some(a => SHELLFISH_ALLERGENS.has(a))) { ing.shellfish = true; shellfish.push(name + ": " + allergens.join(", ")); }
      if (DISLIKE_RE.test(zutaten)) dislikes.push(name + ": " + (zutaten.match(DISLIKE_RE) || [""])[0] + " in den Zutaten");
      ingredients.push(ing); byId[id] = ing;
    }
  }
  for (const hp of halves) {
    const ing = byId[U.slugId(splitPortion(hp.base).base)] || ingredients.find(x => x.name === hp.base);
    if (!ing) { problems.push("Halbe Portion ohne Basis-Zutat: " + hp.name); continue; }
    ing.halfPortion = hp.amount;
    // Der Rechner nutzt für halbe Portionen die Werte je 100 g der ganzen Portion → die halbe Portion muss dieselben Werte haben.
    // (Abgleich mit den Fertig-Bowls, 16.09.2026: „Bunter Bio Quinoa - Halbe Portion“ hat 0,9 statt 1,8 g Eiweiß je 100 g.)
    const diff = U.KEYS.filter(k => Math.abs(hp.per100[k] - ing.per100[k]) > 1e-9);
    if (diff.length) {
      halfPortionDiffs.push({ id: ing.id, name: hp.name, halb: Object.fromEntries(diff.map(k => [k, hp.per100[k]])), ganz: Object.fromEntries(diff.map(k => [k, ing.per100[k]])) });
      if (!ing.blocked) problems.push("Halbe Portion „" + hp.name + "“ hat andere Werte je 100 g als die ganze Portion (" + diff.map(k => k + " " + hp.per100[k] + " statt " + ing.per100[k]).join(", ") + ") → Rechner würde die Werte der ganzen Portion nutzen: prüfen und entscheiden");
    }
  }
  for (const id of [...CRUNCH, ...Object.keys(BLOCKED), ...Object.keys(MANUAL_ANOMALIES), ...PROTEIN_MAIN]) if (!byId[id]) problems.push("Kuratierte id fehlt im Shop: " + id);

  // ── Wolt-Menü „Build your Bowl" ──
  console.log("Wolt: " + WOLT_SLUG + " …");
  const wa = await getJSON(WOLT_API, { "Accept": "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0" });
  const byo = (wa.items || []).find(i => normName(i.name) === WOLT_ITEM);
  if (!byo) throw new Error("Wolt-Item „" + WOLT_ITEM + "“ nicht gefunden");
  const optById = Object.fromEntries((wa.options || []).map(o => [o.id, o]));
  const woltGroups = [], unmapped = [], portionDiffs = [], portionAssumed = [];
  for (const ref of byo.options || []) {
    const gid = WOLT_GROUPS[normName(ref.name)];
    if (!gid) { problems.push("Unbekannte Wolt-Gruppe: " + ref.name); continue; }
    const cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
    const grp = { id: gid, name: normName(ref.name), min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1, noneOption: null, options: [] };
    // Standard-Option der Gruppe (Wolt-API: default_value). In Pflicht-Gruppen (min ≥ 1) ist sie im Wolt-UI vorausgewählt — deshalb
    // zeigt die Menükarte Grundpreis + Vorauswahl (Build your Bowl: 2 € + Curvy Curry Dip 2 € = 4 €, User-Rückfrage 16.09.2026).
    const wgrp = optById[ref.option_id] || {};
    const dflt = (wgrp.values || []).find(v => v.id === wgrp.default_value);
    if (dflt) grp.defaultOption = { name: normName(dflt.name), price: U.round((dflt.price || 0) / 100, 2) };
    for (const v of wgrp.values || []) {
      const wname = normName(v.name);
      if (WOLT_NONE[wname] === gid) { grp.noneOption = wname; continue; }
      const id = WOLT_MAP[wname];
      if (!id) { unmapped.push(grp.name + ": „" + wname + "“"); continue; }
      const ing = byId[id];
      if (!ing) { problems.push("Wolt-Option „" + wname + "“ → Zutat " + id + " fehlt im Shop"); continue; }
      const am = wname.match(/,\s*(\d+(?:[.,]\d+)?)\s*(g|ml)$/i);
      const amount = am ? parseFloat(am[1].replace(",", ".")) : ing.portion;
      const unit = am ? am[2].toLowerCase() : ing.unit;
      if (unit !== ing.unit) problems.push("Einheit passt nicht: " + wname + " (" + unit + ") vs. " + ing.shopName);
      if (!am) portionAssumed.push("„" + wname + "“: Menge bei Wolt nicht angegeben → Shop-Portion " + ing.portion + " " + ing.unit);
      else if (amount !== ing.portion) portionDiffs.push({ wolt: wname, shop: ing.shopName, woltAmount: amount, shopPortion: ing.portion, unit, factor: U.round(amount / ing.portion, 4) });
      const rawMax = v.multi_choice_config && v.multi_choice_config.total_range ? v.multi_choice_config.total_range.max : 0;
      const role = gid === "protein" ? (PROTEIN_MAIN.has(id) ? "protein" : "extra") : gid;
      grp.options.push({ name: wname, ingredient: id, role, amount, unit, maxQty: Math.max(1, rawMax || 0), price: U.round((v.price || 0) / 100, 2) });
    }
    woltGroups.push(grp);
  }
  if (unmapped.length) problems.push("Nicht zugeordnete Wolt-Optionen (WOLT_MAP ergänzen): " + unmapped.join(" · "));
  const woltItemPrice = U.round((byo.price || 0) / 100, 2);
  // Vorausgewählt ist die Standard-Option jeder PFLICHT-Gruppe (min ≥ 1); in optionalen Gruppen wählt Wolt nichts vor.
  const woltPreselect = woltGroups.filter(g => g.min >= 1 && g.defaultOption).map(g => ({ group: g.id, groupName: g.name, name: g.defaultOption.name, price: g.defaultOption.price }));
  const woltCardPrice = U.round(woltItemPrice + woltPreselect.reduce((sum, x) => sum + x.price, 0), 2);
  const onWolt = new Set(woltGroups.flatMap(g => g.options.map(o => o.ingredient)));
  const notOnWolt = ingredients.filter(x => !onWolt.has(x.id)).map(x => x.shopName);
  // Einträge der WOLT_MAP, die Wolt nicht mehr anbietet (Option entfernt/umbenannt) → sichtbar machen statt still ignorieren
  const woltNames = new Set(woltGroups.flatMap(g => g.options.map(o => o.name)));
  const woltMapUnused = Object.keys(WOLT_MAP).filter(n => !woltNames.has(n));

  // ── Uber Eats „Selbst zusammenstellen" (im Browser erfasst, siehe ubereats-capture.js) ──
  console.log("Uber Eats: " + path.relative(__dirname, UE_FILE) + " …");
  const ue = U.readJSON(UE_FILE);
  if (!ue.item || normName(ue.item.title) !== UE_ITEM) problems.push("Uber-Eats-Erfassung: Item „" + UE_ITEM + "“ fehlt");
  const ueGroups = [], ueNoData = [], uePortionDiffs = [], ueKcalDiffs = [], ueUnknown = [], uePreselect = [];
  for (const g of ue.groups || []) {
    const gname = normName(g.title), gid = UE_GROUPS[gname];
    if (!gid) { if (g.maxPermitted > 0) problems.push("Unbekannte Uber-Eats-Gruppe: " + gname); continue; }
    const grp = { id: gid, name: gname, min: g.minPermitted || 0, max: g.maxPermitted, noneOption: null, options: [] };
    for (const o of g.options || []) {
      const uname = normName(o.title);
      // Vorauswahl bei Uber Eats wäre defaultQuantity > 0 (aktuell keine) → Kartenpreis = Grundpreis
      if ((o.defaultQuantity || 0) > 0) uePreselect.push({ group: gid, groupName: gname, name: uname, price: U.round((o.price || 0) / 100, 2), qty: o.defaultQuantity });
      if (UE_NONE[uname] === gid) { grp.noneOption = uname; continue; }
      if (UE_NO_DATA[uname]) { ueNoData.push(grp.name + ": „" + uname + "“ — " + UE_NO_DATA[uname]); continue; }
      const half = splitHalf(uname);
      const sp = half || splitPortion(uname);
      const id = U.slugId(splitPortion(sp.base).base);
      const ing = byId[id];
      if (!ing) { ueUnknown.push(grp.name + ": „" + uname + "“"); continue; }
      if (sp.amount == null) { problems.push("Uber Eats: keine Mengenangabe: " + uname); continue; }
      if (sp.unit !== ing.unit) problems.push("Uber Eats: Einheit passt nicht: " + uname + " vs. " + ing.shopName);
      const expected = half ? ing.halfPortion : ing.portion;
      if (sp.amount !== expected) uePortionDiffs.push({ ubereats: uname, shop: ing.shopName, ubereatsAmount: sp.amount, shopPortion: expected == null ? null : expected, unit: sp.unit });
      // kcal-Angabe von Uber Eats („adds 330 Cal.") gegen die eigene Rechnung (Rundung toleriert)
      const km = String(o.subtitle || "").match(/adds\s+(\d+(?:[.,]\d+)?)\s*Cal/i);
      const own = ing.per100.kcal * sp.amount / 100;
      if (km && Math.abs(Number(km[1].replace(",", ".")) - own) >= 1) ueKcalDiffs.push({ ubereats: uname, ubereatsKcal: Number(km[1].replace(",", ".")), shopKcal: U.round(own, 1) });
      const role = gid === "protein" ? (PROTEIN_MAIN.has(id) ? "protein" : "extra") : (gid === "vitamine" || gid === "toppings") ? "extra" : gid;
      const opt = { name: uname, ingredient: id, role, amount: sp.amount, unit: sp.unit, maxQty: Math.max(1, o.maxPermitted || 0), price: U.round((o.price || 0) / 100, 2) };
      if (half) opt.half = true;
      grp.options.push(opt);
    }
    ueGroups.push(grp);
  }
  if (ueUnknown.length) problems.push("Uber-Eats-Optionen ohne Shop-Zutat (Namen prüfen oder in UE_NO_DATA begründen): " + ueUnknown.join(" · "));
  // Halbe Portion = halbe Menge zum halben Preis der ganzen? Nur dann ist „halbe Portion höchstens 1× neben der ganzen" im Rechner verlustfrei
  for (const g of ueGroups) for (const o of g.options.filter(x => x.half)) {
    const full = g.options.find(x => !x.half && x.ingredient === o.ingredient);
    if (!full) { problems.push("Uber Eats: halbe Portion ohne ganze Portion in derselben Gruppe: " + o.name); continue; }
    if (U.round(2 * o.amount, 2) !== full.amount || U.round(2 * o.price, 2) !== full.price) problems.push("Uber Eats: 2× „" + o.name + "“ ≠ „" + full.name + "“ (Menge oder Preis) → Regel für halbe Portionen prüfen");
  }
  const ueItemPrice = U.round(((ue.item && ue.item.price) || 0) / 100, 2);
  const ueCardPrice = U.round(ueItemPrice + uePreselect.reduce((sum, x) => sum + x.price * (x.qty || 1), 0), 2);
  const onUE = new Set(ueGroups.flatMap(g => g.options.map(o => o.ingredient)));
  const notOnUberEats = ingredients.filter(x => !onUE.has(x.id)).map(x => x.shopName);

  // ── Auffälligkeiten (automatisch + manuell) ──
  const anomalies = [];
  for (const ing of ingredients) {
    const issues = U.checkItem(ing.perPortion);
    if (MANUAL_ANOMALIES[ing.id]) issues.push(MANUAL_ANOMALIES[ing.id]);
    for (const h of halfPortionDiffs.filter(x => x.id === ing.id)) issues.push("Halbe Portion „" + h.name + "“ hat andere Werte je 100 g: " + Object.keys(h.halb).map(k => k + " " + h.halb[k] + " statt " + h.ganz[k]).join(", ") + " → unverändert übernommen, der Rechner nutzt die Werte der ganzen Portion");
    if (issues.length) anomalies.push({ id: ing.id, name: ing.shopName, issues });
  }

  // Angezeigter Kartenpreis ≠ Grundpreis, wenn die Plattform Pflicht-Optionen vorauswählt (User-Rückfrage 16.09.2026: „Build your Bowl
  // kostet doch 4 €“) — der Rechner rechnet mit Grundpreis + tatsächlich gewählten Optionen und weist im Hinweistext darauf hin.
  const preselectNote = (label, item, base, card, pre, none) => pre.length
    ? label + " zeigt für „" + item + "“ " + card + " € auf der Menükarte, nicht den Grundpreis " + base + " €: in Pflicht-Gruppen ist die Standard-Option vorausgewählt ("
      + pre.map(x => x.groupName + ": „" + x.name + "“ " + x.price + " €").join(", ") + "). Wählt man dort „" + none + "“, steht wieder " + base + " € da (am 16.09.2026 im Web-UI geprüft)."
    : label + ": keine Vorauswahl — die Menükarte zeigt den Grundpreis " + base + " €.";
  const woltCardNote = preselectNote("Wolt", WOLT_ITEM, woltItemPrice, woltCardPrice, woltPreselect, (woltGroups.find(g => g.id === "dip") || {}).noneOption || "Ohne Dip");
  const ueCardNote = preselectNote("Uber Eats", UE_ITEM, ueItemPrice, ueCardPrice, uePreselect, (ueGroups.find(g => g.id === "dip") || {}).noneOption || "ohne Dip");

  const raw = {    _meta: {
      restaurant: "Compleat", store: "Frankfurt Nordend (Glauburgstraße 5, 60318 Frankfurt am Main)", fetchedAt,
      sources: {
        shop: { url: SHOP, api: VMOS, tenant: TENANT, store: STORE, menu: menu.uuid, menuName: menu.name, bundle: bundle.uuid, bundleName: BUNDLE_NAME, discovered: menu.discovered && bundle.discovered },
        wolt: { page: WOLT_PAGE, api: WOLT_API, item: WOLT_ITEM, itemPrice: woltItemPrice, cardPrice: woltCardPrice },
        ubereats: { page: ue.pageUrl, file: "data/compleat-ubereats-menu.json", capturedAt: ue.capturedAt, item: UE_ITEM, itemPrice: ueItemPrice, cardPrice: ueCardPrice, how: "Uber Eats blockt Skript-Abrufe (Cloudflare) → Produktseite im Browser geöffnet, __REACT_QUERY_STATE__ gelesen (ubereats-capture.js)" },
        word: "data/compleat-word.txt = Word-Copy-Paste des Users (Shop-Anzeige, 15.09.2026) → Abgleich: node verify-compleat.js",
      },
      basis: "Shop-Werte pro 100 g/ml (nutritionalMeta); Portionswerte = pro 100 × Portion / 100, Portion = Mengenangabe im Shop-Namen (= defaultQuantity). Wolt-Mengen weichen nur beim Salat-Mix ab → mit Wolt-Menge gerechnet. Uber Eats nutzt die Shop-Namen und -Mengen (inkl. halber Portionen).",
      woltRules: "Deine Basis 0–5 Portionen (Basmatireis/Salat-Mix/Quinoa je bis 4×, Protein Nudeln 1×) · Deine Proteine 0–10 (Hähnchen & Co. je bis 10×, Pulled Salmon 1×) · Deine Extras 0–30 (je 1×) · Dein Dip genau 1 (inkl. „Ohne Dip“). maxQty aus der Wolt-API (0 = Checkbox = 1×), im Wolt-UI am 15.09.2026 per Stepper verifiziert. Grundpreis „Build your Bowl“ " + woltItemPrice + " €. " + woltCardNote,
      ubereatsRules: "Selbst zusammenstellen (Grundpreis " + ueItemPrice + " €): Base, Proteine, Vitamine, Toppings je bis 100 Auswahlen, Dips 1–100 (Pflicht, inkl. „ohne Dip“); je Option Stepper bis 10× (Base) bzw. 5× (sonst). Rechner: Rolle base = Base (auch halbe Portionen) · protein = Haupt-Proteine (Hühnchen, Veganes Hühnchen, Rinder-/Vegane Hackbällchen, Pulled Salmon, auch halb) · extra = Ei, Edamame, Erbsen, Feta (bei Uber Eats unter „Proteine“) + Vitamine + Toppings, je höchstens 1× · dip = höchstens ein Dip. Halbe Portion höchstens 1× neben der ganzen (2 halbe = 1 ganze, gleicher Preis — geprüft). " + ueCardNote,
      decisions: [
        "User 15.09.2026: Bunter Bio Quinoa bleibt im Datensatz, ist aber im Rechner ausgeschlossen (auch künftige Plattformen)",
        "User 15.09.2026: Jede vorgeschlagene Bowl hat ≥1 Base und ≥1 Protein",
        "User 15.09.2026: „No dip“ Default AN, „No crunch“ (Erdnüsse, Walnusskerne, Röstzwiebeln, Schwarzer Sesam) Default AUS",
        "User 15.09.2026: Guacamole normal anbieten (enthält laut Zutatenliste Koriander, im Chat erwähnt)",
        "User 15.09.2026: Optionales Preislimit — keine vorgeschlagene Bestellung liegt über dem eingegebenen Maximalpreis (Grundpreis + Zutaten)",
        "User 15.09.2026: Rechner zusätzlich für Uber Eats („Selbst zusammenstellen“, Grundpreis 1 €)",
        "User 16.09.2026 (Rückfrage „Build your Bowl kostet 4 €“): Grundpreis bleibt " + woltItemPrice + " € — die " + woltCardPrice + " € auf der Wolt-Karte sind Grundpreis + vorausgewählter Dip; der Rechner rechnet Grundpreis + gewählte Optionen und nennt die Vorauswahl im Hinweistext",
      ],
      portionDiffs, portionAssumed, displayBugs, halfPortionDiffs, anomalies, missingDeclared, notOnWolt, woltMapUnused, dislikes, shellfish,
      ubereats: { noData: ueNoData, portionDiffs: uePortionDiffs, kcalDiffs: ueKcalDiffs, notOnUberEats },
      eggNote: "Hart gekochtes Ei: offizielle Shop-Werte (pro 100 g 155 kcal → 77,5 kcal je 50 g) statt der generischen Tabellenwerte aus dem Word-Dokument (78 kcal / 6,3 g P / 0,6 g KH / 5,3 g F je 50 g). Seit 15.09.2026 bei Wolt als Extra „Hart gekochtes Ei, 50 g“ bestellbar.",
    },
    ingredients,
    wolt: { page: WOLT_PAGE, item: WOLT_ITEM, itemPrice: woltItemPrice, cardPrice: woltCardPrice, preselected: woltPreselect, groups: woltGroups },
    ubereats: { page: ue.pageUrl, item: UE_ITEM, itemPrice: ueItemPrice, cardPrice: ueCardPrice, preselected: uePreselect, capturedAt: ue.capturedAt, groups: ueGroups },
  };

  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(raw, null, 2) + "\n", "utf8");

  console.log("\n" + ingredients.length + " Zutaten (" + Object.entries(ingredients.reduce((o, x) => (o[x.group] = (o[x.group] || 0) + 1, o), {})).map(([k, v]) => k + " " + v).join(", ") + ") → " + path.relative(__dirname, OUT));
  console.log("Wolt (Grundpreis " + woltItemPrice + " €): " + woltGroups.map(g => g.name + " " + g.options.length + (g.noneOption ? " + „" + g.noneOption + "“" : "") + " (" + g.min + "–" + g.max + ")").join(" · "));
  console.log("Uber Eats (Grundpreis " + ueItemPrice + " €, erfasst " + ue.capturedAt + "): " + ueGroups.map(g => g.name + " " + g.options.length + (g.noneOption ? " + „" + g.noneOption + "“" : "") + " (" + g.min + "–" + g.max + ")").join(" · "));
  console.log("Vorauswahl: " + woltCardNote);
  console.log("Vorauswahl: " + ueCardNote);
  console.log("Nicht bei Wolt: " + notOnWolt.join(", "));
  console.log("Nicht bei Uber Eats: " + (notOnUberEats.join(", ") || "—"));
  if (woltMapUnused.length) console.log("⚠ WOLT_MAP-Einträge, die Wolt nicht mehr anbietet: " + woltMapUnused.join(", "));
  console.log("Mengen-Abweichungen Wolt ↔ Shop: " + (portionDiffs.map(d => d.wolt + " statt " + d.shopPortion + " " + d.unit + " (×" + d.factor + ")").join(", ") || "keine"));
  console.log("Mengen-Abweichungen Uber Eats ↔ Shop: " + (uePortionDiffs.map(d => d.ubereats + " statt " + d.shopPortion + " " + d.unit).join(", ") || "keine"));
  console.log("Uber Eats ohne offizielle Nährwerte: " + (ueNoData.join(" · ") || "—"));
  console.log("kcal-Angaben Uber Eats ≠ eigene Rechnung: " + (ueKcalDiffs.map(d => d.ubereats + ": UE " + d.ubereatsKcal + " vs. " + d.shopKcal).join(" · ") || "keine"));
  console.log("Halbe Portionen mit anderen Werten je 100 g: " + (halfPortionDiffs.map(h => h.name + " (" + Object.keys(h.halb).map(k => k + " " + h.halb[k] + " statt " + h.ganz[k]).join(", ") + ")").join(", ") || "keine"));
  console.log("Anzeige-Bugs im Shop: " + (displayBugs.map(d => d.shopName + " (rechnet mit " + d.shopRechnetMit + " statt " + d.portion + " " + d.unit + ": " + d.shopZeigtKcal + " statt " + d.richtigKcal + " kcal)").join(", ") || "keine"));
  console.log("Gesperrt: " + ingredients.filter(x => x.blocked).map(x => x.shopName).join(", "));
  console.log("Schalentier-Allergene: " + (shellfish.join(", ") || "keine") + " · Koriander/Minze: " + (dislikes.join(", ") || "keine"));
  console.log("Auffälligkeiten (" + anomalies.length + "): " + anomalies.map(a => a.name).join(", "));
}

main().catch(e => { console.error("FEHLER: " + e.message); process.exit(1); });
