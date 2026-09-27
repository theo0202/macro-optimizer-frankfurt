// Chidoba Frankfurt (Wolt, Kaiserstraße): Cups, Salate, Burritos und 3er-Soft-Tacos (Bestellfenster mit Optionen) + Snacks & Sides
// (Quesadillas, Crunchwraps, Tostados, Chili con Carne) → data/chidoba-raw.json (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung
// passiert in den Tabellen unten). Aufruf: node chidoba-crawl.js · danach node chidoba-update.js
// Quellen: offizieller Nährwertrechner chidoba.com/nutrition (je Produktart eine Seite; jede Zutat trägt ihre Werte je Portion als data-Attribute
// am Auswahlfeld) · Kontrolle: data/chidoba-rechner.json (alle 150 Felder im Browser einzeln an- und abgewählt, User 27.09.2026) · Menü, Namen,
// Preise, Auswahlregeln und Reihenfolge der Bestellfenster aus der Wolt-API der Filiale Kaiserstraße (User 16. und 27.09.2026).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "chidoba-raw.json");
const CONTROL = path.join(__dirname, "data", "chidoba-rechner.json");
const CALC = type => "https://www.chidoba.com/nutrition?type=" + encodeURIComponent(type);
const CALC_TYPES = ["Burrito", "Taco 1er", "Taco 3er", "Cup", "Salat", "Sides", "Snacks", "Dips"];
// Kürzel je Rechner-Seite (Präfix der Baustein-ids)
const CALC_KEY = { "Burrito": "burrito", "Taco 1er": "taco1", "Taco 3er": "taco3", "Cup": "cup", "Salat": "salat", "Sides": "side", "Snacks": "snack", "Dips": "dip" };
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
const PRIMARY = "chidobi-mexican-grill"; // = „chidoba MEXICAN GRILL® - Frankfurt Kaiserstraße“ (Kaiserstraße 49), User 16.09.2026

// Produktarten mit Bestellfenster (Bowl-Engine): Rechner-Seite, Kategorie im Tracker, Artikel-Bezeichnung; shell = immer enthaltener Bestandteil
// ohne „Ohne …“ (Salat-Basis, Burrito-Tortilla, die drei Soft-Tortillas)
const SOFT = { ing: "softtaco", section: "Tortilla", calc: "Softtaco", name: "3 Soft-Tortillas" };
const TYPES = {
  cup: { calc: "Cup", cat: "cup", item: "Cup", products: "Cups" },
  salat: { calc: "Salat", cat: "salat", item: "Salat", products: "Salate", shell: { ing: "salatbasis", section: "Füllung", calc: "Eisbergsalat", name: "Eisbergsalat (Salat-Basis)" } },
  burrito: { calc: "Burrito", cat: "burrito", item: "Burrito", products: "Burritos", shell: { ing: "tortilla", section: "Tortilla", calc: "Tortilla", name: "Tortilla" } },
  taco: { calc: "Taco 3er", cat: "taco", item: "3 Soft Tacos", products: "Soft-Tacos", shell: SOFT },
  taco_veggie: { calc: "Taco 3er", cat: "taco", item: "3 Veggie Soft Tacos", products: "Soft-Tacos (Veggie)", shell: SOFT },
  taco_vegan: { calc: "Taco 3er", cat: "taco", item: "3 Vegan Soft Tacos", products: "Soft-Tacos (Vegan)", shell: SOFT },
};
// Wolt-Produkte mit Bestellfenster im Tracker: Name → Produktart + Protein (Rechner-Zeile „Fleisch“); mix = je ein Taco dieser Proteine
// (Summe der Taco-1er-Zeilen), veggie = kein Fleisch (Rechner-Zeile „Veggie“ ohne Werte; die Guacamole steht als Standard-Zutat)
const PRODUCTS = {
  "Chicken Cup": { type: "cup", protein: "Chicken" }, "Beef Cup": { type: "cup", protein: "Beef" }, "Filetsteak Cup": { type: "cup", protein: "Filetsteak" }, "Barbacoa Cup": { type: "cup", protein: "Barbacoa" },
  "Chicken Salat": { type: "salat", protein: "Chicken" }, "Beef Salat": { type: "salat", protein: "Beef" }, "Filetsteak Salat": { type: "salat", protein: "Filetsteak" },
  "Chicken Burrito": { type: "burrito", protein: "Chicken" }, "Beef Burrito": { type: "burrito", protein: "Beef" }, "Filetsteak Burrito": { type: "burrito", protein: "Filetsteak" }, "Barbacoa Burrito": { type: "burrito", protein: "Barbacoa" },
  "3x Chicken Soft Taco": { type: "taco", protein: "Chicken" }, "3x Beef Soft Taco": { type: "taco", protein: "Beef" }, "3x Barbacoa Soft Taco": { type: "taco", protein: "Barbacoa" },
  "3x Mix Soft Taco": { type: "taco", mix: ["Chicken", "Beef", "Barbacoa"], ing: "mix_taco" },
  "3 x Veggie Soft Taco": { type: "taco_veggie", veggie: true, ing: "veggie_taco" },
  "3x Vegan Soft Taco": { type: "taco_vegan", veggie: true, ing: "vegan_taco" },
};
const PRODUCT_NO_DATA = {
  "Veggie Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ hat im Rechner keine Werte (dort nur gegrilltes Gemüse)",
  "Planted Chicken Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Vegan Cup": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Veggie Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Vegan Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Planted Chicken Salat": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Veggie Burrito": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Vegan Burrito": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
  "Planted Chicken Burrito": "Standard-Zutat „rohe Paprika & rote Zwiebeln“ ohne Werte im Rechner",
};
// Wolt-Kategorien mit Bestellfenster-Produkten: jeder Artikel muss in PRODUCTS oder PRODUCT_NO_DATA stehen
const PRODUCT_CATS = ["CUPS", "SALATE", "BURRITOS", "SOFT-TACOS"];
const PROTEIN_ING = { Chicken: "chicken", Beef: "beef", Filetsteak: "filetsteak", Barbacoa: "barbacoa" };

