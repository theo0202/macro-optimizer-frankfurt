// Holt die offiziellen Produktdaten des EDEKA-Graf-Onlineshops (graf-ffm.edeka.shop) → data/edeka-raw.json: node edeka-crawl.js
// Quelle je Produkt: die Produktseite des Marktes. Sie liefert alles maschinenlesbar:
//   · <title> „EDEKA | <Name> | online kaufen“ · itemprop="price" · itemprop="sku" (Artikelnummer)
//   · <dl class="attributes"> mit „Nährwertinformationen“ (Bezugsgröße) und den LMIV-Werten **je 100 g**
//   · Info-Liste <span class="listTitle"> mit Abtropfgewicht, Allergenen, Zutatenverzeichnis, Aufbewahrungshinweis
// Rechenbasis (User 19.09.2026): Werte je 100 g × Menge; **bei Konserven zählt das Abtropfgewicht**, sonst die Packungsmenge laut Name.
// Kuratierung steht in den Tabellen unten (CATS, PRODUCTS, BRANDS, VARIABLE, NO_FIBRE_OK). Abbruch bei fehlenden/unlesbaren Werten.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "edeka-raw.json");
const SHOP = "https://graf-ffm.edeka.shop";
const STORE = "EDEKA Graf, Frankfurt am Main";

// Kategorien des Users (Reihenfolge = Reihenfolge der Chips; alle Default an)
const CATS = [
  { id: "carbs", name: "Carbs & bases" },
  { id: "chicken", name: "Cooked chicken & meat" },
  { id: "cottage", name: "Cottage cheese" },
  { id: "vegan", name: "Vegan protein & tofu" },
  { id: "skyr", name: "Skyr & quark" },
  { id: "herbquark", name: "Herb quark" },
  { id: "beans", name: "Beans & chickpeas (tins)" },
  { id: "veg_tins", name: "Edamame, peas & veg (tins)" },
  { id: "fresh_veg", name: "Fresh vegetables" },
  { id: "gyoza", name: "Gyoza" },
  { id: "salads", name: "Fresh salads" },
  { id: "sandwiches", name: "Sandwiches" },
  { id: "bread", name: "Bread & rolls" },
  { id: "coldcuts", name: "Chicken breast slices" },
];

