// Lorys Gymfood (Wolt, Offenbach Berliner Straße) → data/lorys-raw.json (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung passiert in
// den Tabellen unten). Aufruf: node lorys-crawl.js · danach node lorys-update.js
// Quellen: offizielle Nährwerte je Gericht auf lorys-gymfood.de (Wix-Restaurant-Menü des Standorts Berliner Straße; die Menüdaten stehen als JSON im
// Script-Tag „wix-warmup-data“, die Werte als Zeile „Kcal … | KH … | E … | F …“ in der Beschreibung und gelten für die Standard-Auswahl, z.B. High
// Protein Chicken Bowl mit Sesam-Miso-Sauce — User 16.09.2026) · Menü, Namen, Preise und Pflicht-Auswahlen aus der Wolt-API von LORYS GYMFOOD.
// Breakfast und Shakes gehören nicht zum Tracker (User 16.09.2026), Getränke ebenso.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "lorys-raw.json");
const SITE_URL = "https://www.lorys-gymfood.de/menu?location=Berliner+Stra%C3%9Fe";
const SITE_LOCATION = "Berliner Straße";
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = slug => "https://wolt.com/de/deu/frankfurt/restaurant/" + slug;
const PRIMARY = "lorys-gym-food"; // Wolt „LORYS GYMFOOD“ (Offenbach), User 16.09.2026
// Website-Menüs mit Tracker-Produkten; übrige Menüs werden nur gelistet
const SITE_MENUS = ["BURGER", "BOWLS", "WRAPS", "BEILAGEN"];
const SKIPPED_SITE_MENUS = { "SHAKES": "Shakes (User 16.09.2026: ignorieren)", "BREAKFAST": "Breakfast (User 16.09.2026: ignorieren)" };
// Wolt-Kategorien → Tracker-Kategorie (id, Default an/aus); Reihenfolge wie bei Wolt
const WOLT_CATEGORIES = {
  "Bowls": { id: "bowls", on: true }, "Wraps": { id: "wraps", on: true }, "Burger": { id: "burger", on: true }, "Beilagen": { id: "beilagen", on: true },
};
const SKIPPED_WOLT_CATEGORIES = { "Protein Shakes/Smoothies": "Shakes und Smoothies (User 16.09.2026: Shakes ignorieren)", "Alkoholfreie Getränke": "Getränke" };
// Wolt-Name → Website-Name, wo die Normalisierung nicht reicht
const WOLT_TO_SITE = { "Pommes Frites": "Pommes Frites inkl. Dip", "Süßkartoffelpommes": "Süßkartoffel Pommes inkl. Dip" };
// Hinweise je Produkt (dem User genannt)
const NOTES = {
  "Pommes Frites": "Website-Name „Pommes Frites inkl. Dip“ — die Werte enthalten laut Website einen Dip; Wolt nennt keinen Dip (Artikel ohne Dip-Auswahl)",
  "Süßkartoffelpommes": "Website-Name „Süßkartoffel Pommes inkl. Dip“ — die Werte enthalten laut Website einen Dip; Wolt nennt keinen Dip (Artikel ohne Dip-Auswahl)",
};
// Gesperrt: bleibt im Datensatz, kommt nicht in den Tracker (lorys-update.js lässt es weg)
const BLOCKED = { "Spicy Gurkensalat": "User 16.09.2026: gesperrt — 101 kcal passen nicht zu 23 g Fett (4·KH + 4·E + 9·F = 259 kcal)" };
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|krebs|hummer|langust|muschel|auster|jakobsmuschel|tintenfisch|calamar|sepia|oktopus|pulpo|meeresfr/i;
const DISLIKE_RE = /koriander|cilantro|minze|\bmint/i;

