// Burgermeister Frankfurt (Wolt) → data/burgermeister-raw.json: node burgermeister-crawl.js
// Quellen (User 20.10.2026):
//   · offizielle Nährwerttabelle „Burgermeister-Nutrition-Facts-2026_DE.pdf“ (Stand August 2026, verlinkt auf burgermeister.com/menu/,
//     vom User bereitgestellt) → als Text in data/burgermeister-naehrwerte.txt (py -3 -I burgermeister-pdf.py "<PDF>"); je Produkt
//     kcal, Eiweiß, Fett, Kohlenhydrate, davon Zucker, Ballaststoffe, Salz — keine gesättigten Fettsäuren
//   · Wolt-API (Venue „burgermeister-frankfurt“, Client-Version-Header): Artikel, Kategorien, Preise, Optionsgruppen
// À la carte. Die Wolt-Extras mit Werten in der Tabelle (extra Fleisch Patty, Bacon, Käse, Jalapeños, Champignons, gebr. Zwiebeln,
// Veggie Patty) werden eigene Artikel mit `addon` — sie lassen sich nur zusammen mit einem Burger bzw. Fries bestellen, die sie in
// ihrer Wolt-Gruppe anbieten (`addons` am Artikel: Gruppe, Höchstzahl, Wolt-Name je Extra).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "burgermeister-raw.json");
const TABLE = path.join(__dirname, "data", "burgermeister-naehrwerte.txt");
const SLUG = "burgermeister-frankfurt";
const WOLT_API = "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + SLUG + "/assortment?language=de";
const WOLT_PAGE = "https://wolt.com/de/deu/frankfurt/restaurant/" + SLUG;
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };

// Abschnitte der Tabelle (der Abschnitt „BURGERS“ steht in der Kopfzeile „BURGERS EIWEISS FETT SALZ“)
const SECTIONS = ["BURGERS", "FRIES", "COOKIES", "MILKSHAKES", "DRINKS", "EXTRAS"];
const COLS = ["kcal", "protein", "fat", "carbs", "sugars", "fibre", "salt"];   // Reihenfolge der Zahlen je Zeile (burgermeister-pdf.py prüft die Kopfzeile)

// Tracker-Kategorien (Reihenfolge der Chips); Wolt-Kategorien ohne Emojis, großgeschrieben
const CATS = [
  { id: "burger", name: "Burger", wolt: ["WOLT SPECIALS", "BURGER"] },   // der Woltmeister steht bei Wolt unter „Wolt Specials“
  { id: "extras", name: "Extras (on burger or fries)" },                 // Wolt-Optionen, keine Wolt-Kategorie
  { id: "fries", name: "Fries", wolt: ["FRIES"] },
  { id: "sauce", name: "Sauce", wolt: ["SAUCE"] },
  { id: "cookies", name: "Cookies", wolt: ["COOKIES"] },
];
const SKIPPED_CATS = {
  "MENÜ": "Menüs = Burger + Fries + Getränk (Getränk Pflicht-Auswahl, 16,50–19,80 €) — Burger und Fries stehen einzeln im Tracker und sind ohne Getränk günstiger",
  "ALKOHOLFREIE GETRÄNKE": "Getränke — wie bei den anderen Restaurants nicht im Tracker",
  "ALKOHOLISCHE GETRÄNKE": "Getränke (Bier) — nicht im Tracker",
  "SHAKES": "Milchshakes — wie bei McDonald's als Getränke nicht im Tracker (die Tabelle hat Werte)",
};
const WOLT_SKIP = { "Woltmeister Menü": "Menü (Woltmeister + Fries + Getränk) — wie die übrigen Menüs nicht im Tracker" };