// Snacks & Sides ohne Umbau (User 27.09.2026: „alle Snacks und Sides außer Fries und Chips“): Wolt-Name → Kategorie im Tracker + Rechner-Zeile.
// Ihre Wolt-Optionen (Extras, extra Dips) sind optional und haben im Rechner keine Werte → der Tracker bestellt sie ohne Änderung
const SNACKS = {
  "Cheese Quesadilla": ["quesadillas", "Sides", "Cheese Quesadilla"], "Veggie Quesadilla": ["quesadillas", "Sides", "Veggie Quesadilla"],
  "Vegan Quesadilla": ["quesadillas", "Sides", "Vegan Quesadilla"], "Hot Pepper Quesadilla": ["quesadillas", "Sides", "Hot Pepper Quesadilla"],
  "Crunchwrap Beef": ["crunchwraps", "Snacks", "Crunchwrap Beef"], "Crunchwrap Chicken": ["crunchwraps", "Snacks", "Crunchwrap Chicken"],
  "Crunchwrap Veggie": ["crunchwraps", "Snacks", "Crunchwrap Veggie"], "Crunchwrap Barbacoa": ["crunchwraps", "Snacks", "Crunchwrap Barbacoa"],
  "Verde Tostado": ["tostados", "Snacks", "Verde Tostado"], "Beef Cheese Tostado": ["tostados", "Snacks", "Beef Cheese Tostado"],
  "Chicken Cheese Tostado": ["tostados", "Snacks", "Chicken Cheese Tostado"],
  "Chili con Carne": ["chili", "Snacks", "Chili con Carne"],
};
// Hinweis im Order Guide: der Rechner-Wert gilt für die Standard-Zusammenstellung
const SNACK_NOTES = { "Chili con Carne": "keep Sour Cream and Tortilla Strips (both are in the values)" };
const SNACK_NO_DATA = {
  "Chicken Cheese Quesadilla": "nicht im Rechner (Sides: nur Cheese, Veggie, Vegan, Chili Cheese und Hot Pepper Quesadilla)",
  "Beef Cheese Quesadilla": "nicht im Rechner (Sides: nur Cheese, Veggie, Vegan, Chili Cheese und Hot Pepper Quesadilla)",
  "Sweet Chicken Tostado": "nicht im Rechner",
  "Chili & Bean Tostado": "nicht im Rechner — der Rechner nennt „Chili Cheese Tostado“, laut chidoba.com mit Sour Cream; Wolt beschreibt den Chili & Bean Tostado ohne Sour Cream → nicht gleichgesetzt",
  "Lava Cheese Bites": "nicht im Rechner",
};
const SNACK_SKIP = {
  "Adobada Chili Cheese Fries": "Fries (User 27.09.2026: keine Fries und Chips)", "Pepper Corn Fries": "Fries (User 27.09.2026)", "Cajun Fries": "Fries (User 27.09.2026)",
  "Tortilla Chips": "Chips (User 27.09.2026)", "Cheese & Beef Soße": "Soße ohne Werte im Rechner",
};
// Gesperrt (User 27.09.2026 „Ja nimm sie raus“): die veröffentlichten kcal passen nicht zu den Makros. Die Snacks bleiben mit Grund im Datensatz
// (blocked, _meta.blocked), fehlen aber im Tracker — wie bei Lorys und beets&roots. Ballaststoffe (2 kcal/g) vergrößern die Lücke nur
const SNACK_BLOCKED = {
  "Crunchwrap Veggie": "User 27.09.2026: gesperrt — 764 kcal passen nicht zu 84,32 g KH, 33,75 g Eiweiß, 44,45 g Fett (4·KH + 4·E + 9·F = 872 kcal, -12 %)",
  "Crunchwrap Barbacoa": "User 27.09.2026: gesperrt — 781 kcal passen nicht zu 67,92 g KH, 51,83 g Eiweiß, 45,08 g Fett (4·KH + 4·E + 9·F = 885 kcal, -12 %)",
};
// Wolt-Kategorien mit Snacks & Sides: jeder Artikel muss in SNACKS, SNACK_NO_DATA oder SNACK_SKIP stehen
const SNACK_CATS = ["QUESADILLAS", "SNACKS", "BEILAGEN"];
const SKIPPED_CATS = ["BELIEBTE ARTIKEL", "BESTECK", "DIPS", "DESSERTS", "ALKOHOLFREIE GETRÄNKE"];

