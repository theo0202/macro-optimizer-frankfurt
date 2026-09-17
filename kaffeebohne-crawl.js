// Die gruene Kaffeebohne (Wolt, Frankfurt Hanauer Landstraße 115) → data/kaffeebohne-raw.json (Quelle der Wahrheit, NICHT von Hand editieren —
// Kuratierung passiert in den Tabellen unten). Aufruf: node kaffeebohne-crawl.js · danach node kaffeebohne-update.js
// Quelle ist allein Wolt: jede Produktbeschreibung nennt „Nährwerte: Protein … | Fett … | Kohlenhydrate … | Kalorien … kcal / … kJ“ für die
// empfohlene Auswahl (Hähnchen, bei Bowls mit Reis), jede Protein- und Kohlenhydrat-Option ihre Änderung, z.B. „vegane Hackbällchen (100g)
// (-5,5 g Protein, +5,4 KH, +1,9 g Fett, +29 kcal, +122kJ)“. Der Pflicht-Dip hat keine Werte (User 17.09.2026: nicht mitzählen). Die Wolt-API
// liefert Beschreibungen und Optionen vollständig — kein Durchklicken nötig. Zur Kontrolle werden die Options-Änderungen mit Compleats
// offiziellem Zutaten-Datensatz verglichen (data/compleat-raw.json; die Kaffeebohne nutzt dieselben Zutaten).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "kaffeebohne-raw.json");
const COMPLEAT_RAW = path.join(__dirname, "data", "compleat-raw.json");
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
const PRIMARY = "die-gruene-kaffeebohne"; // User 17.09.2026
// Wolt-Kategorien (Name ohne Emojis, Großbuchstaben — „ß“ wird dabei „SS“) → Tracker-Kategorie; only = nur diese Produkte
const WOLT_CATEGORIES = {
  "LOW CARB BOWLS": { id: "lowcarb", name: "Low Carb Bowls", on: true },
  "BALANCE BOWLS": { id: "balance", name: "Balance Bowls", on: true },
  "HIGH PROTEIN BOWLS": { id: "highprotein", name: "High Protein Bowls", on: true },
  "FRÜHSTÜCK": { id: "bagels", name: "Bagels", on: true, only: ["Lachs Bagel 36 g Protein", "Green Power Bagel 29 g Protein"] },
};
const SKIPPED_WOLT_CATEGORIES = {
  "BESTECK": "kein Produkt („Benötigst du Besteck?“)", "FRUIT BOWLS": "User 17.09.2026: weglassen", "MATCHA & CO": "User 17.09.2026: weglassen",
  "EIERSPEISEN": "User 17.09.2026: weglassen", "HEISSGETRÄNKE": "User 17.09.2026: weglassen", "ALKOHOLFREIE GETRÄNKE": "User 17.09.2026: weglassen",
};
// Optionsgruppen: Wolt-Name → Art (protein/carbs mit Nährwert-Änderungen, dip ohne Werte)
const GROUPS = { "Wähle deine Proteine aus?": "protein", "Wähle deine Kohlenhydrate?": "carbs", "Wähle dein Dip?": "dip" };
// Optionen (Wolt-Name ohne Änderungsangabe) → Auswahl-id + Kurzname (gleiche Zutat in 100 g / 200 g = eine id, für „Exclude items“)
const CHOICES = {
  "Hähnchen 100g": ["haehnchen", "Hähnchen"], "Hähnchen 200g": ["haehnchen", "Hähnchen"],
  "vegane Hühnchen (100g)": ["vegane_huehnchen", "vegane Hühnchen"], "vegane Hünchen (200g)": ["vegane_huehnchen", "vegane Hühnchen"],
  "vegane Hackbällchen (100g)": ["vegane_hackbaellchen", "vegane Hackbällchen"], "vegane Hackbällchen (200g)": ["vegane_hackbaellchen", "vegane Hackbällchen"],
  "Basmati Reis (250g)": ["basmati_reis", "Basmati Reis"], "Salat Mix (80g) Low Carb": ["salat_mix", "Salat Mix"],
  "Bunter Bio Quinoa (250g)": ["bunter_bio_quinoa", "Bunter Bio Quinoa"], "Süßkartoffel (250g)": ["suesskartoffel", "Süßkartoffel"],
};
// Kontrolle gegen Compleat: Wolt-Option → Compleat-Zutat + Gramm (Änderung = Option − Standard-Option derselben Gruppe)
const COMPLEAT_REF = {
  "Hähnchen 100g": ["Hühnchen", 100], "Hähnchen 200g": ["Hühnchen", 200],
  "vegane Hühnchen (100g)": ["Veganes Hühnchen planted.chicken", 80], "vegane Hünchen (200g)": ["Veganes Hühnchen planted.chicken", 160],
  "vegane Hackbällchen (100g)": ["Vegane Hackbällchen", 100], "vegane Hackbällchen (200g)": ["Vegane Hackbällchen", 200],
  "Basmati Reis (250g)": ["Basmati Reis", 250], "Salat Mix (80g) Low Carb": ["Salatmix", 80], "Bunter Bio Quinoa (250g)": ["Bunter Bio Quinoa", 250], "Süßkartoffel (250g)": ["Süßkartoffel", 250],
};
// Gesperrt (bleibt im Datensatz, nicht im Tracker): veröffentlichte Werte passen nicht zu einer bei Wolt bestellbaren Auswahl bzw. widersprechen sich
// (dem User am 17.09.2026 genannt; auf Wunsch entsperren)
const BLOCKED = {
  "Lean Super Salad 38 g Protein – Low Carb": "Fett 167,7 g ist bei 409 kcal unmöglich (4·KH + 4·E + 9·F = 1703 kcal; mit Compleats Zutaten wären es 16,7 g) — nicht still korrigiert",
  "Vital Boost Bowl 35 g Protein": "605 kcal passen weder zu 1870 kJ (= 447 kcal) noch zu den Makros (410 kcal); die Werte gelten für 125 g Quinoa, bei Wolt ist Basmati Reis (250g) vorausgewählt und Quinoa nur als 250 g wählbar",
  "Classic Bowl 39 g Protein": "Makros (42 g Eiweiß, 47 g KH, 22 g Fett) passen nicht zu 250 g Reis und zum Namen; 605 kcal und 39 g Eiweiß ergeben sich aus Classic Salad + Reis-Option (dann 77 g KH, 14 g Fett) — nicht still korrigiert",
  "Spicy Protein Salad 24 g Protein - Low Carb": "Werte laut Beschreibung für Rinderhack (mager) bzw. Planted Hack — bei Wolt wählbar sind nur Hähnchen, vegane Hühnchen und vegane Hackbällchen (Standard Hähnchen), deren Änderungen sich auf Hähnchen beziehen",
  "Spicy Protein Bowl 31 g Protein": "Werte laut Beschreibung für Rinderhack (mager) bzw. Planted Hack — bei Wolt wählbar sind nur Hähnchen, vegane Hühnchen und vegane Hackbällchen (Standard Hähnchen), deren Änderungen sich auf Hähnchen beziehen",
  "Spicy Protein Bowl 45 g Protein": "Werte laut Beschreibung für 200 g Rinderhack (mager) bzw. 160 g Planted Hack — bei Wolt wählbar sind nur Hähnchen, vegane Hühnchen und vegane Hackbällchen (Standard Hähnchen 200g), deren Änderungen sich auf Hähnchen beziehen",
};
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|krebs|hummer|langust|muschel|auster|tintenfisch|calamar|sepia|oktopus|pulpo|meeresfr/i;
const DISLIKE_RE = /koriander|cilantro|minze|\bmint/i;

