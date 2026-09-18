// beets&roots Frankfurt (Wolt, Kaiserstraße): Bowls, Salads, Grilled Wraps, Hot Soups, Sides, Desserts → data/beetsroots-raw.json
// (Quelle der Wahrheit, NICHT von Hand editieren — Kuratierung passiert in den Tabellen unten). Aufruf: node beetsroots-crawl.js · danach node beetsroots-update.js
// Quellen (User 18.09.2026):
// · Wolt-API „beetsroots-frankfurt“ (mit Client-Version-Headern): Kategorien, Gerichte, Beschreibungen, Preise, Optionsgruppen
// · Vorbestell-Shop von beets&roots (beetsandroots.de/preorder, Backend commercetools): je Gericht die offiziellen Nährwerte **je Portion ohne Dressing**
//   (`nrgAmount`, `fatAmount`, `satFatAmount`, `carbAmount`, `sugarAmount`, `proteinAmount`, `saltAmount`), das verlinkte Dressing (Werte je 100 g) und
//   `dressingInfo` (kcal der Dressing-Portion). Genau diese Zahlen zeigt das „i“-Fenster der Website. Die Zugangsdaten des öffentlichen Frontends stehen
//   im Bundle /preorder/static/client.js und werden bei jedem Lauf frisch daraus gelesen (nichts davon landet im Repo)
// · Kontrolle: data/beetsroots-website.json — die am 18.09.2026 im Browser abgelesenen „i“-Fenster aller 46 Gerichte
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./update-lib.js");

const OUT = path.join(__dirname, "data", "beetsroots-raw.json");
const SITE_FILE = path.join(__dirname, "data", "beetsroots-website.json");
const WOLT_SLUG = "beetsroots-frankfurt";
const WOLT_API = slug => "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/" + slug + "/assortment?language=de";
const WOLT_PAGE = "https://wolt.com/de/deu/frankfurt/restaurant/" + WOLT_SLUG;
const SITE_MENU = "https://www.beetsandroots.de/preorder/menu/frankfurt-kaiserstrasse";
const SITE_BUNDLE = "https://www.beetsandroots.de/preorder/static/client.js";
const STORE_NAME = "Frankfurt Kaiserstraße";

// Wolt-Kategorie → Tracker-Kategorie (User 18.09.2026: Kategorien wie bei Wolt, Getränke und Smoothies ignorieren)
const CATS = {
  "Seasonals": "bowls", "Favourites": "bowls", "Signature Bowls": "bowls",
  "Fresh Salads": "salads", "Grilled Wraps": "wraps", "Hot Soups": "soups", "Sides": "sides", "Desserts": "desserts",
};
const CAT_NAMES = { bowls: "Bowls", salads: "Fresh Salads", wraps: "Grilled Wraps", soups: "Hot Soups", sides: "Sides", desserts: "Desserts" };
const SKIPPED_CATS = {
  "Smoothies & Shakes": "Smoothies und Shakes (User 18.09.2026: Getränke ignorieren)",
  "Non-Alcoholic Drinks": "Getränke (User 18.09.2026)", "Alcoholic Drinks": "Getränke (User 18.09.2026)",
};
// Wolt-Optionsgruppen: Extras ohne eigene Nährwerte → der Tracker nutzt sie nicht (wie Lorys-Add-ons)
const OPTION_GROUPS = ["Choose Extras", "Choose Vegan Extras"];
// Gerichte, deren Dressing im Gericht steckt und immer mitgegessen wird (User 18.09.2026: Grilled Wraps)
const DRESSING_FIXED_CAT = "wraps";
// Koriander/Minze (User 13.09.2026): als wählbare Komponente nie vorschlagen — bei beets&roots sind sie feste Zutaten fertiger Gerichte
const HERB_RE = /koriander|minze|cilantro|mint\b/i;
const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|krabbe|crab|krebs|hummer|langust|muschel|mussel|auster|oyster|tintenfisch|calamar|sepia|oktopus|octopus|pulpo|meeresfr/i;