// Wolt-Gruppen der Bestellfenster (Name klein geschrieben → Art); id = Gruppe im Tracker
const GROUPS = {
  "deine basis": { id: "basis", kind: "base" },
  "wähle deine zutaten": { id: "zutaten", kind: "standard" },
  "deine cream": { id: "cream", kind: "cream" }, "deine soße": { id: "cream", kind: "cream" },
  "wähle deine cream": { id: "tcream", kind: "standard" },
  "deine salsa": { id: "salsa", kind: "salsa" }, "wähle deine salsa": { id: "salsa", kind: "salsa" },
  "deine extras": { id: "extras", kind: "extras" }, "wähle deine extras": { id: "extras", kind: "extras" },
  "dein flavored skin": { id: "skin", kind: "skip", why: "Flavored Skin (Cajun Chili, Ginger Lime, Indian Summer) hat im Rechner keine Werte — optional, wird nie gewählt" },
};
const NONE = new Set(["ohne basis", "ohne creme", "ohne cream", "ohne salsa"]);
// Basis: Wolt-Name → Zutat + Rechner-Zeile (Abschnitt „Füllung“)
const BASE_MAP = { "gewürzreis": ["gewuerzreis", "gewürzter Reis"], "cubes": ["cubes", "Cubes"] };
// Standard-Zutaten („Ohne …“ zum Abwählen, Burrito „Mit Eisbergsalat“ zum Dazunehmen) → Baustein; calc je Rechner-Seite, falls verschieden.
// optional = der Optimizer darf abwählen (User 16.09.2026: nur Black Beans); addOn = der Optimizer darf dazunehmen; sauce = fällt mit „No sauce/
// cheese/dips“ weg; noData = keine Werte im Rechner → wird immer abgewählt
const STANDARD_MAP = {
  "ohne black beans": { ing: "black_beans", calc: "Black Beans", name: "Black Beans", optional: true },
  "ohne gegrillte paprika & rote zwiebeln": { ing: "gegrilltes_gemuese", calc: "gegrilltes Gemüse", name: "gegrillte Paprika & rote Zwiebeln" },
  "ohne eisbergsalat": { ing: "eisbergsalat", calc: "Eisbergsalat", name: "Eisbergsalat" },
  "mit eisbergsalat": { ing: "eisbergsalat", calc: "Eisbergsalat", name: "Eisbergsalat", addOn: true },
  "ohne cheddar jack cheese": { ing: "cheddar_jack_cheese", calc: "Cheddar Jack Cheese", name: "Cheddar Jack Cheese", sauce: true },
  "ohne cheddar jack": { ing: "cheddar_jack_cheese", calc: "Cheddar Jack Cheese", name: "Cheddar Jack Cheese", sauce: true },
  "ohne limette": { ing: "limette", calc: "Limette", name: "Limette", defaultOff: "User 16.09.2026: Limette standardmäßig immer raus" },
  "ohne california dressing": { ing: "california_dressing", calc: "California Dressing", name: "California Dressing", sauce: true },
  "ohne sour cream": { ing: "sour_cream", calc: "Sour Cream", name: "Sour Cream", sauce: true },
  // Wolt schreibt „Guacmole“; bei Veggie/Vegan Soft Tacos ersetzt die Guacamole das Fleisch → kein sauce-Flag (bleibt mit „No sauce/cheese/dips“)
  "ohne guacmole": { ing: "guacamole", calc: "3 Kugel Guacamole", name: "Guacamole (3 Kugeln)" },
  "ohne tortilla strips": { noData: "Tortilla Strips haben im Rechner keine Werte → der Order Guide wählt sie immer ab" },
};
const CREAM_MAP = { "sour cream": ["sour_cream", "Sour Cream"] };
const SALSA_MAP = { "mild": ["salsa", "Salsa Mild oder Medium"] };
// Salsa mit gleichen Werten, die zusätzlich bestellt werden darf (User 16.09.2026: „Salsa Mild und Medium“ auch bei „No sauce/cheese/dips“)
const SALSA_ALSO = ["Medium"];
const SALSA_SAME = { "medium": "gleiche Rechner-Zeile wie Mild („Salsa Mild oder Medium“) → nicht doppelt angeboten", "scharf": "„Salsa Hot“ hat genau die Werte von Mild/Medium → nicht doppelt angeboten" };
// Extras: Wolt-Name → Zutat + Rechner-Zeile (je Rechner-Seite, falls verschieden) + sauce
const EXTRA_MAP = {
  "beef": ["beef", "Beef (extra)"], "chicken": ["chicken", "Chicken (extra)"], "barbacoa": ["barbacoa", "Barbacoa (extra)"], "filetsteak": ["filetsteak", "Filetsteak (extra)"],
  // Guacamole-Extra = eine Kugel; beim 3er-Taco eine je Taco (der Taco-3er-Rechner kennt nur „3 Kugel Guacamole“)
  "guacamole": ["guacamole", { "Taco 3er": "3 Kugel Guacamole", default: "1 Kugel Guacamole" }, true],
  "cheesesauce": ["cheesesauce", "Cheesesauce", true], "cheddar jack cheese": ["cheddar_jack_cheese", "Cheddar Jack Cheese", true],
};
const NO_DATA = {
  "chili creme": "nicht im Rechner", "chili cream": "nicht im Rechner", "jalapeños": "nicht im Rechner", "chili con carne": "Extra-Portion nicht im Rechner (nur der Snack)",
  "planted chicken": "als Extra nicht im Rechner", "habanero sauce": "nicht im Rechner", "habanero": "nicht im Rechner", "tabasco": "nicht im Rechner",
};
// Koriander (User 13.09.2026: nie vorschlagen, wenn prominent)
const NEVER = { "korianderreis": "Koriander (User 13.09.2026)", "cilantro creme": "Koriander (User 13.09.2026); keine Werte im Rechner", "cilantro cream": "Koriander (User 13.09.2026); keine Werte im Rechner" };
const ALLERGENS = { gluten: "Gluten", krebstiere: "Krebstiere", eier: "Eier", fisch: "Fisch", erdnuesse: "Erdnüsse", sojabohnen: "Soja", milch: "Milch", nuesse: "Schalenfrüchte", sellerie: "Sellerie", senf: "Senf", sesamkoerner: "Sesam", schwefeldioxid: "Schwefeldioxid/Sulfite", mollusken: "Weichtiere", lupin: "Lupinen" };
// Bestellfenster im Browser durchgeklickt (Wolt, 27.09.2026): Gruppen, Reihenfolge, Grenzen und Preise = Wolt-API
const WOLT_DIALOGS = {
  checkedAt: "2026-09-27",
  note: "Bestellfenster aller Burritos (7), Soft-Tacos (6), Quesadillas (6), Crunchwraps (4) und Tostados (5) sowie von Chili con Carne, Lava Cheese Bites, Chicken Cup und Chicken Salat im Browser geöffnet (32, nichts in den Warenkorb): Gruppen, Reihenfolge, Hinweise („Wähle bis zu 4 zusätzliche Optionen aus“), Optionen und Aufpreise identisch mit der Wolt-API; nichts ist vorausgewählt (der Knopf zeigt jeweils den Artikelpreis). Die Soft-Tacos haben je Produkt eine eigene Gruppen-Reihenfolge (3x Chicken: Salsa zuerst) — der Order Guide folgt ihr",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const low = s => normName(s).toLowerCase();
const catKey = s => normName(s).replace(/[^\p{L}\p{N}&\- ]/gu, "").trim().toUpperCase();
const H_HTML = { Accept: "text/html", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const toNum = v => (v == null || String(v).trim() === "" ? null : (/^\d+(\.\d+)?$/.test(String(v).trim()) ? parseFloat(v) : NaN));
const euro = n => n.toFixed(2).replace(".", ",") + " €";

// Rechner-Seite: Abschnitte („2. Füllung“ …) mit Auswahlfeldern; Werte je Portion; Natrium in mg → Salz = Natrium × 2,5.
// raw = die Zahlen der data-Attribute ungerundet (für den Abgleich mit der Anzeige)
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
      items.push({ label, section: heads[c].name, multi: /type="checkbox"/.test(m[1]), perPortion, natriumMg: raw.natrium, raw: empty ? null : raw, allergens: flags.filter(f => ALLERGENS[f]).map(f => ALLERGENS[f]), hints: flags.filter(f => !ALLERGENS[f]) });
    }
    out.push({ section: heads[c].name, items });
  }
  return out;
}