const normName = s => String(s || "").normalize("NFC").replace(/[\u00a0\s]+/g, " ").trim();
const matchKey = s => normName(s).toLowerCase().replace(/[’']/g, "").replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
const H_HTML = { Accept: "text/html", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
// Wolt liefert neue Artikel nur an Clients mit Versionsangabe (siehe subway-crawl.js)
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
// Nährwert-Zeile der Website: „Kcal 732 | KH 60 | E 69 | F 23“ (Reihenfolge und Groß-/Kleinschreibung egal, jede Angabe genau einmal)
const SITE_LABELS = { kcal: "kcal", kh: "carbs", e: "protein", f: "fat" };
function parseSiteMacros(desc) {
  const line = String(desc || "").split(/\n/).map(x => x.trim()).filter(x => /^kcal\b/i.test(x)).pop();
  if (!line) return { error: "keine Nährwert-Zeile" };
  const out = {};
  for (const part of line.split("|")) {
    const m = part.trim().match(/^([A-Za-z]+)\s*([\d.,]+)\s*g?$/);
    if (!m) return { error: "unlesbar: „" + part.trim() + "“" };
    const key = SITE_LABELS[m[1].toLowerCase()];
    if (!key) return { error: "unbekannte Angabe „" + m[1] + "“" };
    if (out[key] != null) return { error: "doppelt: " + m[1] };
    out[key] = U.parseNum(m[2]);
  }
  const missing = Object.values(SITE_LABELS).filter(k => out[k] == null);
  return missing.length ? { error: "fehlt: " + missing.join(", ") } : { values: out, line };
}
// Nährwert-Angabe in der Wolt-Beschreibung (nur Vergleich): „kcal: 732 Kh: 60g E: 69g F: 23g“ bzw. „kcal: 688 C: 61 P: 30 F: 35“
function parseWoltMacros(desc) {
  const d = String(desc || "");
  const num = re => { const m = d.match(re); return m ? U.parseNum(m[1]) : null; };
  const v = { kcal: num(/kcal:\s*([\d.,]+)/i), carbs: num(/(?:Kh|C):\s*([\d.,]+)/), protein: num(/(?:E|P):\s*([\d.,]+)/), fat: num(/F:\s*([\d.,]+)/) };
  return Object.values(v).every(x => x != null) ? v : null;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [];

  // ── Website: Menüs des Standorts ──
  const html = await get(SITE_URL, H_HTML);
  const wm = html.match(/<script type="application\/json" id="wix-warmup-data">([\s\S]*?)<\/script>/);
  if (!wm) throw new Error("Website: wix-warmup-data fehlt (Seitenaufbau geändert?)");
  const warm = JSON.parse(wm[1]);
  const findKey = (o, key) => { if (!o || typeof o !== "object") return null; if (Object.prototype.hasOwnProperty.call(o, key)) return o[key]; for (const k of Object.keys(o)) { const r = findKey(o[k], key); if (r) return r; } return null; };
  const populated = findKey(warm, "populatedMenus");
  const menus = populated && populated.data && populated.data.data;
  if (!Array.isArray(menus) || !menus.length) throw new Error("Website: populatedMenus fehlt");
  const site = [], siteSkipped = [], seenSite = new Set();
  for (const menu of menus) {
    const mname = normName(menu.name), loc = normName((menu.businessLocationDetails || {}).name);
    if (loc !== SITE_LOCATION) { problems.push("Website: Menü „" + mname + "“ gehört zu Standort „" + loc + "“"); continue; }
    if (SKIPPED_SITE_MENUS[mname]) { siteSkipped.push(mname + " (" + (menu.sections || []).reduce((a, s) => a + (s.items || []).length, 0) + " Produkte) — " + SKIPPED_SITE_MENUS[mname]); continue; }
    if (!SITE_MENUS.includes(mname)) { problems.push("Website: unbekanntes Menü „" + mname + "“ (SITE_MENUS oder SKIPPED_SITE_MENUS ergänzen)"); continue; }
    for (const sec of menu.sections || []) for (const it of sec.items || []) {
      if (it.visible === false) continue;
      const name = normName(it.name);
      if (seenSite.has(matchKey(name))) { problems.push("Website: Produkt doppelt: " + name); continue; }
      seenSite.add(matchKey(name));
      const mac = parseSiteMacros(it.description);
      if (mac.error) { problems.push("Website: „" + name + "“ — Nährwerte " + mac.error); continue; }
      const modifierGroups = (it.modifierGroups || []).map(g => ({ name: normName(g.name), modifiers: (g.modifiers || []).map(m => normName(m.name) + (m.preSelected ? " (vorausgewählt)" : "")) }));
      site.push({ siteId: it.id, name, menu: mname, section: normName(sec.name), price: U.parseNum(String((it.priceInfo || {}).price || "0")), description: normName(String(it.description || "").replace(/\n+/g, " / ")), macroLine: mac.line, perServing: mac.values, modifierGroups });
    }
  }
  for (const n of SITE_MENUS) if (!menus.some(m => normName(m.name) === n)) problems.push("Website: Menü „" + n + "“ fehlt");

  // ── Wolt ──
  const assort = await get(WOLT_API(PRIMARY), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");
  const siteByKey = new Map(site.map(p => [matchKey(p.name), p]));
  const items = [], skippedWolt = [], unknownCats = [], woltDiffs = [];
  for (const c of assort.categories || []) {
    const cname = normName(c.name), def = WOLT_CATEGORIES[cname];
    if (!def) { if (SKIPPED_WOLT_CATEGORIES[cname]) skippedWolt.push(cname + " (" + (c.item_ids || []).length + " Artikel) — " + SKIPPED_WOLT_CATEGORIES[cname]); else unknownCats.push(cname); continue; }
    for (const id of c.item_ids || []) {
      const it = byItem[id];
      if (!it) continue;
      const name = normName(it.name), price = U.round(it.price / 100, 2);
      const pr = siteByKey.get(matchKey(WOLT_TO_SITE[name] || name));
      if (!pr) { problems.push("Wolt: „" + name + "“ (" + price + " €) ohne Website-Produkt (WOLT_TO_SITE ergänzen oder begründet weglassen)"); continue; }
      // Pflicht-Auswahlen (min ≥ 1) → Standard-Option laut Wolt (= Standard-Auswahl der Website-Werte); optionale Gruppen sind bei Wolt nicht vorbelegt
      const required = [], optional = [];
      for (const ref of it.options || []) {
        const g = byOpt[ref.option_id] || {}, cfg = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
        const gname = normName(ref.name), vals = (g.values || []).map(v => ({ id: v.id, name: normName(v.name), price: U.round((v.price || 0) / 100, 2) }));
        const defVal = vals.find(v => v.id === g.default_value);
        if (cfg.min >= 1) {
          if (!defVal) { problems.push("Wolt: „" + name + "“ — Pflicht-Auswahl „" + gname + "“ ohne Standard-Option"); continue; }
          if (defVal.price) problems.push("Wolt: „" + name + "“ — Standard-Option „" + defVal.name + "“ kostet extra (Preis prüfen)");
          required.push({ group: gname, choice: defVal.name, alternatives: vals.filter(v => v !== defVal).map(v => v.name + (v.price ? " +" + v.price.toFixed(2) + " €" : "")) });
        } else optional.push(gname + " [" + (cfg.min || 0) + "–" + cfg.max + "]: " + vals.map(v => v.name + (v.price ? " +" + v.price.toFixed(2) + " €" : "")).join(", "));
      }
      const wv = parseWoltMacros(it.description);
      if (wv && U.KEYS.some(k => wv[k] != null && pr.perServing[k] != null && Math.abs(wv[k] - pr.perServing[k]) > 1e-9)) woltDiffs.push(name + ": Website " + ["kcal", "carbs", "protein", "fat"].map(k => pr.perServing[k]).join("/") + " · Wolt-Beschreibung " + ["kcal", "carbs", "protein", "fat"].map(k => wv[k]).join("/"));
      const entry = { name, siteName: pr.name, siteId: pr.siteId, cat: def.id, price, sitePrice: pr.price, required, optional, woltDescription: normName(it.description) };
      if (NOTES[name]) entry.note = NOTES[name];
      if (BLOCKED[name]) entry.blocked = BLOCKED[name];
      items.push(entry);
    }
  }
  for (const n of Object.keys(BLOCKED)) if (!items.some(i => i.name === n)) problems.push("BLOCKED: Wolt-Artikel „" + n + "“ fehlt");
  if (unknownCats.length) problems.push("Wolt: unbekannte Kategorie(n) " + unknownCats.map(c => "„" + c + "“").join(", ") + " (WOLT_CATEGORIES oder SKIPPED_WOLT_CATEGORIES ergänzen)");
  for (const [w, sname] of Object.entries(WOLT_TO_SITE)) if (!site.some(p => p.name === sname)) problems.push("WOLT_TO_SITE: Website-Produkt „" + sname + "“ fehlt");
  const onWolt = new Set(items.map(i => i.siteId));
  const notOnWolt = site.filter(p => !onWolt.has(p.siteId)).map(p => p.name + " (" + p.menu + ")");
  // Plausibilität (nur kcal/KH/E/F angegeben; übrige Werte 0)
  for (const i of items) {
    const p = site.find(x => x.siteId === i.siteId);
    const issues = U.checkItem({ kcal: p.perServing.kcal, fat: p.perServing.fat, sat: 0, carbs: p.perServing.carbs, sugars: 0, fibre: 0, protein: p.perServing.protein, salt: 0 });
    if (issues.length) anomalies.push({ name: p.name, issues });
  }
  if (woltDiffs.length) anomalies.push({ name: "Wolt-Beschreibung ≠ Website", issues: ["Die Wolt-Beschreibung nennt bei " + woltDiffs.length + " Gerichten andere Werte; der Tracker nutzt die Website (vom User genannte Quelle): " + woltDiffs.join(" · ")] });
  const tracked = site.filter(p => onWolt.has(p.siteId));
  const shellfish = tracked.filter(p => SHELLFISH_RE.test(p.name + " " + p.description)).map(p => p.name);
  const dislikes = tracked.filter(p => DISLIKE_RE.test(p.name + " " + p.description)).map(p => p.name);

  const out = {
    _meta: {
      restaurant: "Lorys Gymfood", fetchedAt,
      sources: {
        nutrition: { site: SITE_URL, location: SITE_LOCATION, data: "Wix-Restaurant-Menü (Script-Tag wix-warmup-data → populatedMenus)", menus: SITE_MENUS, skippedMenus: SKIPPED_SITE_MENUS },
        wolt: { venue: PRIMARY, name: "LORYS GYMFOOD (Offenbach)", page: WOLT_PAGE(PRIMARY), api: WOLT_API(PRIMARY), categories: Object.keys(WOLT_CATEGORIES), skippedCategories: SKIPPED_WOLT_CATEGORIES },
      },
      basis: "Offizielle Werte je Gericht laut lorys-gymfood.de (Standort Berliner Straße), jeweils für die Standard-Auswahl (Pflicht-Auswahl bei Wolt = Standard-Option). Angegeben sind nur kcal, Kohlenhydrate, Eiweiß und Fett — gesättigte Fettsäuren, Zucker, Ballaststoffe und Salz fehlen und stehen als 0 im Tracker. Namen, Verfügbarkeit und Preise von Wolt (Menüpreise ohne Rabattaktionen).",
      notDeclared: ["sat", "sugars", "fibre", "salt"],
      decisions: [
        "User 16.09.2026: Lorys Gymfood als Tracker, Nährwerte aller Produkte von lorys-gymfood.de (Standort Berliner Straße); die Werte gelten für die Standard-Auswahl (z.B. High Protein Chicken Bowl mit Sesam-Miso-Sauce)",
        "User 16.09.2026: Plattform Wolt (LORYS GYMFOOD) — Namen, Verfügbarkeit, Preise",
        "User 16.09.2026: Breakfast und Shakes ignorieren",
        "User 16.09.2026: Spicy Gurkensalat sperren (Werte widersprechen sich)",
      ],
      checks: [
        "Wolt-UI 16.09.2026: optionale Gruppen mit Standard-Option sind nicht vorbelegt — Plant Based Protein Bowl „Zur Bestellung hinzufügen 12,90 €“ ohne Halloumi (+4,00 €), Pure Beef Burger ohne Bio-Spiegelei/Ketchup",
      ],
      mapping: Object.fromEntries(items.filter(i => i.name !== i.siteName).map(i => [i.name, i.siteName])),
      notes: items.filter(i => i.note).map(i => i.name + ": " + i.note),
      blocked: items.filter(i => i.blocked).map(i => i.name + " — " + i.blocked),
      skipped: [...siteSkipped.map(x => "Website: " + x), ...skippedWolt.map(x => "Wolt: " + x)],
      notOnWolt, anomalies,
      shellfish: shellfish.length ? shellfish : "keine Allergenangaben veröffentlicht; kein Produkt mit Krebs-/Weichtier-Begriff in Name oder Beschreibung (Thunfisch, Lachs = Fisch, erlaubt)",
      dislikes: dislikes.length ? dislikes : "kein Tracker-Produkt nennt Koriander oder Minze (vollständige Zutatenlisten gibt es nicht)",
    },
    site,
    wolt: { venue: PRIMARY, page: WOLT_PAGE(PRIMARY), cats: Object.entries(WOLT_CATEGORIES).map(([name, c]) => ({ id: c.id, name, on: c.on })), items },
  };
  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + problems.join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(site.length + " Website-Produkte mit Nährwerten, " + items.length + " Wolt-Produkte zugeordnet (" + items.filter(i => i.blocked).length + " gesperrt) → " + path.relative(__dirname, OUT));
  for (const c of out.wolt.cats) console.log("  " + c.name + (c.on ? "" : " (aus)") + ": " + items.filter(i => i.cat === c.id).map(i => i.name + " " + i.price + " €" + (i.required.length ? " [" + i.required.map(r => r.group + ": " + r.choice).join("; ") + "]" : "")).join(" · "));
  console.log("Zuordnung abweichend: " + (Object.entries(out._meta.mapping).map(([w, s]) => w + " = " + s).join(" · ") || "–"));
  console.log("Hinweise: " + (out._meta.notes.join(" · ") || "–"));
  console.log("Gesperrt: " + (out._meta.blocked.join(" · ") || "–"));
  console.log("Weggelassen: " + out._meta.skipped.join(" · "));
  console.log("Nicht bei Wolt: " + (notOnWolt.join(", ") || "–"));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.dislikes) ? out._meta.dislikes.join(", ") : out._meta.dislikes));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
}
module.exports = { parseSiteMacros, parseWoltMacros, matchKey };

if (require.main === module) main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