// Wolt-Artikel → Zeile der Tabelle („Abschnitt/Name“)
const WOLT_TO_TABLE = {
  "Woltmeister": "BURGERS/WOLTMEISTER",
  "HAMBURGER": "BURGERS/HAMBURGER",
  "CHEESEBURGER": "BURGERS/CHEESEBURGER",
  "CHILI-CHEESEBURGER": "BURGERS/CHILI-CHEESEBURGER",
  "FLEISCHERMEISTER": "BURGERS/FLEISCHERMEISTER",
  "MEISTERBURGER": "BURGERS/MEISTERBURGER",
  "MEISTER ALLER KLASSEN®": "BURGERS/MEISTER ALLER KLASSEN®",
  "HAUSMEISTER®": "BURGERS/HAUSMEISTER®",
  "WALDMEISTER® (VEGGIE)": "BURGERS/WALDMEISTER® (VEGGIE)",
  "FRIES": "FRIES/FRIES (200G)",
  "CHEESE FRIES": "FRIES/CHEESE FRIES (270G)",
  "BACON & ONION FRIES": "FRIES/BACON & ONION FRIES",
  "Chili Fries": "FRIES/CHILI FRIES",
  "PORTION CHEESE SAUCE 70g": "EXTRAS/CHEESE SAUCE",          // 176 kcal = 70 g × 251 kcal je 100 g laut Wolt-Beschreibung
  "BLUEBERRY CHEESECAKE COOKIE": "COOKIES/BLUEBERRY CHEESECAKE",
  "DOUBLE CHOCOLATE PEANUT CHIP COOKIE": "COOKIES/DOUBLE CHOCOLATE PEANUT",
  "CHOCOLATE CHIP WALTNUT COOKIE": "COOKIES/CHOCOLATE CHIP WALNUT",   // so („WALTNUT“) bei Wolt
};
// Wolt-Artikel ohne passende Werte (bleiben draußen, _meta.noData)
const NO_DATA = {
  "PORTION KETCHUP 20ml": "die Tabelle nennt Ketchup mit 14 kcal / 3,2 g KH — das sind etwa 14 g (Wolt: 102 kcal je 100 g), nicht die 20-mL-Portion",
  "PORTION MAYO 20ml": "die Tabelle nennt Mayo mit 44 kcal / 4,5 g Fett — das sind etwa 6 g (Wolt: 700 kcal je 100 g), nicht die 20-mL-Portion",
};

// Extras (Wolt-Optionen) mit Werten in der Tabelle → eigene Artikel mit `addon`
const ADDONS = [
  { id: "patty", name: "extra Fleisch Patty", table: "EXTRAS/PATTY", wolt: ["extra Fleisch Patty"] },
  { id: "veggie_patty", name: "extra Veggie Patty", table: "EXTRAS/VEGGIE PATTY", wolt: ["extra Veggie Patty"] },
  { id: "bacon", name: "extra Bacon Scheibe", table: "EXTRAS/BACON", wolt: ["extra Bacon Scheibe"] },
  { id: "cheese", name: "extra Käse Scheibe", table: "EXTRAS/CHEESE", wolt: ["extra Käse Scheibe"] },
  { id: "jalapenos", name: "extra Jalapeños", table: "EXTRAS/JALAPEÑOS", wolt: ["extra Jalapeños", "EXTRA Jalapenos"] },
  { id: "mushrooms", name: "extra Champignons", table: "EXTRAS/GRILLED MUSHROOMS", wolt: ["extra Champignons"] },
  { id: "onions", name: "extra gebr. Zwiebeln", table: "EXTRAS/GRILLED ONIONS", wolt: ["extra gebr. Zwiebeln"] },
];
// Extras, die es als eigenen Artikel gibt (gleiche Menge, gleicher Preis) → nicht doppelt als Option
const ADDON_AS_ITEM = { "extra Cheesesauce 70g": "PORTION CHEESE SAUCE 70g" };
// Extras ohne Werte in der Tabelle
const ADDON_NO_DATA = {
  "extra geröstete Paprika": "die Tabelle nennt keine Paprika (nur beim Woltmeister wählbar)",
  "Bacon & Onion-Mix": "die Tabelle nennt den Mix nicht (nur die fertigen Bacon & Onion Fries)",
};
// Optionsgruppen der Artikel: Extras (s.o.) oder bewusst ungenutzt
const ADDON_GROUPS = new Set(["Extras", "Extra", "Extras dazu?"]);
const IGNORED_GROUPS = {
  "Ohne": "Zutaten abwählen — die Tabelle nennt nur die Standard-Zusammenstellung",
  "etwas abwählen?": "Zutaten abwählen (Woltmeister) — die Tabelle nennt nur die Standard-Zusammenstellung",
  "some fries...?": "Zusatzverkauf: dieselben Fries gibt es als eigene Artikel",
  "durstig...?": "Zusatzverkauf: Getränke (nicht im Tracker)",
  "Lust auf was Süßes...?": "Zusatzverkauf: dieselben Cookies gibt es als eigene Artikel",
};
const HERB_RE = /koriander|cilantro|minze|\bmint\b/i;
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebs|hummer|lobster|langust|muschel|mussel|auster|oyster|tintenfisch|calamar|squid|sepia|oktopus|octopus|meeresfr|weichtier/i;