const normName = s => String(s || "").normalize("NFC").replace(/[\u00a0\s]+/g, " ").trim();
const catKey = s => normName(s).replace(/[^\p{L}\p{N}& ]/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function get(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return r.json();
}
const signed = s => { const m = String(s).trim().match(/^([+\-−–]?)\s*([\d.,]+)$/); if (!m) throw new Error("Unlesbare Änderung: " + s); return (m[1] && m[1] !== "+" ? -1 : 1) * U.parseNum(m[2]); };
// „Nährwerte: Protein 31,5 g | Fett 7,8 g | Kohlenhydrate 26 g | Kalorien 375 kcal / 1569 kJ“ (Tippfehler „Fetti“, kJ ohne Schrägstrich oder fehlend)
function parseNutrition(desc) {
  const d = String(desc || ""), i = d.search(/Nährwerte\s*:/i);
  if (i < 0) return { error: "keine Nährwert-Angabe" };
  const t = d.slice(i);
  const num = re => { const m = t.match(re); return m ? U.parseNum(m[1]) : null; };
  const v = { protein: num(/Protein\s+([\d.,]+)\s*g/i), fat: num(/Fetti?\s+([\d.,]+)\s*g/i), carbs: num(/Kohlenhydrate\s+([\d.,]+)\s*g/i), kcal: num(/Kalorien\s+([\d.,]+)\s*kcal/i) };
  const miss = Object.keys(v).filter(k => v[k] == null);
  if (miss.length) return { error: "fehlt: " + miss.join(", ") };
  const kj = num(/([\d.,]+)\s*kJ/i);
  const basis = (t.match(/Bei empfohlenem ([^\n]+)/i) || [])[1];
  return { values: v, kJ: kj, basis: basis ? normName(basis) : null };
}
// Option „vegane Hackbällchen (100g) (-5,5 g Protein, +5,4 KH, +1,9 g Fett, +29 kcal, +122kJ)“ → Name + Änderung (ohne Angabe: null)
function parseOption(name) {
  const n = normName(name), m = n.match(/^(.*?)\s*\(([^()]*Protein[^()]*)\)\s*$/);
  if (!m) return { name: n, delta: null };
  const t = m[2], part = re => { const x = t.match(re); if (!x) throw new Error("Änderung unvollständig: " + n); return signed(x[1]); };
  return { name: normName(m[1]), delta: { protein: part(/([+\-−–]?\s*[\d.,]+)\s*g?\s*Protein/i), carbs: part(/([+\-−–]?\s*[\d.,]+)\s*KH/i), fat: part(/([+\-−–]?\s*[\d.,]+)\s*g?\s*Fett/i), kcal: part(/([+\-−–]?\s*[\d.,]+)\s*kcal/i), kJ: part(/([+\-−–]?\s*[\d.,]+)\s*kJ/i) } };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];
  const assort = await get(WOLT_API(PRIMARY), WOLT_HEADERS);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  const products = [], skipped = [], unknownCats = [], dips = new Set();
  for (const c of assort.categories || []) {
    const key = catKey(c.name), def = WOLT_CATEGORIES[key];
    if (!def) { if (SKIPPED_WOLT_CATEGORIES[key]) skipped.push(normName(c.name) + " (" + (c.item_ids || []).length + " Artikel) — " + SKIPPED_WOLT_CATEGORIES[key]); else unknownCats.push(normName(c.name)); continue; }
    for (const id of c.item_ids || []) {
      const it = byItem[id];
      if (!it) continue;
      const name = normName(it.name), price = U.round(it.price / 100, 2);
      if (def.only && !def.only.includes(name)) { skipped.push(name + " (" + price + " €, " + def.name + ") — User 17.09.2026: Frühstück weglassen"); continue; }
      const nut = parseNutrition(it.description);
      if (nut.error) { problems.push("„" + name + "“: Nährwerte " + nut.error); continue; }
      const groups = [];
      for (const ref of it.options || []) {
        const gname = normName(ref.name), kind = GROUPS[gname], g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
        if (!kind) { problems.push("„" + name + "“: unbekannte Optionsgruppe „" + gname + "“ (GROUPS ergänzen)"); continue; }
        if (!(cfg.min === 1 && cfg.max === 1)) problems.push("„" + name + "“: Gruppe „" + gname + "“ ist nicht genau-eine-Auswahl [" + cfg.min + "–" + cfg.max + "]");
        const options = [];
        for (const v of g.values || []) {
          const po = parseOption(v.name), isDefault = v.id === g.default_value;
          const o = { wolt: normName(v.name), name: po.name, price: U.round((v.price || 0) / 100, 2), default: isDefault };
          if (kind === "dip") { if (po.delta) problems.push("Dip mit Nährwerten: " + o.wolt); dips.add(po.name); options.push(o); continue; }
          const ch = CHOICES[po.name];
          if (!ch) { problems.push("„" + name + "“: unbekannte Option „" + po.name + "“ (CHOICES ergänzen)"); continue; }
          o.choice = ch[0]; o.short = ch[1];
          if (isDefault) { if (po.delta) problems.push("„" + name + "“: Standard-Option „" + po.name + "“ mit Änderungsangabe"); if (o.price) problems.push("„" + name + "“: Standard-Option „" + po.name + "“ kostet extra"); }
          else if (!po.delta) { problems.push("„" + name + "“: Option „" + po.name + "“ ohne Nährwert-Änderung"); continue; }
          else {
            o.delta = po.delta;
            if (Math.abs(po.delta.kJ - po.delta.kcal * 4.184) > 6) anomalies.push({ name: "Option " + po.name, issues: ["Änderung " + po.delta.kcal + " kcal ≠ " + po.delta.kJ + " kJ"] });
          }
          options.push(o);
        }
        if (!options.some(o => o.default)) problems.push("„" + name + "“: Gruppe „" + gname + "“ ohne Standard-Option");
        groups.push({ kind, name: gname, min: cfg.min, max: cfg.max, options });
      }
      if (!groups.some(g => g.kind === "dip") && def.id !== "bagels") problems.push("„" + name + "“: keine Dip-Gruppe (Annahme prüfen)");
      const prod = { name, cat: def.id, price, description: normName(String(it.description || "").replace(/\n+/g, " / ")), nutrition: nut.values, kJ: nut.kJ, basis: nut.basis, groups };
      const np = name.match(/(\d+(?:,\d+)?)\s*g Protein/);
      if (np) prod.nameProtein = U.parseNum(np[1]);
      if (BLOCKED[name]) prod.blocked = BLOCKED[name];
      // Plausibilität: Makros ↔ kcal, kcal ↔ kJ, Protein im Namen, Beschreibung ↔ Wolt-Standard
      const issues = U.checkItem({ kcal: nut.values.kcal, fat: nut.values.fat, sat: 0, carbs: nut.values.carbs, sugars: 0, fibre: 0, protein: nut.values.protein, salt: 0 });
      if (nut.kJ != null && Math.abs(nut.kJ / 4.184 - nut.values.kcal) > 6) issues.push(nut.values.kcal + " kcal ≠ " + nut.kJ + " kJ (= " + Math.round(nut.kJ / 4.184) + " kcal)");
      if (prod.nameProtein != null && Math.abs(prod.nameProtein - nut.values.protein) > 1.5) issues.push("Name nennt " + prod.nameProtein + " g Protein, Nährwerte " + nut.values.protein + " g");
      const pg = groups.find(g => g.kind === "protein");
      if (pg && /Rinderhack/i.test(it.description || "") && !pg.options.some(o => /Rind/i.test(o.name))) issues.push("Beschreibung nennt Rinderhack, Wolt bietet " + pg.options.map(o => o.name).join(" / ") + " (Standard " + pg.options.find(o => o.default).name + ")");
      const cg = groups.find(g => g.kind === "carbs");
      if (cg && /Quinoa/i.test((it.description || "").split(/Nährwerte/i)[0]) && !/Quinoa/i.test(cg.options.find(o => o.default).name)) issues.push("Beschreibung nennt Quinoa, bei Wolt ist " + cg.options.find(o => o.default).name + " vorausgewählt");
      if (issues.length) anomalies.push({ name, issues });
      products.push(prod);
    }
  }
  if (unknownCats.length) problems.push("Wolt: unbekannte Kategorie(n) " + unknownCats.map(c => "„" + c + "“").join(", ") + " (WOLT_CATEGORIES oder SKIPPED_WOLT_CATEGORIES ergänzen)");
  for (const n of Object.keys(BLOCKED)) if (!products.some(p => p.name === n)) problems.push("BLOCKED: Produkt „" + n + "“ fehlt");
  for (const [k, def] of Object.entries(WOLT_CATEGORIES)) for (const n of def.only || []) if (!products.some(p => p.name === n)) problems.push("WOLT_CATEGORIES." + k + ": Produkt „" + n + "“ fehlt");
  // Gleiche Option = gleiche Änderung in allen Gerichten
  const deltaByOption = new Map();
  for (const p of products) for (const g of p.groups) for (const o of g.options) if (o.delta) {
    const k = o.name + "|" + (g.options.find(x => x.default) || {}).name, s = JSON.stringify(o.delta);
    if (!deltaByOption.has(k)) deltaByOption.set(k, s); else if (deltaByOption.get(k) !== s) problems.push("Option „" + o.name + "“ hat in „" + p.name + "“ eine andere Änderung");
  }
  // Kontrolle gegen Compleats offizielle Zutaten (Werte je 100 g × Gramm)
  const compleatCheck = [];
  if (fs.existsSync(COMPLEAT_RAW)) {
    const cr = U.readJSON(COMPLEAT_RAW), ing = n => cr.ingredients.find(x => x.name === n);
    const val = (n, grams) => { const x = ing(n); if (!x) return null; return Object.fromEntries(["kcal", "protein", "carbs", "fat"].map(k => [k, x.per100[k] * grams / 100])); };
    const done = new Set();
    for (const p of products) for (const g of p.groups) {
      const d = g.options.find(o => o.default);
      for (const o of g.options) if (o.delta && !done.has(o.name + "|" + d.name)) {
        done.add(o.name + "|" + d.name);
        const a = COMPLEAT_REF[o.name], b = COMPLEAT_REF[d.name], va = a && val(a[0], a[1]), vb = b && val(b[0], b[1]);
        if (!va || !vb) { compleatCheck.push(o.name + ": keine Compleat-Referenz"); continue; }
        const diff = Object.fromEntries(["kcal", "protein", "carbs", "fat"].map(k => [k, U.round(va[k] - vb[k], 2)]));
        const ok = ["protein", "carbs", "fat"].every(k => Math.abs(diff[k] - o.delta[k]) <= 0.15) && Math.abs(diff.kcal - o.delta.kcal) <= 1.5;
        compleatCheck.push(o.name + " statt " + d.name + ": Wolt " + ["kcal", "protein", "carbs", "fat"].map(k => o.delta[k]).join("/") + " · Compleat " + ["kcal", "protein", "carbs", "fat"].map(k => diff[k]).join("/") + (ok ? " → gleich" : " → abweichend"));
      }
    }
  }
  const tracked = products.filter(p => !p.blocked);
  const shellfish = tracked.filter(p => SHELLFISH_RE.test(p.name + " " + p.description)).map(p => p.name);
  const dislikes = tracked.filter(p => DISLIKE_RE.test(p.name + " " + p.description)).map(p => p.name);

  const out = {
    _meta: {
      restaurant: "Die gruene Kaffeebohne", fetchedAt,
      sources: { wolt: { venue: PRIMARY, name: "Die gruene Kaffeebohne (Frankfurt, Hanauer Landstraße 115)", page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY), categories: Object.keys(WOLT_CATEGORIES), skippedCategories: SKIPPED_WOLT_CATEGORIES } },
      basis: "Offizielle Werte aus den Wolt-Produktbeschreibungen der Kaffeebohne, jeweils für die empfohlene Auswahl (Hähnchen, bei Bowls Basmati Reis); Protein- und Kohlenhydrat-Optionen ändern sie um die in der Option angegebenen Werte. Angegeben sind nur kcal, Kohlenhydrate, Eiweiß und Fett — gesättigte Fettsäuren, Zucker, Ballaststoffe und Salz stehen als 0 im Tracker. Der Pflicht-Dip hat keine Werte und zählt nicht mit.",
      notDeclared: ["sat", "sugars", "fibre", "salt"],
      decisions: [
        "User 17.09.2026: Die gruene Kaffeebohne (Wolt) als Tracker; Nährwerte, Bestelloptionen und deren Auswirkungen aus den Produkten",
        "User 17.09.2026: FRUIT BOWLS, MATCHA & CO, FRÜHSTÜCK (außer Lachs Bagel 36 g Protein und Green Power Bagel 29 g Protein), EIERSPEISEN, HEIßGETRÄNKE, ALKOHOLFREIE GETRÄNKE weglassen",
        "User 17.09.2026: Dips haben keine Werte → nie mitzählen; Wolt verlangt einen Dip, der Order Guide sagt: beliebig wählen und weglassen",
      ],
      dips: [...dips],
      blocked: products.filter(p => p.blocked).map(p => p.name + " — " + p.blocked),
      skipped, anomalies, compleatCheck,
      shellfish: shellfish.length ? shellfish : "keine Allergenangabe mit Krebs-/Weichtieren; kein Gericht mit Krebs-/Weichtier-Begriff (Räucherlachs = Fisch, erlaubt)",
      dislikes: dislikes.length ? dislikes : "keine Beschreibung nennt Koriander oder Minze (Dip-Zutaten unbekannt)",
    },
    wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), cats: Object.values(WOLT_CATEGORIES).map(c => ({ id: c.id, name: c.name, on: c.on })), products },
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(products.length + " Gerichte (" + out._meta.blocked.length + " gesperrt) → " + path.relative(__dirname, OUT));
  for (const c of out.wolt.cats) console.log("  " + c.name + ": " + products.filter(p => p.cat === c.id).map(p => p.name + " " + p.price + " €" + (p.blocked ? " [gesperrt]" : "")).join(" · "));
  console.log("Dips (ohne Werte): " + out._meta.dips.join(", "));
  console.log("Gesperrt:\n  " + out._meta.blocked.join("\n  "));
  console.log("Weggelassen: " + skipped.join(" · "));
  console.log("Compleat-Kontrolle:\n  " + compleatCheck.join("\n  "));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}

module.exports = { parseNutrition, parseOption, catKey };

if (require.main === module) main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