// Abgleich mit der im Browser abgelesenen Anzeige (data/chidoba-rechner.json): je abgelesenem Feld die Auswahl rekonstruieren (Grundauswahl;
// ein Auswahlfeld ersetzt die Grundauswahl seines Abschnitts, eine Zutat kommt dazu), die data-Attribute summieren und wie die Seite mit einer
// Nachkommastelle runden. Die Seite animiert die Zahlen → an Rundungsgrenzen ±0,1 möglich; mehr bricht ab
function checkRechner(calculator, control, problems) {
  const F = ["kcal", "fat", "sat", "carbs", "sugars", "protein", "fibre", "natrium"]; // Reihenfolge der Kontrolldatei
  const res = { readAt: control._meta.readAt, types: 0, fields: 0, values: 0, exact: 0, rounding: [] };
  for (const [type, ctl] of Object.entries(control.types)) {
    const items = (calculator[type] || []).flatMap(s => s.items);
    if (!items.length) { problems.push("Rechner-Kontrolle: Produktart „" + type + "“ fehlt im Crawl"); continue; }
    res.types++;
    const up = s => s.toLocaleUpperCase("de-DE");
    const find = (sec, label) => items.filter(i => up(i.section) === up(sec) && up(i.label) === label);
    if (ctl.rows.length !== items.length) problems.push("Rechner-Kontrolle " + type + ": " + ctl.rows.length + " abgelesene Felder, Seite hat " + items.length);
    const base = ctl.baseline.selected.map(l => { const h = items.filter(i => !i.multi && up(i.label) === l); if (h.length !== 1) problems.push("Rechner-Kontrolle " + type + ": Grundauswahl „" + l + "“ " + h.length + "× gefunden"); return h[0]; }).filter(Boolean);
    for (const [sec, label, kind, isBase, shown] of ctl.rows) {
      const hit = find(sec, label);
      if (hit.length !== 1) { problems.push("Rechner-Kontrolle " + type + ": „" + sec + " / " + label + "“ " + hit.length + "× gefunden"); continue; }
      const it = hit[0];
      if ((kind === "c") !== it.multi) problems.push("Rechner-Kontrolle " + type + ": „" + label + "“ Feldart weicht ab");
      let sel = base.slice();
      if (!isBase) sel = it.multi ? sel.concat([it]) : sel.filter(b => b.section !== it.section).concat([it]);
      const vals = shown.split("|").map(s => parseFloat(s.replace(",", ".")));
      res.fields++;
      F.forEach((k, q) => {
        const sum = sel.reduce((a, x) => a + ((x.raw && x.raw[k]) || 0), 0), want = Number(sum.toFixed(1));
        res.values++;
        if (Math.abs(vals[q] - want) < 1e-9) res.exact++;
        else if (Math.abs(vals[q] - want) <= 0.1 + 1e-9) res.rounding.push(type + " / " + label + " " + k + ": angezeigt " + shown.split("|")[q] + ", Summe " + String(want).replace(".", ","));
        else problems.push("Rechner-Kontrolle " + type + " / " + label + ": " + k + " angezeigt " + shown.split("|")[q] + ", data-Attribute ergeben " + want);
      });
    }
  }
  return res;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];

  // ── Nährwertrechner (alle Produktarten als Datensatz) + Kontrolle gegen die durchgeklickte Anzeige ──
  const calculator = {};
  for (const type of CALC_TYPES) {
    calculator[type] = parseCalculator(await get(CALC(type), H_HTML), problems, type);
    if (!calculator[type].length) problems.push("Rechner: Produktart „" + type + "“ ohne Abschnitte (Seitenaufbau geändert?)");
    await sleep(600);
  }
  const rechner = checkRechner(calculator, U.readJSON(CONTROL), problems);
  const calcRow = (type, label, section) => {
    const hits = calculator[type].flatMap(s => s.items).filter(i => i.label === label && (!section || i.section === section));
    if (hits.length !== 1) return { err: "Rechner " + type + ": „" + label + "“ " + hits.length + "× gefunden (erwartet 1)" };
    if (!hits[0].perPortion) return { err: "Rechner " + type + ": „" + label + "“ ohne Werte" };
    return { row: hits[0] };
  };
  // Bausteine je Rechner-Seite (dieselbe Zutat kann je Produktart andere Werte haben, z.B. Barbacoa im Salat)
  const components = [];
  const addComp = c => {
    const known = components.find(x => x.id === c.id);
    if (known) return known;
    if (c.allergens.includes("Krebstiere") || c.allergens.includes("Weichtiere")) c.shellfish = true;
    const issues = U.checkItem(c.perPortion);
    if (issues.length) anomalies.push({ name: c.calcType + " / " + c.calcLabel, issues });
    components.push(c);
    return c;
  };
  const comp = (calcType, ing, label, section, name, strict) => {
    const r = calcRow(calcType, label, section);
    if (r.err) { if (strict !== false) problems.push(r.err); return null; }
    const row = r.row;
    return addComp({ id: CALC_KEY[calcType] + "_" + ing, ing, type: CALC_KEY[calcType], name: name || row.label, calcType, calcLabel: row.label, section: row.section, perPortion: row.perPortion, natriumMg: row.natriumMg, allergens: row.allergens, hints: row.hints });
  };
  const labelFor = (spec, calcType) => (typeof spec === "string" ? spec : spec[calcType] || spec.default);

  // ── Wolt Kaiserstraße ──
  const assort = await get(WOLT_API(PRIMARY), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  // Kategorien: jeder Artikel einer Produkt- oder Snack-Kategorie muss kuratiert sein; unbekannte Kategorien brechen ab
  for (const c of assort.categories || []) {
    const ck = catKey(c.name);
    const known = [...PRODUCT_CATS, ...SNACK_CATS, ...SKIPPED_CATS].find(k => ck === k);
    if (!known) { problems.push("Wolt: unbekannte Kategorie „" + c.name + "“"); continue; }
    for (const id of c.item_ids || []) {
      const it = byItem[id]; if (!it) continue;
      const n = normName(it.name);
      if (PRODUCT_CATS.includes(known) && !PRODUCTS[n] && !PRODUCT_NO_DATA[n]) problems.push("Wolt: Produkt „" + n + "“ (" + c.name + ") weder in PRODUCTS noch in PRODUCT_NO_DATA");
      if (SNACK_CATS.includes(known) && !SNACKS[n] && !SNACK_NO_DATA[n] && !SNACK_SKIP[n]) problems.push("Wolt: Snack „" + n + "“ (" + c.name + ") weder in SNACKS, SNACK_NO_DATA noch SNACK_SKIP");
    }
  }
  const items = Object.values(byItem);
  const productNoData = [], never = new Map(), noData = new Map(), same = new Map();
  const menus = {}, products = [];
  const groupOptions = ref => { const g = byOpt[ref.option_id] || {}; return (g.values || []).map(v => ({ name: normName(v.name), price: U.round(v.price / 100, 2) })); };
  for (const it of items) {
    const name = normName(it.name);
    if (PRODUCT_NO_DATA[name]) { if (!productNoData.some(x => x.startsWith(name + " "))) productNoData.push(name + " (" + euro(it.price / 100) + ") — " + PRODUCT_NO_DATA[name]); continue; }
    const def = PRODUCTS[name];
    if (!def || products.some(p => p.name === name)) continue;
    const tp = TYPES[def.type], calcType = tp.calc;
    // Produkt-Baustein: Fleisch-Portion laut Rechner; Mix = Summe der Taco-1er-Zeilen; Veggie/Vegan ohne Fleisch-Werte
    let prot = null;
    if (def.protein) prot = comp(calcType, PROTEIN_ING[def.protein], def.protein, "Fleisch", def.protein);
    else if (def.mix) {
      const rows = def.mix.map(p => calcRow("Taco 1er", p, "Fleisch"));
      const bad = rows.find(r => r.err);
      if (bad) problems.push(bad.err);
      else prot = addComp({ id: "taco3_" + def.ing, ing: def.ing, type: "taco3", name: "Chicken + Beef + Barbacoa (je ein Taco)", calcType: "Taco 1er", calcLabel: def.mix.join(" + "), section: "Fleisch",
        perPortion: Object.fromEntries(U.KEYS.map(k => [k, U.round(rows.reduce((a, r) => a + r.row.perPortion[k], 0), 3)])), natriumMg: U.round(rows.reduce((a, r) => a + (r.row.natriumMg || 0), 0), 2),
        allergens: [...new Set(rows.flatMap(r => r.row.allergens))], hints: [...new Set(rows.flatMap(r => r.row.hints))], derived: "Summe der Taco-1er-Zeilen " + def.mix.join(", ") + " (je ein Taco; der 3er-Rechner hat je Fleisch genau das Dreifache)" });
    } else {
      // Rechner-Zeile „Veggie“ (Fleisch) ohne Werte
      const hits = calculator[calcType].flatMap(s => s.items).filter(i => i.label === "Veggie" && i.section === "Fleisch");
      if (hits.length !== 1 || hits[0].perPortion) problems.push("Rechner " + calcType + ": „Veggie“ (Fleisch) sollte genau einmal und ohne Werte vorkommen");
      prot = addComp({ id: "taco3_" + def.ing, ing: def.ing, type: "taco3", name: name.replace(/^3 ?x /, ""), calcType, calcLabel: "Veggie", section: "Fleisch", perPortion: Object.fromEntries(U.KEYS.map(k => [k, 0])), natriumMg: 0,
        allergens: [], hints: hits[0] ? hits[0].hints : [], derived: "kein Fleisch (Rechner-Zeile „Veggie“ ohne Werte); Guacamole, Black Beans usw. stehen als Standard-Zutaten" });
    }
    const groups = [], dialog = [], sig = [];
    for (const ref of it.options || []) {
      const gname = normName(ref.name), gd = GROUPS[low(gname)];
      const cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
      if (!gd) { problems.push("Wolt: unbekannte Gruppe „" + gname + "“ (" + name + ")"); continue; }
      dialog.push(gd.id);
      const grp = { id: gd.id, name: gname, kind: gd.kind, min: cfg.min != null ? cfg.min : 0, max: cfg.max != null ? cfg.max : 1, none: null, options: [], removals: [] };
      if (gd.kind === "standard") grp.ohneOrder = [];
      if (gd.kind === "skip") { grp.skip = gd.why; noData.set("skip|" + gd.id, "„" + gname + "“ (" + tp.products + ") — " + gd.why); }
      for (const v of groupOptions(ref)) {
        const vn = v.name, vl = low(vn), price = v.price;
        sig.push(gd.id + "|" + vl + "|" + price);
        if (gd.kind === "skip") continue;
        if (NONE.has(vl)) { grp.none = vn; continue; }
        if (NEVER[vl]) { never.set(gname + "|" + vl, "„" + vn + "“ (" + gname + ") — " + NEVER[vl]); continue; }
        if (gd.kind === "standard") {
          grp.ohneOrder.push(vn);
          const sd = STANDARD_MAP[vl];
          if (!sd) { problems.push("Wolt: unbekannte Standard-Zutat „" + vn + "“ (" + name + ")"); continue; }
          if (sd.noData) { grp.removals.push(vn); noData.set(vl, "„" + vn.replace(/^Ohne /i, "") + "“ (Standard-Zutat) — " + sd.noData); continue; }
          const c = comp(calcType, sd.ing, labelFor(sd.calc, calcType), "Zutaten", sd.name);
          if (!c) continue;
          grp.options.push(Object.assign({ name: sd.name, component: c.id, ing: sd.ing, price: 0 }, sd.addOn ? { addName: vn, addOn: true } : { removeName: vn, optional: !!sd.optional, sauce: !!sd.sauce }, sd.defaultOff ? { defaultOff: true } : {}));
          continue;
        }
        if (gd.kind === "salsa" && SALSA_SAME[vl]) { same.set(vl, "Salsa „" + vn + "“ — " + SALSA_SAME[vl]); continue; }
        if (gd.kind === "extras" && vl === "cheesesauce" && calcType === "Salat") { noData.set("Salat|Cheesesauce", "„Cheesesauce“ (Extra im Salat) — der Salat-Rechner führt keine Cheesesauce"); continue; }
        if (NO_DATA[vl]) { noData.set(vl + "|" + gname, "„" + vn + "“ (" + gname + (price ? ", +" + euro(price) : "") + ") — " + NO_DATA[vl]); continue; }
        const map = gd.kind === "base" ? BASE_MAP : gd.kind === "cream" ? CREAM_MAP : gd.kind === "salsa" ? SALSA_MAP : EXTRA_MAP;
        const mm = map[vl];
        if (!mm) { problems.push("Wolt: nicht zugeordnete Option „" + vn + "“ in „" + gname + "“ (" + name + ")"); continue; }
        const label = labelFor(mm[1], calcType), r = calcRow(calcType, label, gd.kind === "base" ? "Füllung" : "Zutaten");
        if (r.err) { noData.set(vl + "|" + gname + "|" + calcType, "„" + vn + "“ (" + gname + ", " + tp.products + ") — der " + calcType + "-Rechner hat keine Zeile „" + label + "“"); continue; }
        const c = comp(calcType, mm[0], label, gd.kind === "base" ? "Füllung" : "Zutaten", gd.kind === "extras" ? vn : null);
        const o = { name: vn, component: c.id, ing: mm[0], price, maxQty: 1 };
        if (mm[2] || gd.kind === "cream") o.sauce = true;
        if (gd.kind === "salsa") o.also = SALSA_ALSO.slice();
        grp.options.push(o);
      }
      groups.push(grp);
    }
    products.push({ name, type: def.type, protein: prot ? prot.ing : null, component: prot ? prot.id : null, price: U.round(it.price / 100, 2), dialog, description: normName(it.description) });
    // Gruppen je Produktart einmal ablegen; alle Produkte einer Art brauchen dieselben Gruppen, Optionen und Preise (Reihenfolge und die
    // Extras-Grenze dürfen abweichen: 3x Mix Soft Taco erlaubt 10 statt 8 Extras)
    const signature = sig.slice().sort().join(",");
    if (!menus[def.type]) menus[def.type] = { groups, signature };
    else if (menus[def.type].signature !== signature) problems.push("Wolt: Optionen von „" + name + "“ weichen von den anderen " + def.type + "-Produkten ab");
    else for (const g of groups) { const m = menus[def.type].groups.find(x => x.id === g.id); if (m && g.max < m.max) m.max = g.max; }
  }
  for (const n of Object.keys(PRODUCTS)) if (!products.some(p => p.name === n)) problems.push("Wolt: Produkt „" + n + "“ fehlt");
  // Immer enthaltene Bestandteile (Salat-Basis, Tortilla, Soft-Tortillas)
  const shells = {};
  for (const [tp, cfg] of Object.entries(TYPES)) if (cfg.shell) { const c = comp(cfg.calc, cfg.shell.ing, cfg.shell.calc, cfg.shell.section, cfg.shell.name); if (c) shells[tp] = c.id; }

  // ── Snacks & Sides ──
  const snacks = [];
  for (const [wname, [cat, calcType, label]] of Object.entries(SNACKS)) {
    const it = items.find(i => normName(i.name) === wname);
    if (!it) { problems.push("Wolt: Snack „" + wname + "“ fehlt"); continue; }
    const c = comp(calcType, U.slugId(wname), label, calcType, wname);
    const opts = (it.options || []).map(ref => { const cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {}; return { name: normName(ref.name), min: cfg.min || 0, max: cfg.max, values: groupOptions(ref).map(v => v.name + (v.price ? " +" + euro(v.price) : "")) }; });
    for (const g of opts) if (g.min > 0) problems.push("Wolt: Snack „" + wname + "“ hat eine Pflicht-Auswahl „" + g.name + "“ (bisher nur optionale Gruppen)");
    if (c) snacks.push(Object.assign({ name: wname, cat, component: c.id, ing: c.ing, price: U.round(it.price / 100, 2), description: normName(it.description), options: opts }, SNACK_NOTES[wname] ? { orderNote: SNACK_NOTES[wname] } : {}, SNACK_BLOCKED[wname] ? { blocked: SNACK_BLOCKED[wname] } : {}));
  }
  for (const n of Object.keys(SNACK_BLOCKED)) if (!SNACKS[n]) problems.push("SNACK_BLOCKED: „" + n + "“ steht nicht in SNACKS");
  const snackNoData = Object.entries(SNACK_NO_DATA).map(([n, why]) => { const it = items.find(i => normName(i.name) === n); if (!it) problems.push("Wolt: „" + n + "“ (SNACK_NO_DATA) nicht mehr im Menü"); return n + (it ? " (" + euro(it.price / 100) + ")" : "") + " — " + why; });
  const snackSkipped = Object.entries(SNACK_SKIP).map(([n, why]) => n + " — " + why);

  // ── Auffälligkeiten ──
  // Werte-Unterschiede derselben Zutat zwischen Cup und Salat (Cup ↔ Burrito sind identisch, das wird geprüft)
  const typeDiffs = [];
  for (const c of components.filter(x => x.type === "cup")) {
    const s = components.find(x => x.type === "salat" && x.ing === c.ing);
    if (!s) continue;
    const d = U.KEYS.filter(k => Math.abs(c.perPortion[k] - s.perPortion[k]) > 1e-9);
    if (d.length) typeDiffs.push(c.name + ": Cup " + d.map(k => k + " " + c.perPortion[k]).join(", ") + " · Salat " + d.map(k => k + " " + s.perPortion[k]).join(", "));
  }
  if (typeDiffs.length) anomalies.push({ name: "Cup ↔ Salat", issues: ["Rechner nennt je Produktart andere Werte (Tracker nutzt je Produktart die eigene Zeile): " + typeDiffs.join(" · ")] });
  // Burrito ↔ Cup: Fleisch, Zutaten und Extras sind dieselben Zeilen; die Basis (Reis, Cubes) ist im Burrito die halbe Cup-Portion (Info)
  const burritoDiffs = [], burritoHalf = [];
  for (const b of components.filter(x => x.type === "burrito")) {
    const c = components.find(x => x.type === "cup" && x.ing === b.ing && x.calcLabel === b.calcLabel);
    if (!c || !U.KEYS.some(k => Math.abs(c.perPortion[k] - b.perPortion[k]) > 1e-9)) continue;
    if (b.section === "Füllung" && U.KEYS.every(k => Math.abs(2 * b.perPortion[k] - c.perPortion[k]) <= 0.011)) burritoHalf.push(b.calcLabel + " " + b.perPortion.kcal + " statt " + c.perPortion.kcal + " kcal");
    else burritoDiffs.push(b.calcLabel);
  }
  if (burritoDiffs.length) anomalies.push({ name: "Cup ↔ Burrito", issues: ["gleiche Zeile, andere Werte: " + burritoDiffs.join(", ")] });
  // Taco 3er = 3 × Taco 1er? (Fleisch, Tortillas, Reis, Beilagen); Abweichungen nur dokumentieren
  const t1 = calculator["Taco 1er"].flatMap(s => s.items), t3 = calculator["Taco 3er"].flatMap(s => s.items), not3 = [];
  for (const r3 of t3) {
    const r1 = t1.find(x => x.label === r3.label && x.section === r3.section);
    if (!r1 || !r1.perPortion || !r3.perPortion) continue;
    if (U.KEYS.some(k => Math.abs(r3.perPortion[k] - 3 * r1.perPortion[k]) > 0.03 + 0.001 * r3.perPortion[k])) not3.push(r3.label);
  }
  if (not3.length) anomalies.push({ name: "Taco 3er ↔ Taco 1er", issues: ["nicht das Dreifache des Einzel-Tacos (unverändert übernommen): " + not3.join(", ")] });
  const tacoSat = ["Chicken", "Filetsteak"].filter(l => { const r = t3.find(x => x.label === l && x.section === "Fleisch"); const c = calculator.Cup.flatMap(s => s.items).find(x => x.label === l && x.section === "Fleisch"); return r && c && r.perPortion.sat === 0 && c.perPortion.sat > 0; });
  if (tacoSat.length) anomalies.push({ name: "Taco 3er / gesättigte Fettsäuren", issues: [tacoSat.join(" und ") + " ohne gesättigte Fettsäuren (Cup/Burrito: je Portion > 0)"] });
  const chili = components.find(c => c.ing === "chili_con_carne");
  if (chili && Math.abs(chili.perPortion.fibre - chili.perPortion.protein) < 1e-9) anomalies.push({ name: "Snacks / Chili con Carne", issues: ["Ballaststoffe = Eiweiß (je " + chili.perPortion.protein + " g) — möglicher Übertragungsfehler, unverändert übernommen"] });
  const lowNa = components.filter(c => c.natriumMg != null && c.natriumMg < 3 && !/Limette|Eisbergsalat|Veggie|Vegan/.test(c.name) && !c.derived).map(c => c.calcType + " / " + c.calcLabel + " " + c.natriumMg + " mg");
  if (lowNa.length) anomalies.push({ name: "Natrium", issues: ["auffällig niedrig (Salz ≈ 0): " + lowNa.join(", ")] });
  const coriander = components.filter(c => c.hints.includes("koriander_fri") || c.hints.includes("koriander_gew")).map(c => c.calcType + " / " + c.calcLabel + ": " + [c.hints.includes("koriander_fri") ? "frischer Koriander" : null, c.hints.includes("koriander_gew") ? "Koriander (Gewürz)" : null].filter(Boolean).join(" + "));
  const notOnWolt = [
    "Taco 1er (einzelner Taco) und Maistaco (Hard Shell): bei Wolt Kaiserstraße nur „3x … Soft Taco“ — der Taco-1er-Rechner liefert nur die Werte des Mix-Tacos",
    "Rechner-Zeilen ohne Wolt-Option: Reis halb/halb, Reis (bei Veggie Burrito), Planted Chicken (Fleisch), 2 Kugel Guacamole",
    "Crunchwrap Chili Cheese, Chili Cheese Quesadilla, Chili Cheese Tostado (Rechner) — bei Wolt nicht als solche bestellbar",
  ];

  const out = {
    _meta: {
      restaurant: "chidoba MEXICAN GRILL", fetchedAt,
      sources: { nutrition: { calculator: CALC("{Produktart}"), types: CALC_TYPES, control: "data/chidoba-rechner.json" }, wolt: { venue: PRIMARY, name: "chidoba MEXICAN GRILL® - Frankfurt Kaiserstraße", page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY) } },
      basis: "Offizielle Werte je Portion aus dem chidoba-Nährwertrechner (data-Attribute je Zutat), getrennt je Produktart (Cup, Salat, Burrito, Taco 3er, Sides, Snacks). Salz = Natrium (mg) × 2,5 / 1000. Wolt-Namen, -Preise und Bestellfenster der Filiale Kaiserstraße.",
      rules: "Jede Bestellung = höchstens ein Cup, Salat, Burrito oder eine 3er-Soft-Taco-Box (Protein laut Artikel) mit ihren Standard-Zutaten + Snacks & Sides ohne Umbau (auch mehrfach), zusammen höchstens „Max. items per order“ Artikel; ohne Hauptprodukt nur Snacks. Basis 0–1 (Gewürzreis, Cubes; Tacos: Gewürzreis), Cream 0–1, Salsa 0–1, Extras je 1×.",
      decisions: [
        "User 16.09.2026: Chidoba als Tracker; Nährwerte aus dem Rechner auf chidoba.com",
        "User 16.09.2026: Schalter „No Sauce/Cheese/Dips“ Default AN (keine Cheesesauce, Salsa, Sour Cream, Cheddar Jack Cheese, Guacamole)",
        "User 16.09.2026: Plattform Wolt, Filiale Kaiserstraße (Namen, Verfügbarkeit, Preise)",
        "User 16.09.2026: Standard-Zutaten fix, nur Black Beans darf der Optimizer abwählen",
        "User 16.09.2026: Limette standardmäßig immer raus (Order Guide „Ohne Limette“; als Pflicht-Zutat bleibt sie drin)",
        "User 16.09.2026: Salsa Mild und Medium auch bei „No sauce/cheese/dips“ erlaubt (gleiche Rechner-Zeile → Order Guide „Mild or Medium“)",
        "User 16.09.2026: Bestellfenster Chicken Cup / Chicken Salat abgeglichen (Gruppen, Grenzen, „Ohne …“-Reihenfolge, Extras-Preise) — der Order Guide folgt ihm",
        "User 27.09.2026: dazu Burrito, Taco 1er und Taco 3er sowie alle Snacks und Sides außer Fries und Chips; eigene Kategorien für Snacks und Sides (Quesadillas, Crunchwraps, Tostados, Chili con Carne); Produktkategorien weiter einzeln wählbar, bei mehreren Kategorien Kombinationen (z.B. 3 Tacos + Snack) mit „Max. items per order“",
        "User 27.09.2026: jede Zutat im Rechner einzeln an- und abwählen (data/chidoba-rechner.json) und jedes Wolt-Bestellfenster durchklicken, um die Bestellanleitung je Kategorie zu bauen",
        "User 27.09.2026: Crunchwrap Veggie und Crunchwrap Barbacoa gesperrt — ihre kcal passen nicht zu den Makros (bleiben mit Grund im Datensatz, _meta.blocked)",
      ],
      assumptions: [
        "„No Sauce/Cheese/Dips“ wählt auch die Standard-Zutaten Cheddar Jack Cheese, (Salat) California Dressing und (Tacos) Sour Cream ab",
        "Extra Cheddar Jack Cheese = eine weitere Portion laut Rechner",
        "Tortilla Strips (Standard im Salat) haben keine Werte → der Order Guide wählt sie immer ab",
        "3x Mix Soft Taco = je ein Taco Chicken, Beef und Barbacoa → Fleisch = Summe der drei Taco-1er-Zeilen",
        "Veggie/Vegan Soft Tacos: Guacamole = „3 Kugel Guacamole“ (die einzige Guacamole-Zeile des 3er-Rechners); sie ersetzt das Fleisch und bleibt auch mit „No sauce/cheese/dips“",
        "Extras bei den 3er-Tacos = die „(extra)“-Zeilen des 3er-Rechners (drei Portionen, eine je Taco); Guacamole-Extra = 3 Kugeln; Cheesesauce und Salsa laut Rechner eine Portion für alle drei",
        "Burrito: „Mit Eisbergsalat“ (kostenlos) darf der Optimizer dazunehmen; Flavored Skin wird nie gewählt",
        "Snacks & Sides ohne Umbau: Wolt-Extras und extra Dips haben im Rechner keine Werte → nie gewählt; Chili con Carne mit Sour Cream und Tortilla Strips (Standard, so im Rechner)",
      ],
      products: products.map(p => p.name + " " + p.price + " €"), productNoData, never: [...never.values()], noData: [...noData.values()], sameValues: [...same.values()],
      snacks: snacks.map(s => s.name + " " + s.price + " € (" + s.cat + (s.blocked ? ", gesperrt" : "") + ")"), snackNoData, snackSkipped, notOnWolt,
      blocked: snacks.filter(s => s.blocked).map(s => s.name + " (" + s.cat + ") — " + s.blocked),
      rechnerControl: Object.assign({}, rechner, { note: "Alle " + rechner.fields + " Felder der " + rechner.types + " Rechner-Seiten einzeln an- und abgewählt (" + rechner.readAt + "); jede abgelesene Anzeige = Summe der data-Attribute, " + rechner.exact + " von " + rechner.values + " Zahlen exakt, der Rest ±0,1 (Animation an Rundungsgrenzen)" }),
      woltDialogs: WOLT_DIALOGS,
      infos: burritoHalf.length ? ["Burrito-Basis = halbe Cup-Portion laut Rechner: " + burritoHalf.join(", ")] : [],
      anomalies, coriander,
      shellfish: components.some(c => c.shellfish) ? components.filter(c => c.shellfish).map(c => c.name) : "kein Baustein mit Krebs- oder Weichtieren laut Rechner",
    },
    calculator,
    components,
    wolt: {
      venue: PRIMARY, page: WOLT_PAGE(PRIMARY),
      products,
      menus: Object.fromEntries(Object.keys(TYPES).map(tp => [tp, menus[tp] ? menus[tp].groups : null])),
      shells,
      snacks,
    },
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(components.length + " Bausteine (" + CALC_TYPES.length + " Rechner-Seiten) → " + path.relative(__dirname, OUT));
  console.log("Rechner-Kontrolle: " + out._meta.rechnerControl.note + (rechner.rounding.length ? "\n  ±0,1: " + rechner.rounding.join(" · ") : ""));
  console.log("Produkte: " + out._meta.products.join(" · "));
  for (const tp of Object.keys(TYPES)) console.log(tp + ": " + out.wolt.menus[tp].map(g => g.name + " [" + g.min + "–" + g.max + "] " + g.options.map(o => o.name + (o.price ? " +" + o.price : "") + (o.optional ? " (abwählbar)" : "") + (o.addOn ? " (dazu)" : "") + (o.sauce ? " (sauce)" : "")).join(", ") + (g.none ? " + „" + g.none + "“" : "") + (g.removals.length ? " · immer: " + g.removals.join(", ") : "")).join("\n       "));
  console.log("Reihenfolge der Bestellfenster: " + products.map(p => p.name + " = " + p.dialog.join(" → ")).join(" · "));
  console.log("Snacks & Sides: " + out._meta.snacks.join(" · "));
  console.log("Snacks ohne Werte: " + snackNoData.join(" · "));
  console.log("Gesperrt: " + (out._meta.blocked.join(" · ") || "–"));
  console.log("Nicht im Tracker (Produkte): " + productNoData.join(" · "));
  console.log("Ohne Werte: " + out._meta.noData.join(" · "));
  console.log("Nie (Koriander): " + out._meta.never.join(" · "));
  console.log("Gleiche Werte: " + out._meta.sameValues.join(" · "));
  console.log("Koriander in Bausteinen: " + coriander.join(" · "));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}
main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