const clean = s => String(s || "").replace(/[^\p{L}\p{N}& ]/gu, " ").replace(/\s+/g, " ").trim().toUpperCase();
const stripTraces = s => String(s || "").replace(/kann spuren[^.]*\.?/gi, " ");

// Tabelle: Namenszeile(n), dann Zahlenzeile „[(Zusatz)] kcal Eg Fg KHg Zg Bg Sg“
function parseTable(text, problems) {
  const rows = [];
  let section = null, pending = [], stand = null;
  const NUM = /^(?:\((.+)\)\s+)?(\d+)\s+((?:\d+(?:,\d+)?g\s+){5}\d+(?:,\d+)?g)$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^=== SEITE/.test(line)) continue;
    if (/^NÄHRWERTTABELLE$|^ENERGIE |^\(KCAL\) /.test(line)) continue;
    if (/^BURGERS /.test(line)) { section = "BURGERS"; pending = []; continue; }
    if (SECTIONS.includes(line)) { section = line; pending = []; continue; }
    const foot = line.match(/^Burgermeister® \| (\d{4}) \|.*?([A-ZÄÖÜ]+ \d{4})$/);
    if (foot) { stand = foot[2]; continue; }
    const m = line.match(NUM);
    if (!m) { pending.push(line); continue; }
    if (!section) { problems.push("Tabelle: Werte vor dem ersten Abschnitt: " + line); continue; }
    if (!pending.length) { problems.push("Tabelle: Zahlenzeile ohne Namen: " + line); continue; }
    const nums = [m[2], ...m[3].trim().split(/\s+/).map(x => x.replace(/g$/, ""))];
    if (nums.length !== COLS.length) { problems.push("Tabelle: " + pending.join(" ") + ": " + nums.length + " Werte"); continue; }
    const values = {};
    COLS.forEach((k, i) => { values[k] = U.parseNum(nums[i]); });
    rows.push({ section, name: pending.join(" "), qualifier: m[1] || null, values, key: section + "/" + pending.join(" ") });
    pending = [];
  }
  if (pending.length) problems.push("Tabelle: Zeilen ohne Werte am Ende: " + pending.join(" | "));
  if (!stand) problems.push("Tabelle: Stand (Fußzeile) nicht gefunden");
  return { rows, stand };
}

// kcal aus der Wolt-Beschreibung („Brennwert: 2901 KJ / 693 kcal“ bzw. „Energie: …“) — nur zum Vergleich
function woltKcal(desc) {
  const m = String(desc || "").match(/(?:Brennwert|Energie):\s*[\d.,]+\s*k?J\s*\/\s*([\d.,]+)\s*kcal/i);
  return m ? U.parseNum(m[1]) : null;
}

