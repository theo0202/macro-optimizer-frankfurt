// Holt die offiziellen Daten aller prepmymeal-Gerichte → data/prepmymeal-raw.json: node prepmymeal-crawl.js
// Quelle: der Shopify-Shop prepmymeal.com. Die Collection **„ready2go-gerichte-de“** enthält genau die Gerichte, die auf der
// Meal-Box-Seite zur Auswahl stehen (am 19.09.2026 geprüft: dieselben 73 Namen wie die Kacheln, siehe data/prepmymeal-site.json).
// Je Gericht liefert `products.json` die vollständige Produktbeschreibung mit
//   · Nettogewicht („Nettogewicht: 500g“) · Haltbarkeit/Zubereitung · Zutatenverzeichnis
//   · Nährwerttabelle „Pro 100g“ **und** „Portion (500g)“ — bei XL-Gerichten meint die Portionsspalte die **ganze Packung** (2 Portionen)
// Rechenbasis (User 19.09.2026, wie im Edeka-Tab): Werte je 100 g × ganze Packung.
// Kontrolle: die im Browser abgelesenen Kacheln (kcal/Eiweiß/KH/Fett je Portion; XL = halbe Packung) — jede Abweichung bricht ab.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "prepmymeal-raw.json");
const SITE = path.join(__dirname, "data", "prepmymeal-site.json");
const SHOP = "https://prepmymeal.com";
const COLLECTION = "ready2go-gerichte-de";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", "Accept-Language": "de-DE", Accept: "application/json" };

// Schalentier (User-Allergie 13.09.2026) — Gerichte damit kommen nicht in den Tracker
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebstier|hummer|langust|crayfish|muschel|mussel|clam|auster|oyster|jakobsmuschel|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|weichtier|surimi/i;
// Wortteile, die vor dem Schalentier-Test entfernt werden (wie SHELLFISH_SAFE in der App): Austernpilz ist ein Pilz
const SHELLFISH_SAFE = [/(natrium-?)?cyclamat/gi, /austernpilz(e|en)?/gi, /austern-?pilz/gi, /austernseitling(e)?/gi, /oyster mushroom/gi, /muschelnudel(n)?/gi, /muschelpasta/gi];
// Koriander/Minze (User 13.09.2026): nicht sperren, aber melden
const HERB_RE = /koriander|cilantro|minze|\bmint\b/i;

const strip = s => String(s || "").normalize("NFC").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const num = s => { const v = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); const n = Number(v); return isFinite(n) && v !== "" ? n : null; };

// „Fett 3,6g 18g“ → [je 100 g, je Packung] · „<0,5g“ zählt als 0,5
function pair(text, label) {
  const m = text.match(new RegExp(label + "\\s*:?\\s*(<?\\s*[\\d.,]+)\\s*g\\b[^\\d<]{0,12}(<?\\s*[\\d.,]+)\\s*g\\b", "i"));
  return m ? [num(m[1]), num(m[2])] : null;
}
function energyPair(text) {
  const m = text.match(/(?:Energiegehalt|Energie|Brennwert)\s*:?\s*[\d.,]+\s*k?j\s*\/?\s*([\d.,]+)\s*kcal[^\d]{0,14}[\d.,]+\s*k?j\s*\/?\s*([\d.,]+)\s*kcal/i);
  if (m) return [num(m[1]), num(m[2])];
  const m2 = text.match(/(?:Energiegehalt|Energie|Brennwert)\s*:?\s*([\d.,]+)\s*kcal[^\d]{0,14}([\d.,]+)\s*kcal/i);
  return m2 ? [num(m2[1]), num(m2[2])] : null;
}