const normName = s => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();
const lower = s => normName(s).toLowerCase();
const euro = v => U.round(v, 2);
const WOLT_HEADERS = { Accept: "application/json", "Accept-Language": "de-DE", "App-Language": "de", "User-Agent": "Mozilla/5.0", Platform: "Web", "Client-Version": "1.16.49", ClientVersionNumber: "1.16.49" };
const H = { Accept: "*/*", "Accept-Language": "de-DE", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
async function get(url, headers, json) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("HTTP " + r.status + " für " + url);
  return json ? r.json() : r.text();
}
// „638kcal“ · „635 kcal“ · „478kcal/1999kJ“ · „888“ → 638 / 635 / 478 / 888
function parseKcal(v, what, problems) {
  const s = String(v == null ? "" : v).replace(",", ".");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:kcal)?/i);
  if (!m) { problems.push(what + ": kcal unlesbar („" + s + "“)"); return null; }
  return Number(m[1]);
}
function parseNum(v, what, problems) {
  if (v == null || v === "") { problems.push(what + ": Wert fehlt"); return null; }
  const n = Number(String(v).replace(",", "."));
  if (!isFinite(n) || n < 0) { problems.push(what + ": Wert unlesbar („" + v + "“)"); return null; }
  return n;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const problems = [], anomalies = [], infos = [];

  // ── beets&roots Vorbestell-Shop: Zugangsdaten aus dem öffentlichen Bundle, Token, Produkte ──
  const bundle = await get(SITE_BUNDLE, H, false);
  const seg = bundle.slice(Math.max(0, bundle.indexOf("auth.europe-west1.gcp.commercetools.com") - 200), bundle.indexOf("auth.europe-west1.gcp.commercetools.com") + 900);
  const cfg = {
    authHost: (seg.match(/host:"(https:\/\/auth[^"]+)"/) || [])[1],
    projectKey: (seg.match(/projectKey:"([^"]+)"/) || [])[1],
    clientId: (seg.match(/clientId:"([^"]+)"/) || [])[1],
    clientSecret: (seg.match(/clientSecret:"([^"]+)"/) || [])[1],
    scopes: (seg.match(/scopes:\["([^"]+)"\]/) || [])[1],
    api: (seg.match(/api:"(https:\/\/api[^"]+)"/) || [])[1],
  };
  for (const k of Object.keys(cfg)) if (!cfg[k]) throw new Error("Shop-Zugang: „" + k + "“ nicht im Frontend-Bundle gefunden (Aufbau geändert?)");
  const viewScopes = cfg.scopes.split(" ").filter(s => /^view_/.test(s)).join(" "); // nur Lese-Rechte anfordern
  const tokenRes = await fetch(cfg.authHost + "/oauth/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(cfg.clientId + ":" + cfg.clientSecret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent(viewScopes),
  });
  if (!tokenRes.ok) throw new Error("Shop-Token: HTTP " + tokenRes.status);
  const token = (await tokenRes.json()).access_token;
  const products = [];
  for (let offset = 0; ; offset += 500) {
    const url = cfg.api + "/" + cfg.projectKey + "/product-projections/search?staged=false&priceCurrency=EUR&priceCountry=DE&markMatchingVariants=false&limit=500&offset=" + offset +
      "&expand=categories%5B*%5D&expand=productType";
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error("Shop-Produkte: HTTP " + r.status);
    const d = await r.json();
    products.push(...(d.results || []));
    if (products.length >= d.total || !(d.results || []).length) break;
  }
  const byId = new Map(products.map(p => [p.id, p]));
  const at = (p, n) => { const a = ((p.masterVariant || {}).attributes || []).find(x => x.name === n); return a ? a.value : undefined; };
  const slugOf = p => (p.slug && (p.slug["de-DE"] || p.slug["en-US"])) || "";
  const store = products.flatMap(p => (p.masterVariant.prices || [])).map(x => x.channel).filter(Boolean)
    .find(c => c.obj && normName((c.obj.name || {})["de-DE"] || (c.obj.name || {})["en"]) === STORE_NAME);
  const STORE_ID = "859ae05c-4136-42e8-94cb-daf76d6645ce"; // Frankfurt Kaiserstraße (Kaiserstrasse 44), Preis-Kanal des Vorbestell-Shops
  const storePrice = p => { const x = (p.masterVariant.prices || []).find(y => y.channel && y.channel.id === STORE_ID); return x ? x.value.centAmount / 100 : null; };
  // Nährwert-Produkte: nicht Catering, mit Energie-Angabe
  const nutriProducts = products.filter(p => at(p, "nrgAmount") !== undefined && !/^catering-/.test(slugOf(p)));
  const byName = new Map();
  for (const p of nutriProducts) { const k = lower(p.name["de-DE"] || ""); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(p); }
  // Saucen/Dressings des Shops mit vollständigen Werten je 100 g — Verzeichnis für Gerichte ohne verknüpftes Dressing-Produkt
  const D_NUT = [["kcal", "energyAmount"], ["fat", "fatAmount"], ["sat", "satFatAmount"], ["carbs", "carbAmount"], ["sugars", "sugarAmount"], ["protein", "proteinAmount"], ["salt", "saltAmount"]];
  const per100Of = p => { const o = {}; for (const [k, attr] of D_NUT) { const v = at(p, attr); const n = v == null || v === "" ? NaN : Number(String(v).replace(",", ".")); if (!isFinite(n)) return null; o[k] = n; } return o.kcal > 0 ? o : null; };
  const SAUCES = products.filter(p => ((at(p, "type") || {}).key === "DRESSING")).map(p => ({ name: normName(p.name["de-DE"] || ""), product: slugOf(p), per100: per100Of(p) })).filter(x => x.name && x.per100);

  // ── Wolt ──
  const assort = await get(WOLT_API(WOLT_SLUG), WOLT_HEADERS, true);
  const byItem = Object.fromEntries((assort.items || []).map(i => [i.id, i]));
  const byOpt = Object.fromEntries((assort.options || []).map(o => [o.id, o]));
  const missingItems = [...new Set((assort.categories || []).flatMap(c => c.item_ids || []))].filter(id => !byItem[id]);
  if (missingItems.length) problems.push("Wolt: " + missingItems.length + " Kategorie-Artikel ohne Daten (Client-Header prüfen)");

  const siteRef = U.readJSON(SITE_FILE);
  const NUT = [["kcal", "nrgAmount"], ["fat", "fatAmount"], ["sat", "satFatAmount"], ["carbs", "carbAmount"], ["sugars", "sugarAmount"], ["protein", "proteinAmount"], ["salt", "saltAmount"]];
  const dishes = [], noData = [], seen = new Set(), skipped = [], optionGroups = new Map(), coriander = [], mint = [], siteDiffs = [], fromDesc = [];

  for (const c of assort.categories || []) {
    const cname = normName(c.name);
    if (SKIPPED_CATS[cname]) { skipped.push(cname + " — " + SKIPPED_CATS[cname]); continue; }
    const cat = CATS[cname];
    if (!cat) { problems.push("Wolt: unbekannte Kategorie „" + cname + "“"); continue; }
    for (const id of c.item_ids || []) {
      const it = byItem[id];
      if (!it) continue;
      const name = normName(it.name);
      if (seen.has(name)) continue; // dasselbe Gericht steht bei Wolt in mehreren Kategorien
      seen.add(name);
      const price = euro(it.price / 100), desc = normName(it.description);
      // Optionsgruppen nur dokumentieren (Extras ohne Nährwerte)
      for (const ref of it.options || []) {
        const gname = normName(ref.name), g = byOpt[ref.option_id] || {}, cfgG = (ref.multi_choice_config && ref.multi_choice_config.total_range) || {};
        if (!OPTION_GROUPS.includes(gname)) { problems.push("Wolt: unbekannte Optionsgruppe „" + gname + "“ (" + name + ")"); continue; }
        if (!optionGroups.has(gname)) optionGroups.set(gname, { name: gname, max: cfgG.max, options: (g.values || []).map(v => normName(v.name) + " +" + euro(v.price / 100) + " €") });
      }
      // Website-Produkt
      let cands = byName.get(lower(name)) || [];
      if (cands.length > 1) { const withPrice = cands.filter(p => storePrice(p) != null); if (withPrice.length) cands = withPrice; }
      if (cands.length !== 1) { problems.push("Website: Gericht „" + name + "“ " + cands.length + "× gefunden (erwartet 1)" + (cands.length ? ": " + cands.map(slugOf).join(", ") : "")); continue; }
      const p = cands[0], where = name;
      const values = {};
      let incomplete = [];
      for (const [k, attr] of NUT) {
        const raw = at(p, attr);
        if (raw === undefined || raw === null || raw === "") { incomplete.push(k); continue; }
        const v = k === "kcal" ? parseKcal(raw, where + " " + attr, problems) : parseNum(raw, where + " " + attr, problems);
        if (v == null) incomplete.push(k); else values[k] = v;
      }
      const dressRefs = at(p, "dressing") || [];
      const dressInfo = normName(at(p, "dressingInfo") || "");
      const dressKcal = dressInfo ? parseKcal(dressInfo, where + " dressingInfo", problems) : null;
      const dressProducts = dressRefs.map(r => byId.get(r.id)).filter(Boolean);
      let dressing = null, dressingNote = null;
      // Portion des Dressings: die Website nennt die kcal der Portion und die Werte je 100 g → Gramm = kcal / (kcal je 100 g) × 100
      const mkDressing = (dn, prod, per100, via) => {
        const grams = U.round(dressKcal / per100.kcal * 100, 2);
        const vals = Object.fromEntries(D_NUT.map(([k]) => [k, U.round(per100[k] * grams / 100, 2)]));
        vals.kcal = dressKcal;
        if (grams < 3 || grams > 200) problems.push(where + ": Dressing „" + dn + "“ ergäbe " + grams + " g (" + dressKcal + " kcal / " + per100.kcal + " je 100 g) — unplausible Portion");
        return { name: dn, product: prod, per100, portionKcal: dressKcal, grams, values: vals, info: dressInfo, via };
      };
      if (dressProducts.length === 1 && dressKcal != null) {
        const dp = dressProducts[0], dname = normName(dp.name["de-DE"]), per100 = per100Of(dp);
        if (per100) dressing = mkDressing(dname, slugOf(dp), per100, "Dressing-Produkt des Gerichts");
        else { problems.push(where + ": Dressing „" + dname + "“ ohne vollständige Werte je 100 g"); dressingNote = "Dressing-Werte je 100 g unvollständig"; }
      } else if (dressProducts.length > 1) dressingNote = "mehrere Dressings (" + dressProducts.map(x => normName(x.name["de-DE"])).join(" + ") + ") — die Website nennt nur die kcal der Portion zusammen, die Aufteilung ist unbekannt";
      else if (dressKcal != null) {
        // Kein Dressing-Produkt verknüpft: nennt die Beschreibung genau eine Sauce des Shops, gelten deren offizielle Werte je 100 g (User 18.09.2026)
        const hits = SAUCES.filter(x => lower(desc).includes(lower(x.name)));
        if (hits.length === 1) {
          dressing = mkDressing(hits[0].name, hits[0].product, hits[0].per100, "in der Beschreibung genannt");
          fromDesc.push(name + ": " + hits[0].name + " — " + dressKcal + " kcal / " + hits[0].per100.kcal + " kcal je 100 g = " + dressing.grams + " g");
        } else if (hits.length > 1) dressingNote = "mehrere Saucen laut Beschreibung (" + hits.map(x => x.name).join(" + ") + ") — die Website nennt nur die kcal der Portion zusammen (" + dressInfo + "), die Aufteilung ist unbekannt";
        else dressingNote = "kein Dressing-Produkt verknüpft und keine bekannte Sauce in der Beschreibung — nur die kcal der Portion (" + dressInfo + ")";
      } else if (dressInfo) dressingNote = "kein Dressing-Produkt verknüpft — nur die kcal der Portion (" + dressInfo + ")";

      const allergens = ((at(p, "allergene") || [])[0] || {})["de-DE"] || "";
      const dish = {
        name, cat, price, description: desc, website: slugOf(p), websitePrice: storePrice(p),
        values, fibreNotDeclared: true, dressing, dressingNote, dressingInfo: dressInfo || null, allergens: normName(allergens),
        dressingFixed: cat === DRESSING_FIXED_CAT,
      };
      if (incomplete.length) {
        dish.noData = "Website nennt nur " + Object.keys(values).join(", ") + " — es fehlen " + incomplete.join(", ");
        noData.push(name + " (" + CAT_NAMES[cat] + ", " + price.toFixed(2) + " €) — " + dish.noData);
      } else {
        const issues = U.checkItem({ ...values, fibre: 0 });
        if (issues.length) anomalies.push({ name, issues });
      }
      const text = name + " " + desc + " " + (dressing ? dressing.name : "");
      if (/koriander|cilantro/i.test(text)) coriander.push(name);
      if (/minze|mint\b/i.test(text)) mint.push(name);
      if (SHELLFISH_RE.test(text)) dish.shellfish = true;
      dishes.push(dish);

      // ── Kontrolle gegen die abgelesenen „i“-Fenster ──
      const ref = (siteRef.dishes || {})[name];
      if (!ref) siteDiffs.push(name + ": nicht in data/beetsroots-website.json");
      else {
        const shown = ref.values, order = ["kcal", "fat", "sat", "carbs", "sugars", "protein", "salt"];
        order.forEach((k, i) => {
          const s = shown[i];
          if (s == null) { if (values[k] !== undefined) siteDiffs.push(name + ": " + k + " im „i“-Fenster leer, Shop nennt " + values[k]); return; }
          const num = k === "kcal" ? parseKcal(s, name + " (Fenster) " + k, problems) : parseNum(s, name + " (Fenster) " + k, problems);
          if (num != null && values[k] !== undefined && Math.abs(num - values[k]) > 0.001) siteDiffs.push(name + ": " + k + " Fenster " + num + " ≠ Shop " + values[k]);
        });
        const refDress = ref.dressing ? ref.dressing.split("|")[0] : null;
        if (refDress && (!dressing || dressing.name !== refDress) && dressProducts.length <= 1) siteDiffs.push(name + ": Dressing Fenster „" + refDress + "“ ≠ Shop „" + (dressing ? dressing.name : "—") + "“");
        if (refDress && dressing) {
          const per = ref.dressing.split("|")[1].split(",");
          ["kcal", "fat", "sat", "carbs", "sugars", "protein", "salt"].forEach((k, i) => {
            if (per[i] === undefined || per[i] === "") return; // unvollständige Fenster-Spalte (Burrito Chicken Bowl)
            const num = parseNum(per[i], name + " (Fenster) Dressing " + k, problems);
            if (num != null && Math.abs(num - dressing.per100[k]) > 0.001) siteDiffs.push(name + ": Dressing " + k + " je 100 g Fenster " + num + " ≠ Shop " + dressing.per100[k]);
          });
        }
        if (normName(ref.dressingInfo || "") !== (dressInfo || "")) siteDiffs.push(name + ": Dressing-Zeile Fenster „" + ref.dressingInfo + "“ ≠ Shop „" + dressInfo + "“");
      }
    }
  }
  const refOnly = Object.keys(siteRef.dishes || {}).filter(n => !seen.has(n));
  if (refOnly.length) infos.push("Nur im „i“-Fenster-Abgleich, nicht bei Wolt: " + refOnly.join(", "));
  if (siteDiffs.length) problems.push("Abweichungen zum „i“-Fenster: " + siteDiffs.join(" | "));

  const out = {
    _meta: {
      source: "Wolt-API " + WOLT_SLUG + " (" + WOLT_PAGE + ") + Vorbestell-Shop von beets&roots (" + SITE_MENU + ", commercetools-Projekt „" + cfg.projectKey + "“, Filiale " + STORE_NAME + ")",
      fetchedAt,
      basis: "Offizielle Werte je Portion laut „i“-Fenster der Website — **ohne Dressing** (Fußnote „*ohne Dressing“). Ballaststoffe nennt beets&roots nicht → 0. " +
        "Dressing: Werte je 100 g der Sauce + kcal der Portion → Portionsgramm = kcal / (kcal je 100 g) × 100. Die Sauce steht entweder als Produkt am Gericht oder namentlich in der Beschreibung",
      rules: [
        "Wolt: jedes Gericht ein eigener Artikel; Preis = Wolt-Menüpreis (die Website ist meist 2,00 € günstiger)",
        "Keine Nährwerte je Zutat und keine Custom Bowl → nur die Standard-Zusammenstellung der Gerichte (User 18.09.2026)",
        "Optionsgruppen „Choose Extras“ / „Choose Vegan Extras“ haben keine Nährwerte → der Tracker nutzt sie nicht",
        "Grilled Wraps: Sauce/Dressing steckt im Wrap und wird immer mitgegessen → ihre Werte enthalten das Dressing",
      ],
      decisions: [
        "User 18.09.2026: beets&roots (Wolt, Kaiserstraße) als Tracker mit den Wolt-Kategorien Bowls, Fresh Salads, Grilled Wraps, Hot Soups, Sides, Desserts; Getränke und Smoothies ignorieren",
        "User 18.09.2026: Nährwerte einzeln über das „i“-Symbol der Website ziehen (erledigt: data/beetsroots-website.json, alle 46 Gerichte)",
        "User 18.09.2026: Schalter „No dressing“, „No soups“ und „No desserts“ per Default AN; der Order Guide sagt „don't eat the dressing“, wo die Werte es nicht enthalten",
        "User 18.09.2026: bei den Grilled Wraps gehört die Sauce zum Wrap und wird mitgerechnet",
        "User 18.09.2026: die Sauce lässt sich aus ihren kcal und ihren Werten je 100 g hochrechnen — nennt die Beschreibung genau eine Sauce des Shops, gilt sie auch ohne verknüpftes Dressing-Produkt",
      ],
      store: { name: STORE_NAME, id: STORE_ID },
      dressingFromDescription: fromDesc,
      siteControl: { file: "data/beetsroots-website.json", capturedAt: siteRef.capturedAt, checked: dishes.length, diffs: siteDiffs },
      optionGroups: [...optionGroups.values()],
      skippedCategories: skipped,
      noData,
      anomalies,
      coriander: [...new Set(coriander)],
      mint: [...new Set(mint)],
      shellfish: dishes.some(d => d.shellfish) ? dishes.filter(d => d.shellfish).map(d => d.name) : "kein Gericht mit Krebs- oder Weichtieren (Lachs = Fisch, „Schalenfrüchte“ = Nüsse)",
      infos,
    },
    wolt: { slug: WOLT_SLUG, page: WOLT_PAGE, cats: Object.entries(CAT_NAMES).map(([id, name]) => ({ id, name })) },
    dishes,
  };

  if (problems.length) { console.error("\nPROBLEME — raw.json wird NICHT geschrieben:\n  " + [...new Set(problems)].join("\n  ")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(dishes.length + " Gerichte → " + path.relative(__dirname, OUT));
  for (const [id, name] of Object.entries(CAT_NAMES)) {
    const list = dishes.filter(d => d.cat === id);
    console.log("  " + name + " (" + list.length + "): " + list.map(d => d.name + " " + d.price.toFixed(2) + " €" + (d.noData ? " [ohne Werte]" : " " + Math.round(d.values.kcal) + " kcal") + (d.dressing ? " +" + d.dressing.name + " " + d.dressing.portionKcal + " kcal" : d.dressingNote ? " (Dressing?)" : "")).join(" · "));
  }
  console.log("Kontrolle „i“-Fenster: " + dishes.length + " Gerichte, " + siteDiffs.length + " Abweichungen");
  console.log("Ohne vollständige Werte: " + (noData.length ? noData.join(" · ") : "keine"));
  console.log("Dressing über die Beschreibung bestimmt (" + fromDesc.length + "): " + (fromDesc.join(" · ") || "keine"));
  console.log("Dressing nicht bezifferbar: " + (dishes.filter(d => d.dressingNote).map(d => d.name + " — " + d.dressingNote).join(" · ") || "keine"));
  console.log("Koriander: " + out._meta.coriander.join(", ") + "\nMinze: " + out._meta.mint.join(", "));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(", ") : out._meta.shellfish));
  console.log("Nicht im Tracker (Kategorien): " + skipped.join(" · "));
  console.log("Optionsgruppen (ohne Werte, nicht genutzt): " + [...optionGroups.values()].map(g => g.name + " (bis " + g.max + ": " + g.options.length + " Optionen)").join(" · "));
  console.log("Auffälligkeiten (" + anomalies.length + "):\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  "));
  if (infos.length) console.log("Hinweise: " + infos.join(" · "));
}

if (require.main === module) main().catch(e => { console.error("FEHLER: " + e.stack); process.exit(1); });