async function main() {
  const problems = [], anomalies = [], noData = [], coriander = [], shellfish = [], mapping = [], woltKcalDiffs = [], optionDefaults = [];
  const tableText = fs.readFileSync(TABLE, "utf8");
  const { rows, stand } = parseTable(tableText, problems);
  const byKey = {};
  for (const r of rows) {
    if (byKey[r.key]) problems.push("Tabelle: " + r.key + " doppelt");
    byKey[r.key] = r;
    const v = r.values, issues = U.checkItem({ kcal: v.kcal, fat: v.fat, sat: 0, carbs: v.carbs, sugars: v.sugars, fibre: v.fibre, protein: v.protein, salt: v.salt });
    if (issues.length) anomalies.push({ name: r.key, issues });
  }

  const res = await fetch(WOLT_API, { headers: WOLT_HEADERS });
  if (!res.ok) throw new Error("Wolt-API: HTTP " + res.status);
  const a = await res.json();
  const itemsById = Object.fromEntries((a.items || []).map(i => [i.id, i]));
  const optById = Object.fromEntries((a.options || []).map(o => [o.id, o]));
  const addonByWolt = {};
  for (const ad of ADDONS) for (const n of ad.wolt) addonByWolt[n] = ad;
  const addonPrices = {}, addonHolders = {};
  const cats = [], items = [], seen = new Set(), usedTable = new Set(), woltCats = [], skippedItems = [];
  for (const c of a.categories || []) {
    const wname = clean(c.name);
    woltCats.push(c.name);
    if (SKIPPED_CATS[wname]) continue;
    const cat = CATS.find(x => (x.wolt || []).includes(wname));
    if (!cat) { problems.push("Unbekannte Wolt-Kategorie „" + c.name + "“ (CATS oder SKIPPED_CATS ergänzen)"); continue; }
    for (const iid of c.item_ids || []) {
      const w = itemsById[iid];
      if (!w) { problems.push("Kategorie „" + c.name + "“: Artikel " + iid + " ohne Daten (Client-Version-Header?)"); continue; }
      if (seen.has(w.name)) continue;
      seen.add(w.name);
      if (WOLT_SKIP[w.name]) { skippedItems.push(w.name + " — " + WOLT_SKIP[w.name]); continue; }
      const price = U.round(w.price / 100, 2);
      const desc = (w.description || "").replace(/\s+/g, " ").trim();
      const item = { name: w.name, cat: cat.id, woltCat: c.name, price, description: desc };
      const wk = woltKcal(desc);
      if (wk != null) item.woltKcal = wk;
      if (NO_DATA[w.name]) { noData.push(w.name + " (" + c.name + ", " + price.toFixed(2) + " €) — " + NO_DATA[w.name]); item.noData = NO_DATA[w.name]; items.push(item); continue; }
      const tk = WOLT_TO_TABLE[w.name];
      if (!tk) { problems.push("Wolt-Artikel ohne Zuordnung: „" + w.name + "“ (" + c.name + ") — WOLT_TO_TABLE, NO_DATA oder WOLT_SKIP ergänzen"); continue; }
      const row = byKey[tk];
      if (!row) { problems.push(w.name + ": Tabellen-Zeile „" + tk + "“ fehlt"); continue; }
      usedTable.add(tk);
      item.table = tk;
      item.values = { ...row.values };
      if (row.qualifier) item.qualifier = row.qualifier;
      if (cat.id === "sauce") item.sauce = true;
      if (clean(w.name) !== clean(row.name).replace(/ \(\d+G\)$/, "")) mapping.push(w.name + " = " + row.name + (row.qualifier ? " (" + row.qualifier + ")" : ""));
      // kcal laut Wolt-Beschreibung (Saucen: je 100 g) gegen die Tabelle
      if (wk != null) {
        const grams = cat.id === "sauce" ? Number((w.name.match(/(\d+)\s*g\b/i) || [])[1]) : null;
        const cmp = grams ? U.round(wk * grams / 100, 1) : wk;
        if (Math.abs(cmp - row.values.kcal) > 5) woltKcalDiffs.push(w.name + ": Wolt " + (grams ? wk + " kcal je 100 g → " + cmp + " kcal" : cmp + " kcal") + " · Tabelle " + row.values.kcal + " kcal");
      }
      const allergenText = stripTraces((desc.match(/Allergene:([^]*?)(?:Zusatzstoff|$)/i) || [])[1] || "");
      if (SHELLFISH_RE.test(w.name + " " + stripTraces(desc)) || /krebstier|weichtier/i.test(allergenText)) { item.shellfish = true; shellfish.push(w.name); }
      if (HERB_RE.test(desc)) coriander.push(w.name + " (" + desc.match(HERB_RE)[0] + ")");
      // Optionsgruppen
      const addons = [];
      for (const o of w.options || []) {
        const def = optById[o.option_id] || {};
        const gname = String(o.name || def.name || "").trim();
        const range = ((o.multi_choice_config || def.multi_choice_config || {}).total_range) || {};
        const values = def.values || [];
        if ((range.min || 0) > 0) problems.push(w.name + ": Pflicht-Gruppe „" + gname + "“ (min " + range.min + ") — im Tracker nicht vorgesehen");
        const dflt = [].concat(def.default_value != null ? def.default_value : []);
        const pre = values.filter(v => dflt.includes(v.id));
        if (pre.length) optionDefaults.push(w.name + ": „" + gname + "“ vorausgewählt: " + pre.map(v => v.name).join(", "));
        if (IGNORED_GROUPS[gname]) continue;
        if (!ADDON_GROUPS.has(gname)) { problems.push(w.name + ": unbekannte Optionsgruppe „" + gname + "“ (ADDON_GROUPS oder IGNORED_GROUPS ergänzen)"); continue; }
        const opts = {};
        for (const v of values) {
          const vname = String(v.name || "").trim(), vprice = U.round((v.price || 0) / 100, 2);
          const vmax = (((v.multi_choice_config || {}).total_range) || {}).max;
          if (ADDON_AS_ITEM[vname]) {
            const twin = (a.items || []).find(x => x.name === ADDON_AS_ITEM[vname]);
            if (!twin || U.round(twin.price / 100, 2) !== vprice) problems.push(w.name + ": „" + vname + "“ kostet " + vprice.toFixed(2) + " €, der Artikel „" + ADDON_AS_ITEM[vname] + "“ " + (twin ? (twin.price / 100).toFixed(2) + " €" : "fehlt"));
            continue;
          }
          if (ADDON_NO_DATA[vname]) continue;
          const ad = addonByWolt[vname];
          if (!ad) { problems.push(w.name + " / „" + gname + "“: unbekanntes Extra „" + vname + "“ (ADDONS, ADDON_AS_ITEM oder ADDON_NO_DATA ergänzen)"); continue; }
          if (vmax !== 1) problems.push(w.name + " / „" + vname + "“: bis " + vmax + "× wählbar — der Tracker nimmt jedes Extra höchstens 1× je Artikel");
          if (addonPrices[ad.id] != null && addonPrices[ad.id] !== vprice) problems.push("Extra „" + ad.name + "“ mit verschiedenen Preisen: " + addonPrices[ad.id].toFixed(2) + " € und " + vprice.toFixed(2) + " € (" + w.name + ")");
          addonPrices[ad.id] = vprice;
          opts[ad.id] = vname;
          (addonHolders[ad.id] = addonHolders[ad.id] || []).push(w.name);
        }
        if (Object.keys(opts).length) addons.push({ group: gname, max: range.max, opts });
      }
      if (addons.length) item.addons = addons;
      items.push(item);
    }
  }
  for (const k of Object.keys(WOLT_TO_TABLE)) if (!seen.has(k)) problems.push("WOLT_TO_TABLE: „" + k + "“ gibt es bei Wolt nicht mehr");
  for (const k of Object.keys(NO_DATA)) if (!seen.has(k)) problems.push("NO_DATA: „" + k + "“ gibt es bei Wolt nicht mehr");

  // Extras: Werte aus der Tabelle, Preis von Wolt; nur Extras, die mindestens ein Artikel im Tracker anbietet
  const addons = [];
  for (const ad of ADDONS) {
    const row = byKey[ad.table];
    if (!row) { problems.push("Extra „" + ad.name + "“: Tabellen-Zeile „" + ad.table + "“ fehlt"); continue; }
    if (!addonHolders[ad.id]) { problems.push("Extra „" + ad.name + "“: kein Artikel bietet es an (ADDONS prüfen)"); continue; }
    usedTable.add(ad.table);
    addons.push({ id: ad.id, name: ad.name, table: ad.table, tableName: row.name + (row.qualifier ? " (" + row.qualifier + ")" : ""), values: { ...row.values }, price: addonPrices[ad.id], holders: addonHolders[ad.id] });
  }
  const NOT_USED = {
    "BURGERS/LIEFERANDOMEISTER": "nur bei Lieferando",
    "EXTRAS/MAYO": "Menge der Tabelle (≈ 6 g) ≠ Wolt-Portion 20 mL",
    "EXTRAS/KETCHUP": "Menge der Tabelle (≈ 14 g) ≠ Wolt-Portion 20 mL",
    "EXTRAS/PROTEINPULVER (30G)": "Extra zum Milchshake (Shakes nicht im Tracker)",
    "EXTRAS/SAHNE (25G)": "Extra zum Milchshake (Shakes nicht im Tracker)",
  };
  const notOnWolt = rows.filter(r => !usedTable.has(r.key)).map(r => r.key.replace("/", ": ") + " — " + (NOT_USED[r.key] || (r.section === "MILKSHAKES" || r.section === "DRINKS" ? "Getränk (nicht im Tracker)" : "nicht bei Wolt")));
  for (const k of Object.keys(NOT_USED)) if (!byKey[k]) problems.push("NOT_USED: Tabellen-Zeile „" + k + "“ gibt es nicht");
  for (const cat of CATS) if (cat.id === "extras" ? addons.length : items.some(x => x.cat === cat.id && !x.noData)) cats.push({ id: cat.id, name: cat.name });

  const out = {
    _meta: {
      source: "Burgermeister-Nährwerttabelle (PDF „Burgermeister-Nutrition-Facts-2026_DE.pdf“, Stand " + (stand || "?") + ", als data/burgermeister-naehrwerte.txt) + Wolt-API Venue „" + SLUG + "“ (Namen, Kategorien, Preise, Optionen)",
      table: { file: "data/burgermeister-naehrwerte.txt", stand, url: "https://burgermeister.com/downloads/2026/Burgermeister-Nutrition-Facts-2026_DE.pdf", rows: rows.length,
        check: "am 20.10.2026: das PDF des Users trägt dieselbe Fußzeile wie das auf burgermeister.com/menu/ verlinkte (Last-Modified 24.08.2026); Spalten über die Kopfzeile geprüft" },
      fetchedAt: new Date().toISOString(),
      basis: "Offizielle Werte je Produkt laut Nährwerttabelle (Burger „pro Stück“ in der Standard-Zusammenstellung samt Saucen, Fries je Portion, Extras je Portion). Gesättigte Fettsäuren nennt die Tabelle nicht → 0",
      notDeclared: ["sat"],
      rules: [
        "Nur Artikel, die es bei Wolt gibt; Namen und Preise wie bei Wolt",
        "Wolt-Extras mit Werten in der Tabelle sind eigene Artikel mit `addon`: nur zusammen mit einem Artikel, der sie in seiner Wolt-Gruppe anbietet (Burger bzw. Fries), je Artikel höchstens 1× und höchstens so viele wie die Gruppe erlaubt",
        "„Ohne …“-Optionen, Zusatzverkauf-Gruppen und Menüs werden nicht genutzt",
      ],
      decisions: [
        "User 20.10.2026: Burgermeister (Wolt, Frankfurt) als Tracker mit der Nährwerttabelle 2026 (PDF vom User); auch in der Freunde-Version sichtbar",
      ],
      assumptions: [
        "Kategorien Burger (mit dem Woltmeister aus „Wolt Specials“), Extras, Fries, Sauce, Cookies; Menüs, Getränke und Milchshakes nicht im Tracker",
        "Schalter „No sauces“ (Cheese-Sauce-Becher) und „No desserts“ (Cookies) starten AN — wie bei Fit Kitchen und beets&roots",
        "Extras = die Zeilen „EXTRAS“ der Tabelle (Patty 255 kcal / 21,5 g Eiweiß …); „extra Cheesesauce 70g“ = der Artikel „PORTION CHEESE SAUCE 70g“ (gleiche Menge, gleicher Preis)",
        "Die kcal-Angaben der Wolt-Beschreibungen weichen bei den meisten Artikeln ab — der Tracker nimmt die offizielle Tabelle (Stand August 2026)",
      ],
      venue: { slug: SLUG, page: WOLT_PAGE, categories: woltCats },
      skippedCategories: SKIPPED_CATS,
      skippedItems,
      ignoredGroups: IGNORED_GROUPS,
      addonAsItem: ADDON_AS_ITEM,
      addonNoData: ADDON_NO_DATA,
      mapping,
      noData,
      notOnWolt,
      woltKcal: { note: "kcal laut Wolt-Beschreibung (Saucen je 100 g) ≠ Tabelle — Tracker = Tabelle", diffs: woltKcalDiffs },
      // Die Wolt-API nennt für die optionalen Gruppen (min 0) ein default_value, das auf eine Option zeigt (z.B. HAMBURGER „Extras“: extra Bacon Scheibe) —
      // wie bei Compleat, Lorys und Fit Kitchen KEINE Vorauswahl: die Wolt-Karte zeigt am 20.10.2026 genau den Artikelpreis (HAMBURGER 7,00 € statt 8,20 €,
      // WALDMEISTER 9,10 € statt 13,10 €, FRIES 4,90 € statt 7,70 €); das Bestellfenster öffnet Wolt nur nach Anmeldung
      optionDefaults: { note: "default_value optionaler Gruppen — keine Vorauswahl (Wolt-Karte 20.10.2026: Kartenpreis = Artikelpreis)", list: optionDefaults },
      shellfish: shellfish.length ? shellfish : "kein Artikel mit Krebs- oder Weichtieren (Namen, Beschreibungen und Allergen-Angaben der Wolt-Artikel)",
      coriander: coriander.length ? coriander : "keine Wolt-Beschreibung nennt Koriander oder Minze (Chipotle-, Barbecue- und Chili-Saucen ohne Gewürzangabe)",
      anomalies,
    },
    table: rows,
    addons,
    wolt: { slug: SLUG, page: WOLT_PAGE, cats, items },
  };
  if (problems.length) { console.error("PROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  const withData = items.filter(x => !x.noData);
  console.log(withData.length + " Wolt-Artikel mit Werten (von " + items.length + ") + " + addons.length + " Extras → " + path.relative(__dirname, OUT) + " (Tabelle " + rows.length + " Zeilen, Stand " + stand + ")");
  for (const c of cats) {
    const list = c.id === "extras" ? addons.map(x => ({ name: x.name, values: x.values, price: x.price })) : withData.filter(x => x.cat === c.id);
    console.log("  " + c.name + " (" + list.length + "): " + list.map(x => x.name + " " + x.values.kcal + " kcal / P " + x.values.protein + " · " + x.price.toFixed(2) + " €").join(" · "));
  }
  console.log("Extras je Artikel: " + withData.filter(x => x.addons).map(x => x.name + " [" + x.addons.map(g => g.group + " ≤" + g.max + ": " + Object.keys(g.opts).join(",")).join("; ") + "]").join(" · "));
  console.log("Ohne Werte (" + noData.length + "): " + noData.join(" · "));
  console.log("Übersprungen: " + skippedItems.join(" · ") + " · Kategorien " + Object.keys(SKIPPED_CATS).join(", "));
  console.log("Tabelle ohne Wolt-Artikel: " + notOnWolt.join(" · "));
  console.log("Zuordnung: " + mapping.join(" · "));
  console.log("Wolt-kcal ≠ Tabelle (" + woltKcalDiffs.length + "): " + woltKcalDiffs.join(" · "));
  console.log("default_value optionaler Gruppen (keine Vorauswahl): " + optionDefaults.length);
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(" · ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.coriander) ? out._meta.coriander.join(" · ") : out._meta.coriander));
  console.log("Auffälligkeiten (" + anomalies.length + "):" + (anomalies.length ? "\n  " + anomalies.map(x => x.name + ": " + x.issues.join("; ")).join("\n  ") : " keine"));
}

module.exports = { CATS, WOLT_TO_TABLE, NO_DATA, ADDONS, parseTable };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