// Produktliste des Users (19.09.2026). Pfad = Produktseite ohne Such-Parameter.
const PRODUCTS = [
  // 1. Carbs and Bases
  ["carbs", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Alnatura-Bio-Schnelle-Mischung-Gerste-Kichererbsen-Linsen-250-g.html"],
  ["carbs", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Reis/Alnatura-Bio-Schnelle-Mischung-Roter-Quinoa-Bulgur-Langkornreis-250-g.html"],
  ["carbs", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Fertiggerichte/Ben-s-Original-Express-Mexikanisch-mit-Quinoa-Bohnen-Bowl-Reis-220-g.html"],
  ["carbs", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Reis/Ben-s-Original-Express-Mediterran-220-g.html"],
  ["carbs", "/Angebote/Nahrungsmittel/Fertiggerichte-Beilagen/Reis/reis-fit-Express-Basmati-Reis-250-g.html"],
  ["carbs", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Reis/Ben-s-Original-Express-Basmatireis-220-g.html"],
  // 2. Gegartes Chicken / Fleisch
  ["chicken", "/Bernard-Matthews-Oldenburg-Haehnchen-Filetstreifen-125-g.html"],
  ["chicken", "/Bernard-Matthews-Oldenburg-Puten-Filetstreifen-125-g.html"],
  ["chicken", "/EDEKA-Herzstuecke-Haehnchenbrust-Filetstuecke-Pikant-150-g-EDEKA.html"],
  ["chicken", "/EDEKA-Herzstuecke-Haehnchenbrust-Filetstueck-Klassik-150-g.html"],
  // 3. Hüttenkäse
  ["cottage", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/GERVAIS-Huetten-Kaese-Original-200-g.html"],
  ["cottage", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Exquisa-Koernige-Frischkaesezubereitung-Fitline-0-3-200-g.html"],
  ["cottage", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/GUT-GUeNSTIG-Koerniger-Frischkaese-Leicht-200-g.html"],
  // 4. Veganer Proteinersatz & Tofu
  ["vegan", "/Taifun-Bio-Raeuchertofu-Mandel-Sesam-200-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/LIKE-Like-Grilled-Chicken-180-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/LIKE-Like-Hack-180-g.html"],
  ["vegan", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Fertiggerichte/Bioasia-Tofu-200-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/Like-MEAT-Like-Chicken-180-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/LIKE-Like-Gyros-180-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/LIKE-Like-Doener-180-g.html"],
  ["vegan", "/Kuehlprodukte-EDEKA/Pflanzliche-Kuehlprodukte/Pflanzliche-Fertiggerichte/planted-Pulled-BBQ-160-g.html"],
  ["vegan", "/Nahrungsmittel-EDEKA/Fertiggerichte-Beilagen/Fertiggerichte/Alnatura-Bio-Tofu-natur-haltbar-200-g.html"],
  // 5. Skyr / Magerquark
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/Schwarzwaldmilch-Protein-Quark-Creme-0-2-Fett-250-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/Andechser-Natur-Bio-Speisequarkzubereitung-0-Fett-250-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/GUT-GUeNSTIG-Speisequark-Magerstufe-250g-250-g-EDEKA.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/GUT-GUeNSTIG-Speisequark-Magerstufe-500g-500-g-EDEKA.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Fruchtjoghurt/Arla-SKYR-Natur-0-2-Fett-450-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/GUT-GUeNSTIG-Skyr-Natur-500-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/EDEKA-Herzstuecke-High-Protein-Skyr-Natur-350-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/Exquisa-Milder-Skyr-Natur-laktosefrei-375-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/LAC-Speisequark-mager-500-g.html"],
  ["skyr", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/LAC-Speisequark-Magerstufe-250-g.html"],
  // 6. Kräuterquark
  ["herbquark", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/GUT-GUeNSTIG-Kraeuterquark-leicht-200g.html"],
  ["herbquark", "/Kuehlprodukte-EDEKA/Eier-Kaese-Molkereiprodukte/Quark-Quarkerzeugnisse/MILRAM-Fruehlingsquark-Activ-14-Fett-185-g.html"],
  // 7. Bohnen / Kichererbsen Konserven
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Weisse-Bohnen-400-g.html"],
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Kidney-Bohnen-400-g.html"],
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/GUT-GUeNSTIG-Kidneybohnen-400-g.html"],
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Kichererbsen-310-g.html"],
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Rapunzel-Bio-Kichererbsen-400-g.html"],
  ["beans", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Rapunzel-Bio-Rote-Kidney-Bohnen-400-g.html"],
  // 8. Edamame / Erbsen / Gemüse Konserven
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/ITA-SAN-Edamame-Sojabohnen-400-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Junge-Erbsen-feine-Auslese-200-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Erbsen-mit-Moehrchen-dampfgegart-305-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/GUT-GUeNSTIG-Junge-Moehrchen-extra-fein-400-g.html"],
  ["veg_tins", "/Proteinreicher-Genuss/EDEKA-Herzstuecke-Edamame-Dampfgegart-140-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/GUT-GUeNSTIG-Junge-Erbsen-mit-Moehrchen-extra-fein-800-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/GUT-GUeNSTIG-Junge-Prinzessbohnen-400-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Moehrchen-zart-extra-fein-400-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Junge-Erbsen-feine-Auslese-400-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Erbsen-mit-Moehrchen-feine-Auslese-200-g.html"],
  ["veg_tins", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Gemuesekonserven/Bonduelle-Goldmais-Bunter-Mix-400-g.html"],
  // 9. Frisches Gemüse
  ["fresh_veg", "/Obst-Gemuese-EDEKA/EDEKA-Herzstuecke-Gemuese-Pur-Karottenstifte-250-g.html"],
  ["fresh_veg", "/Obst-Gemuese-EDEKA/EDEKA-Herzstuecke-Gemuesenudeln-Zucchini-250-g.html"],
  ["fresh_veg", "/Obst-Gemuese-EDEKA/EDEKA-Herzstuecke-Gemuesenudeln-Karotte-250-g.html"],
  ["fresh_veg", "/Obst-Gemuese-EDEKA/Gemuese/Gurken/EDEKA-Herzstuecke-Minigurken-Klasse-I-230g.html"],
  // 10. Gyoza
  ["gyoza", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/EDEKA-Herzstuecke-Gyoza-Haehnchen-150-g.html"],
  ["gyoza", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/EDEKA-Herzstuecke-Gyoza-Gemuese-150-g.html"],
  // 11. Frische Salate (der Cube Salat stand beim User in „Gyoza“ und hier — er ist ein Salat)
  ["salads", "/Kuehlprodukte-EDEKA/Convenience/Salate-to-go/GUT-GUeNSTIG-Roter-Bulgursalat-mit-Suesskartoffel-200-g.html"],
  ["salads", "/Kuehlprodukte-EDEKA/Convenience/Salate-to-go/GUT-GUeNSTIG-Bulgursalat-mit-Kraeutern-200-g.html"],
  ["salads", "/Obst-Gemuese-EDEKA/EDEKA-Herzstuecke-Cube-Salat-Vegan-175-g.html"],
  // 12. Sandwiches
  ["sandwiches", "/Kuehlprodukte-EDEKA/Convenience/Pizza-Sandwich-Baguette/EDEKA-Herzstuecke-Sandwich-Sweet-Chili-Chicken-175-g.html"],
  ["sandwiches", "/Kuehlprodukte-EDEKA/Convenience/Pizza-Sandwich-Baguette/EDEKA-Herzstuecke-Sandwich-Lachs-175-g.html"],
  ["sandwiches", "/Kuehlprodukte-EDEKA/Convenience/Pizza-Sandwich-Baguette/EDEKA-Herzstuecke-Sandwich-Farmerschinken-Mozzarella-175-g.html"],
  // 13. Brot (Poensgen Körnerbrötchen stand zweimal in der Liste)
  ["bread", "/Nahrungsmittel-EDEKA/Brot-Backzutaten/Brot-Gebaeck/Mestemacher-Westfaelischer-Pumpernickel-250-g.html"],
  ["bread", "/Nahrungsmittel-EDEKA/Brot-Backzutaten/Brot-Gebaeck/Poensgen-Koernerbroetchen-glutenfrei-2x75-g.html"],
  ["bread", "/Nahrungsmittel-EDEKA/Brot-Backzutaten/Brot-Gebaeck/Poensgen-Haferbroetchen-glutenfrei-2x75-g.html"],
  ["bread", "/Nahrungsmittel-EDEKA/Brot-Backzutaten/Brot-Gebaeck/EDEKA-Herzstuecke-glutenfreie-Weltmeisterbroetchen-240-g.html"],
  // 14. Hühnerbrustaufschnitt
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/GUT-GUeNSTIG-Haehnchenbrust-100-g.html"],
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/GUT-GUeNSTIG-Haehnchenbrustfilet-150-g.html"],
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/Herta-Finesse-Haehnchenbrust-ofengebacken-100-g.html"],
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/Herta-Finesse-Haehnchenbrust-feinwuerzig-100-g.html"],
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/GUT-GUeNSTIG-Haehnchenbrust-Filetroulade-150-g-EDEKA.html"],
  ["coldcuts", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Salami-Schinken/EDEKA-Herzstuecke-Haehnchenbrust-ofengebacken-100-g.html"],
];

// Marken (längster Treffer am Namensanfang gewinnt) — für „Marke · Produkt“ in der Einkaufsliste
const BRANDS = ["Alnatura", "Andechser Natur", "Arla", "Ben's Original", "Bernard Matthews Oldenburg", "Bioasia", "Bonduelle",
  "EDEKA Herzstücke", "Exquisa", "GERVAIS", "GUT&GÜNSTIG", "Herta Finesse", "ITA-SAN", "LAC", "Like MEAT", "LIKE", "Mestemacher",
  "MILRAM", "planted", "Poensgen", "Rapunzel", "reis-fit", "Schwarzwaldmilch", "Taifun"];

// Produkte, deren Packung mehrere Portionen enthält → im Tracker zählt eine Portion (Gramm frei änderbar).
// Wert = Gramm je Portion + Begründung; alles andere zählt die ganze Packung (bzw. das Abtropfgewicht).
const PORTIONS = {
  "Mestemacher Westfälischer Pumpernickel 250 g": [125, "Packung = 250 g Scheibenbrot; eine Portion = 125 g (ca. 3 Scheiben)"],
  "Poensgen Körnerbrötchen glutenfrei 2x75 g": [75, "Packung = 2 Brötchen à 75 g; eine Portion = 1 Brötchen"],
  "Poensgen Haferbrötchen glutenfrei 2x75 g": [75, "Packung = 2 Brötchen à 75 g; eine Portion = 1 Brötchen"],
  "EDEKA Herzstücke glutenfreie Weltmeisterbrötchen 240 g": [80, "Packung = 240 g (3 Brötchen); eine Portion = 1 Brötchen"],
  "GUT&GÜNSTIG Speisequark Magerstufe 500g 500 g": [250, "500-g-Becher; eine Portion = 250 g wie beim 250-g-Becher"],
  "GUT&GÜNSTIG Skyr Natur 500 g": [250, "500-g-Becher; eine Portion = 250 g"],
  "LAC Speisequark mager 500 g": [250, "500-g-Becher; eine Portion = 250 g"],
  "Arla SKYR Natur 0,2 % Fett 450 g": [225, "450-g-Becher; eine Portion = 225 g"],
  "GUT&GÜNSTIG Junge Erbsen mit Möhrchen extra fein 800 g": [null, "800-g-Dose: Abtropfgewicht laut Seite"],
};

// Produkte ohne Ballaststoff-Angabe sind erlaubt (LMIV: freiwillig) → 0 und in _meta dokumentiert
const NO_FIBRE_OK = true;

const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebs|hummer|lobster|langust|crayfish|muschel|mussel|clam|auster|oyster|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|surimi/i;
const SHELLFISH_ALLERGEN_RE = /krebstier|weichtier/i;
const HERB_RE = /koriander|cilantro|minze|\bmint\b/i;
// Tiefkühl erkennt man am Aufbewahrungshinweis („bei -18 °C“) — Schalter „No frozen food“
const FROZEN_RE = /-\s?18\s?°|tiefgefroren|tiefkühl|gefrierfach/i;

const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", "Accept-Language": "de-DE", Accept: "text/html" };
const ENT = { nbsp: " ", amp: "&", quot: '"', apos: "'", szlig: "ß", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", euro: "€", deg: "°" };
const decode = s => String(s).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&([a-zA-Z]+);/g, (m, n) => (ENT[n] !== undefined ? ENT[n] : m));
const strip = s => decode(String(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const norm = s => String(s).normalize("NFC").replace(/\s+/g, " ").trim();

async function get(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return r.text();
}

// „250,000“ → 250 · „2,5“ → 2.5
const num = (s, what, problems) => {
  const v = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(v);
  if (!isFinite(n)) { problems.push(what + ": Zahl unlesbar („" + s + "“)"); return null; }
  return n;
};

// Menge laut Produktname: „400 g“ · „2x75 g“ · „250g“ · „0,5 l“
function packSize(name, problems) {
  const m = name.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b/i) || name.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\b(?!\s*Fett)/i);
  if (!m) { problems.push(name + ": keine Packungsmenge im Namen"); return null; }
  const unit = (m[3] || m[2]).toLowerCase();
  const val = m[3] ? Number(m[1]) * Number(String(m[2]).replace(",", ".")) : Number(String(m[1]).replace(",", "."));
  const g = unit === "kg" || unit === "l" ? val * 1000 : val;
  return U.round(g, 1);
}

const NUTRIENTS = [
  ["kcal", /^Brennwert in kcal$/],
  ["fat", /^Fett in g$/],
  ["sat", /^Fett, davon gesättigte Fettsäuren in g$/],
  ["carbs", /^Kohlenhydrate in g$/],
  ["sugars", /^Kohlenhydrate, davon Zucker in g$/],
  ["fibre", /^Ballaststoffe in g$/],
  ["protein", /^Eiweiß in g$/],
  ["salt", /^Salz in g$/],
];

function parsePage(html, url, problems) {
  const title = strip((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const name = norm(title.replace(/^EDEKA\s*\|\s*/, "").replace(/\s*\|\s*online kaufen.*$/, ""));
  if (!name) { problems.push(url + ": kein Produktname"); return null; }
  const where = name;

  const attrs = {};
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let m;
  while ((m = re.exec(html))) attrs[norm(strip(m[1]))] = norm(strip(m[2]));

  const info = {};
  const li = /<span class="listTitle">([\s\S]*?)<\/span>([\s\S]*?)<\/li>/g;
  while ((m = li.exec(html))) { const k = norm(strip(m[1])).replace(/:$/, ""); if (!info[k]) info[k] = norm(strip(m[2])); }

  const basis = attrs["Nährwertinformationen"] || "";
  // Unverarbeitetes Obst/Gemüse braucht keine Nährwertkennzeichnung → die Seite nennt keine Werte. Kein Abbruch, aber nicht im Tracker
  const noData = basis ? null : "die Produktseite nennt keine Nährwerte (unverarbeitetes Gemüse ist von der Kennzeichnungspflicht ausgenommen)";
  if (basis && !/je\s*100\s*(g|ml)/i.test(basis)) problems.push(where + ": Bezugsgröße ist nicht „je 100 g“ („" + basis + "“)");

  const per100 = {}, missing = [];
  for (const [key, rx] of NUTRIENTS) {
    const k = Object.keys(attrs).find(x => rx.test(x));
    if (k === undefined) { missing.push(key); per100[key] = 0; continue; }
    const v = num(attrs[k], where + " " + k, problems);
    per100[key] = v == null ? 0 : v;
  }
  if (!noData && missing.some(k => k !== "fibre")) problems.push(where + ": Nährwerte fehlen (" + missing.join(", ") + ")");
  if (!noData && missing.includes("fibre") && !NO_FIBRE_OK) problems.push(where + ": keine Ballaststoffe angegeben");

  const priceRaw = (html.match(/itemprop="price"[^>]*>\s*([\d.,]+)/) || [])[1];
  const price = priceRaw == null ? null : U.round(Number(String(priceRaw).replace(",", ".")), 2);
  if (price == null || !(price > 0)) problems.push(where + ": kein Preis");
  const sku = (html.match(/itemprop="sku"[^>]*content="([^"]+)"/) || [])[1] || null;

  // Abtropfgewicht (Konserven): „Abtropfgewicht: 250,000“ + „Abtropfgewicht Mengeneinheit: g“
  let drained = null;
  if (info["Abtropfgewicht"]) {
    const unit = (info["Abtropfgewicht Mengeneinheit"] || "g").toLowerCase();
    const v = num(info["Abtropfgewicht"], where + " Abtropfgewicht", problems);
    if (v != null) drained = U.round(unit === "kg" ? v * 1000 : v, 1);
  }
  return {
    name, url, sku, price, per100, basis, noData,
    packG: packSize(name, problems), drainedG: drained,
    fibreDeclared: !missing.includes("fibre"),
    allergens: info["Allergene"] || null,
    ingredients: info["Zutatenverzeichnis"] || null,
    legal: info["Rechtliche Bezeichnung"] || null,
    storage: info["Aufbewahrungshinweis"] || null,
    company: info["Anschrift des Unternehmens"] || null,
  };
}

async function main() {
  const problems = [], anomalies = [], infos = [], noFibre = [], coriander = [], shellfish = [], frozen = [], noData = [];
  const items = [], seen = new Set();
  const fetchedAt = new Date().toISOString();

  for (const [cat, p] of PRODUCTS) {
    if (!CATS.some(c => c.id === cat)) { problems.push("Unbekannte Kategorie „" + cat + "“ (" + p + ")"); continue; }
    const url = SHOP + p;
    if (seen.has(url)) { infos.push("Doppelt in der Liste, einmal übernommen: " + p); continue; }
    seen.add(url);
    let html;
    try { html = await get(url); } catch (e) { problems.push(p + ": " + e.message); continue; }
    const d = parsePage(html, url, problems);
    if (!d) continue;
    if (items.some(x => x.name === d.name)) { infos.push("Produkt doppelt (gleicher Name), einmal übernommen: " + d.name); continue; }

    d.cat = cat;
    d.brand = BRANDS.filter(b => d.name.toLowerCase().startsWith(b.toLowerCase())).sort((a, b) => b.length - a.length)[0] || null;
    if (!d.brand) problems.push(d.name + ": Marke nicht erkannt (BRANDS ergänzen)");

    // Menge im Tracker: Abtropfgewicht (Konserve) > kuratierte Portion > Packung laut Name
    const por = PORTIONS[d.name];
    d.portionG = d.drainedG != null ? d.drainedG : por && por[0] != null ? por[0] : d.packG;
    d.portionNote = d.drainedG != null ? "Abtropfgewicht laut Produktseite" : por ? por[1] : "Packungsmenge laut Produktname";
    if (!d.noData && !(d.portionG > 0)) problems.push(d.name + ": keine Menge bestimmbar");

    if (d.noData) noData.push(d.name + " (" + (CATS.find(c => c.id === cat) || {}).name + ", " + (d.price == null ? "?" : d.price.toFixed(2)) + " €) — " + d.noData);
    if (!d.noData && !d.fibreDeclared) noFibre.push(d.name);
    const text = d.name + " " + (d.legal || "") + " " + (d.ingredients || "");
    if (SHELLFISH_RE.test(text) || SHELLFISH_ALLERGEN_RE.test(d.allergens || "")) { d.shellfish = true; shellfish.push(d.name); }
    if (HERB_RE.test(text)) { d.herbs = (text.match(HERB_RE) || [])[0]; coriander.push(d.name + " (" + d.herbs + ")"); }
    if (FROZEN_RE.test(d.storage || "")) { d.frozen = true; frozen.push(d.name); }

    if (!d.noData) { const issues = U.checkItem({ ...d.per100, fibre: d.per100.fibre || 0 }); if (issues.length) anomalies.push({ name: d.name, issues }); }
    items.push(d);
    process.stdout.write(".");
  }
  console.log("");

  const out = {
    _meta: {
      source: "Produktseiten des EDEKA-Graf-Onlineshops " + SHOP + " (" + STORE + "): Name, Preis, Artikelnummer, Nährwerte je 100 g, Abtropfgewicht, Allergene, Zutaten",
      fetchedAt,
      basis: "Offizielle Werte **je 100 g** laut Produktseite × Menge. **Bei Konserven ist die Menge das Abtropfgewicht** (User 19.09.2026), sonst die Packungsmenge laut Produktname bzw. eine kuratierte Portion (PORTIONS). Ballaststoffe sind freiwillig → fehlen sie, steht 0",
      rules: [
        "Nur Produkte, die der Markt im Onlineshop führt; Namen exakt wie dort",
        "Der Tracker rechnet mit Gramm: jedes Produkt startet mit seiner Portion, das Gramm ist im Warenkorb änderbar",
        "Preise = Onlineshop-Preise des Marktes (im Laden können sie abweichen, Angebote wechseln)",
      ],
      decisions: [
        "User 19.09.2026: Supermarkt-Tracker „Edeka Graf (In-Store)“ nach dem Muster des Waitrose-Tabs im London-Tool (Build order + Track basket, Kategorien, Max products, eigene Picks sperren, Must include / Exclude)",
        "User 19.09.2026: Schalter „No frozen food“ (Default AN) — aktuell trägt kein Produkt der Liste einen Tiefkühl-Hinweis",
        "User 19.09.2026: falls relevant immer das Abtropfgewicht rechnen",
        "User 19.09.2026: jedes Produkt verlinkt seine Produktseite (Bild + Wiederfinden im Laden)",
      ],
      store: STORE,
      shop: SHOP,
      cats: CATS,
      portions: Object.fromEntries(items.filter(x => x.drainedG == null && PORTIONS[x.name]).map(x => [x.name, x.portionG + " g — " + x.portionNote])),
      drained: Object.fromEntries(items.filter(x => x.drainedG != null).map(x => [x.name, x.drainedG + " g von " + x.packG + " g"])),
      noData,
      noFibre,
      frozen: frozen.length ? frozen : "kein Produkt mit Tiefkühl-Hinweis",
      shellfish: shellfish.length ? shellfish : "kein Produkt mit Krebs- oder Weichtieren (Lachs = Fisch, erlaubt)",
      coriander: coriander.length ? coriander : "kein Produkt mit Koriander oder Minze in Name, Bezeichnung oder Zutaten",
      anomalies,
      infos,
    },
    cats: CATS,
    items,
  };

  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(items.filter(x => !x.noData).length + " Produkte mit Werten (von " + items.length + ") → " + path.relative(__dirname, OUT));
  for (const c of CATS) {
    const list = items.filter(x => x.cat === c.id && !x.noData);
    console.log("  " + c.name + " (" + list.length + "): " + list.map(x => x.name + " " + x.portionG + " g · " + Math.round(x.per100.kcal * x.portionG / 100) + " kcal · " + x.price.toFixed(2) + " €").join(" · "));
  }
  console.log("Abtropfgewicht genutzt (" + Object.keys(out._meta.drained).length + "): " + Object.entries(out._meta.drained).map(([k, v]) => k + " " + v).join(" · "));
  console.log("Portionen kuratiert (" + Object.keys(out._meta.portions).length + "): " + Object.keys(out._meta.portions).join(" · "));
  console.log("Ohne Nährwerte auf der Seite (" + noData.length + "): " + (noData.join(" · ") || "keine"));
  console.log("Ohne Ballaststoff-Angabe (" + noFibre.length + "): " + (noFibre.join(" · ") || "keine"));
  console.log("Tiefkühl: " + (Array.isArray(out._meta.frozen) ? out._meta.frozen.join(" · ") : out._meta.frozen));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(" · ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.coriander) ? out._meta.coriander.join(" · ") : out._meta.coriander));
  console.log("Auffälligkeiten (" + anomalies.length + "):" + (anomalies.length ? "\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  ") : " keine"));
  if (infos.length) console.log("Hinweise:\n  " + infos.join("\n  "));
}

main().catch(e => { console.error(e); process.exit(1); });