function parseProduct(p, problems) {
  const name = String(p.title).normalize("NFC").replace(/\s+/g, " ").trim();
  const t = strip(p.body_html);
  const i = t.search(/N(?:ä|ae)hrwert/i);
  if (i < 0) { problems.push(name + ": keine Nährwerttabelle in der Beschreibung"); return null; }
  const tab = t.slice(i);

  const e = energyPair(tab), fat = pair(tab, "Fett(?!\\s*,)"), sat = pair(tab, "davon ges(?:ä|ae)ttigte Fetts(?:ä|ae)uren"),
    carbs = pair(tab, "Kohlenhydrate"), sugars = pair(tab, "davon Zucker"), fibre = pair(tab, "Ballaststoffe"),
    protein = pair(tab, "Eiwei(?:ß|ss)"), salt = pair(tab, "Salz");
  const per100 = { kcal: e && e[0], fat: fat && fat[0], sat: sat && sat[0], carbs: carbs && carbs[0], sugars: sugars && sugars[0], fibre: fibre ? fibre[0] : 0, protein: protein && protein[0], salt: salt && salt[0] };
  const perPack = { kcal: e && e[1], fat: fat && fat[1], sat: sat && sat[1], carbs: carbs && carbs[1], sugars: sugars && sugars[1], fibre: fibre ? fibre[1] : 0, protein: protein && protein[1], salt: salt && salt[1] };
  const missing = U.KEYS.filter(k => per100[k] == null || perPack[k] == null);
  if (missing.length) { problems.push(name + ": Nährwerte unvollständig (" + missing.join(", ") + ")"); return null; }

  const netto = num((t.match(/Nettogewicht\s*:?\s*([\d.,]+)\s*g\b/i) || [])[1]);
  const kg = num((t.match(/Nettogewicht\s*:?\s*([\d.,]+)\s*kg\b/i) || [])[1]);
  const nettoG = netto != null ? netto : kg != null ? kg * 1000 : null;
  // Bezugsgröße der zweiten Tabellenspalte („Portion (450g)“) — auf sie beziehen sich die Werte.
  // Fehlt sie (XL-Gerichte nennen dort keine Gramm), zählt das Nettogewicht der Packung
  const portionG = num((tab.match(/Portion\s*\(?\s*([\d.,]+)\s*g/i) || [])[1]);
  // Welches Gewicht gehört zu den Werten? Das, bei dem „je 100 g × Gewicht“ die Portionsspalte trifft
  // (prepmymeal schreibt beim Rumpsteak 500 g in die Spalte, die Werte gehören aber zum Nettogewicht 445 g)
  const fits = g => g != null && U.KEYS.every(k => Math.abs(per100[k] * g / 100 - perPack[k]) <= Math.max(1, Math.abs(perPack[k]) * 0.06));
  const packG = fits(portionG) ? portionG : fits(nettoG) ? nettoG : portionG != null ? portionG : nettoG;
  if (packG == null) { problems.push(name + ": weder Nettogewicht noch Bezugsgröße der Nährwerttabelle"); return null; }
  const weightFrom = packG === portionG ? "Bezugsgröße der Nährwerttabelle" : "Nettogewicht";
  const portions = /XL[,)]|\(XL/i.test(name) || /(\d+)\s*Portionen/i.test(name) ? num((name.match(/(\d+)\s*Portionen/i) || [])[1]) || 2 : 1;

  const money = v => { const n = Number(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) && n > 0 ? U.round(n, 2) : null; };
  const price = money(((p.variants || [])[0] || {}).price);
  if (price == null) { problems.push(name + ": kein Preis"); return null; }
  const prices = (p.variants || []).map(v => money(v.price)).filter(x => x != null);

  const ing = (t.match(/Zutaten\s*:?\s*([^]*?)(?:\s*N(?:ä|ae)hrwerte|$)/i) || [])[1] || "";
  const prep = (t.match(/Zubereitung\s*:?\s*([^]*?)(?:\s*Zutaten|$)/i) || [])[1] || "";
  const keep = (t.match(/Haltbarkeit\s*:?\s*([^]*?)(?:\s*Zubereitung|$)/i) || [])[1] || "";

  return {
    name, handle: p.handle, url: SHOP + "/products/" + p.handle, price, priceRange: prices.length > 1 ? [Math.min(...prices), Math.max(...prices)] : null,
    packG, weightFrom, portionG, nettoG, portions, per100, perPack, fibreDeclared: !!fibre,
    ingredients: ing.trim(), preparation: prep.trim(), shelfLife: keep.trim(),
    frozen: /tiefk(?:ü|ue)hl|gefrier|tiefgefroren/i.test(t), available: !!((p.variants || [])[0] || {}).available,
    updatedAt: p.updated_at,
  };
}

async function getJSON(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return r.json();
}

async function main() {
  const problems = [], anomalies = [], infos = [], coriander = [], shellfish = [], noFibre = [], siteDiffs = [];
  const site = U.readJSON(SITE);
  const fetchedAt = new Date().toISOString();

  const d = await getJSON(SHOP + "/collections/" + COLLECTION + "/products.json?limit=250");
  const products = (d.products || []).filter(p => !/^CH:/.test(p.title));
  if (!products.length) throw new Error("Collection „" + COLLECTION + "“ liefert keine Produkte");
  console.log(products.length + " Gerichte in der Collection „" + COLLECTION + "“");

  const meals = [];
  for (const p of products) {
    const m = parseProduct(p, problems);
    if (!m) continue;

    // Rechenprobe: Portionsspalte = Werte je 100 g × Packung
    const calc = Object.fromEntries(U.KEYS.map(k => [k, U.round(m.per100[k] * m.packG / 100, 2)]));
    const off = U.KEYS.filter(k => Math.abs(calc[k] - m.perPack[k]) > Math.max(1, Math.abs(m.perPack[k]) * 0.06));
    if (off.length) anomalies.push({ name: m.name, issues: ["Portionsspalte ≠ je 100 g × " + m.packG + " g bei " + off.map(k => k + " (" + m.perPack[k] + " statt " + calc[k] + ")").join(", ")] });

    if (m.nettoG != null && m.portionG != null && Math.abs(m.nettoG - m.portionG) > 1)
      anomalies.push({ name: m.name, issues: ["Nettogewicht " + m.nettoG + " g ≠ Bezugsgröße der Nährwerttabelle " + m.portionG + " g — der Tracker rechnet mit " + m.packG + " g (" + m.weightFrom + "), weil nur damit „je 100 g × Gewicht“ die Werte der Tabelle trifft"] });

    // Plausibilität je 100 g
    const issues = U.checkItem({ ...m.per100 });
    if (issues.length) anomalies.push({ name: m.name, issues });
    if (!m.fibreDeclared) noFibre.push(m.name);

    let text = m.name + " " + m.ingredients;
    for (const re of SHELLFISH_SAFE) text = text.replace(re, " ");
    if (SHELLFISH_RE.test(text)) { m.shellfish = true; shellfish.push(m.name + " — " + (text.match(SHELLFISH_RE) || [])[0]); }
    if (HERB_RE.test(text)) { m.herbs = (text.match(HERB_RE) || [])[0]; coriander.push(m.name + " (" + m.herbs + ")"); }
    meals.push(m);
    process.stdout.write(".");
  }
  console.log("");

  // ── Kontrolle gegen die abgelesenen Kacheln der Box-Seite ──
  const byName = new Map(meals.map(m => [m.name, m]));
  for (const s of site.meals) {
    const m = byName.get(s.name);
    if (!m) { siteDiffs.push(s.name + ": steht auf der Box-Seite, aber nicht in der Collection"); continue; }
    const f = s.xl ? 2 : 1;                                  // Kachel = je Portion, Tabelle = ganze Packung
    for (const k of ["kcal", "protein", "carbs", "fat"]) {
      const shown = s[k] * f, tab = m.perPack[k];
      if (Math.abs(shown - tab) > Math.max(1.5, tab * 0.03)) siteDiffs.push(s.name + ": " + k + " Kachel " + s[k] + (f > 1 ? " ×2 = " + shown : "") + " ≠ Tabelle " + tab);
    }
    if (s.xl && m.portions !== 2) siteDiffs.push(s.name + ": Kachel sagt XL/2 Portionen, der Name nicht");
  }
  for (const m of meals) if (!site.meals.some(s => s.name === m.name)) infos.push("In der Collection, aber nicht auf der abgelesenen Box-Seite: " + m.name);

  const out = {
    _meta: {
      source: "Shopify-Shop " + SHOP + ", Collection „" + COLLECTION + "“ (= die Gerichtsauswahl der Meal-Box) — Produktbeschreibungen mit Nettogewicht, Zutaten und Nährwerttabelle",
      fetchedAt, collection: COLLECTION,
      basis: "Offizielle Werte **je 100 g** der Produktbeschreibung × **ganze Packung** (User 19.09.2026, wie im Edeka-Tab). Bei XL-Gerichten enthält die Packung 2 Portionen — die Nährwerttabelle nennt dort ebenfalls die ganze Packung",
      rules: [
        "Alle Gerichte sind Tiefkühlware („6 Monate in deinem Tiefkühlfach“)",
        "Preis = Einzelpreis des Shops (6er-Box ohne Abo); im EDEKA-Markt kann er abweichen",
        "Kontrolle: die im Browser abgelesenen Kacheln der Meal-Box-Seite (data/prepmymeal-site.json) — bei XL-Gerichten je Portion, also die halbe Packung",
      ],
      decisions: [
        "User 19.09.2026: alle prepmymeal-Gerichte in den Tracker, aber nur mit dem Schalter „Include PrepMyMeal“ berücksichtigen",
        "User 19.09.2026: im Build-Order-Modus nie als automatischer Vorschlag — nur das Gericht, das man gezielt sucht und unter „Build around your own picks“ sperrt (🔒 Lock in)",
        "User 19.09.2026: im Track-Basket-Modus sind alle Gerichte normal auffindbar",
      ],
      siteControl: { file: "data/prepmymeal-site.json", capturedAt: site._meta.capturedAt, checked: site.meals.length, diffs: siteDiffs },
      shellfish: shellfish.length ? shellfish : "kein Gericht mit Krebs- oder Weichtieren (Lachs, Seelachs, Thunfisch = Fisch, erlaubt)",
      coriander: coriander.length ? coriander : "kein Gericht mit Koriander oder Minze in Name oder Zutaten",
      noFibre,
      anomalies,
      infos,
    },
    meals,
  };

  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(meals.length + " Gerichte → " + path.relative(__dirname, OUT));
  console.log("Preise " + Math.min(...meals.map(m => m.price)).toFixed(2) + "–" + Math.max(...meals.map(m => m.price)).toFixed(2) + " € · Packungen " +
    Math.min(...meals.map(m => m.packG)) + "–" + Math.max(...meals.map(m => m.packG)) + " g · XL-Gerichte (2 Portionen): " + meals.filter(m => m.portions > 1).length);
  console.log("Kontrolle Box-Seite: " + site.meals.length + " Kacheln, " + siteDiffs.length + " Abweichungen" + (siteDiffs.length ? ":\n  " + siteDiffs.join("\n  ") : ""));
  console.log("Ohne Ballaststoff-Angabe: " + noFibre.length + " von " + meals.length);
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(" · ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.coriander) ? out._meta.coriander.join(" · ") : out._meta.coriander));
  console.log("Auffälligkeiten (" + anomalies.length + ")" + (anomalies.length ? ":\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  ") : ""));
  if (infos.length) console.log("Hinweise:\n  " + infos.join("\n  "));
}

main().catch(e => { console.error(e); process.exit(1); });
