// Logik-Tests für index.html (ohne Browser): node tests.js
// Harness wie im London-Tool: das EINE attributlose Inline-<script> per Regex laden, React/ReactDOM/document/localStorage
// stubben, per indirektem eval ausführen und die zu testenden Funktionen an globalThis.__t hängen.
// Strings immer als check(name, a === b, true) prüfen (check vergleicht Zahlen mit Toleranz 0.05, Booleans mit ===).
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: inline <script> nicht gefunden"); process.exit(1); }
const SCRIPT = m[1];

global.React = { useState: () => [null, () => {}], useMemo: (f) => f, useEffect: () => {}, createElement: () => null };
global.ReactDOM = { render: () => {}, createRoot: () => ({ render: () => {} }) };
global.document = { getElementById: () => null };
const lsStore = new Map();
global.localStorage = { getItem: k => (lsStore.has(k) ? lsStore.get(k) : null), setItem: (k, v) => lsStore.set(k, String(v)), removeItem: k => lsStore.delete(k) };

(0, eval)(SCRIPT + "\n;globalThis.__t = { LS_PREFIX, LS, lsGet, lsSet, COMPLEAT, KEYS, sumN, score, scoreVec, sortResults, parseMacroScreenshot, SHELLFISH_RE, SHELLFISH_NAMES, SHELLFISH_SAFE, isShellfish, comboLabel, acOrderSteps, resultKey, alaCarteCombos, bowlCombos, bowlShareL, bowlShareLB, bowlOverLB, bowlSummary, bowlOrderSteps, bowlSearchEntries, bowlExcludables, bowlValidate, switchPass, COMPLEAT_BLOCKED, compleatOptimize, RESERVED_TABS, defaultRestoState, initRestoStates, allState, toggleSwitch, optimizeAC, runOptimize, orderStepsFor, searchEntriesFor, summarizeResult, RESTAURANTS, RESTO_BY_KEY, validateRegistry, optimizeAll, buildSearchIndex, SEARCH_INDEX, foldVariants, searchItems, orderTotal, matchesQuery, excludablesFor, SPECIAL_TABS, DEFAULT_TAB };");
const T = globalThis.__t;
const U = require("./update-lib.js");

let failures = 0, passes = 0;
const approx = (a, b) => Math.abs(a - b) < 0.05;
const check = (name, actual, expected) => {
  const ok = typeof expected === "boolean" ? actual === expected : approx(actual, expected);
  if (ok) passes++; else failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${actual}${typeof expected === "boolean" ? "" : ` (erwartet ${expected})`}`);
};
const sect = s => console.log("\n── " + s + " ──");
// Test-Helfer: Item mit stimmigen kcal (4·C + 4·P + 9·F), Ziel im Makro-Modus, sortierte id-Signatur eines Ergebnisses
const it = (id, cat, carbs, protein, fat, extra) => Object.assign({ id, name: id, cat, kcal: 4 * carbs + 4 * protein + 9 * fat, fat, sat: 0, carbs, sugars: 0, fibre: 0, protein, salt: 0 }, extra || {});
const tgt = (protein, carbs, fat, more) => Object.assign({ protein, carbs, fat, kcal: protein * 4 + carbs * 4 + fat * 9, fibMin: null, fibMax: null, sMin: null, sMax: null }, more || {});
const kcalT = (kcal, more) => Object.assign({ protein: 0, carbs: 0, fat: 0, kcal, fibMin: null, fibMax: null, sMin: null, sMax: null }, more || {});
const ids = r => (r ? r.items.map(x => x.id).sort().join("|") : "");
const throws = f => { try { f(); return false; } catch (e) { return true; } };

// ── Struktur / Harness ──
sect("Struktur / Harness");
check("genau EIN attributloses Inline-<script>", (html.match(/<script>/g) || []).length, 1);
check("React-Destructuring wie London", SCRIPT.includes("const { useState, useMemo, useEffect, createElement: h } = React;"), true);
check("localStorage nur über LS_PREFIX + key", /localStorage\.\w+\((?!LS_PREFIX \+)/.test(SCRIPT), false);
check("LS_PREFIX ist fra_", T.LS_PREFIX === "fra_", true);
T.lsSet(T.LS.ownOrder, [{ qty: 2 }]);
check("lsSet schreibt fra_own_order (nicht own_order)", lsStore.has("fra_own_order") && !lsStore.has("own_order"), true);
T.lsSet(T.LS.excluded, { compleat: ["huehnchen"] });
check("Ausschluss-Liste landet in fra_excluded", lsStore.has("fra_excluded") && T.lsGet(T.LS.excluded, {}).compleat[0] === "huehnchen", true);
check("lsGet liest zurück", T.lsGet(T.LS.ownOrder, [])[0].qty, 2);
lsStore.set("fra_kaputt", "{kein json");
check("lsGet: kaputtes JSON → Fallback", T.lsGet("kaputt", "fb") === "fb", true);
check("lsGet: fehlender Key → Fallback", T.lsGet("gibtsnicht", 7), 7);
check("keine Vergleiche mit Registry-Keys im Code (Registry statt Sonderlogik)", T.RESTAURANTS.every(r => !new RegExp('===\\s*"' + r.key + '"').test(SCRIPT)), true);
check("DEFAULT_TAB = erstes Registry-Restaurant", T.DEFAULT_TAB === (T.RESTAURANTS[0] ? T.RESTAURANTS[0].key : "all"), true);
check("Spezial-Tabs in Reihenfolge: Add own order · Accurate · All", T.SPECIAL_TABS.map(s => s.key).join(",") === "search,accurate,all", true);
check("Spezial-Tabs = RESERVED_TABS", T.SPECIAL_TABS.every(s => T.RESERVED_TABS.includes(s.key)), true);
check("Demo Bistro vollständig entfernt (Code, Registry, Dateien)", !/DEMO|Demo Bistro/.test(SCRIPT) && !T.RESTO_BY_KEY.demo && !fs.existsSync(__dirname + "/demo-update.js") && !fs.existsSync(__dirname + "/data/demo-raw.json"), true);

// ── sumN ──
sect("sumN");
const a1 = { kcal: 100.04, fat: 1, sat: 0.5, carbs: 10, sugars: 2, fibre: 1, protein: 5, salt: 0.33 };
const a2 = { kcal: 0.03, fat: 2, sat: 0.25, carbs: 5, sugars: 1, fibre: 0.5, protein: 10, salt: 0.33 };
check("sumN: Rundung auf 1 Dezimale (100.04 + 0.03 → 100.1)", T.sumN([a1, a2], 1).kcal, 100.1);
check("sumN: Salz 0.33 + 0.33 → 0.7", T.sumN([a1, a2], 1).salt, 0.7);
check("sumN: alle 8 Keys vorhanden", T.KEYS.every(k => typeof T.sumN([a1], 1)[k] === "number"), true);
check("sumN: mult ×2", T.sumN([a1], 2).protein, 10);
check("sumN: singleItems zählen ×1", T.sumN([a1], 2, [a2]).protein, 20);
check("sumN: fehlende Keys = 0, null-Items übersprungen", T.sumN([{ kcal: 50 }, null], 1).fat, 0);
check("sumN: leere Liste = 0", T.sumN([], 1).kcal, 0);

// ── score + scoreVec ──
sect("score / scoreVec");
const tS = tgt(50, 100, 20);
const aS = { kcal: 0, protein: 50, carbs: 100, fat: 20, fibre: 0, salt: 0 };
check("score Makro: exakt = 0", T.score(aS, tS, "macros", {}), 0);
check("score Makro: Protein −10 → 10/50×3 = 0.6", T.score({ ...aS, protein: 40 }, tS, "macros", {}), 0.6);
check("score Makro: Carbs +10 → 10/100×2 = 0.2", T.score({ ...aS, carbs: 110 }, tS, "macros", {}), 0.2);
check("score Makro: Fett −2 → 2/20×2 = 0.2", T.score({ ...aS, fat: 18 }, tS, "macros", {}), 0.2);
check("score Makro: Ziel 0 wird ignoriert", T.score({ ...aS, fat: 99 }, { ...tS, fat: 0 }, "macros", {}), 0);
const tK = kcalT(500);
const hiP = { kcal: 500, protein: 50, carbs: 50, fat: 0, fibre: 0, salt: 0 }; // Protein- und Carb-Anteil je 0.4
check("score kcal: Abweichung ×4 (600 statt 500 → 0.8)", T.score({ kcal: 600, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0 }, tK, "calories", {}), 0.8);
check("score kcal: High Protein belohnt (−0.4×2 = −0.8)", T.score(hiP, tK, "calories", { hp: true }), -0.8);
check("score kcal: Low Carb bestraft (+0.4×2 = +0.8)", T.score(hiP, tK, "calories", { lc: true }), 0.8);
const fatty = { kcal: 500, protein: 10, carbs: 20, fat: 46.7, fibre: 0, salt: 0 };
check("score kcal: HP+LF bevorzugt proteinreich vor fettreich", T.score(hiP, tK, "calories", { hp: true, lf: true }) < T.score(fatty, tK, "calories", { hp: true, lf: true }), true);
check("score: Fibre unter Min → (10−4)×0.5 = 3", T.score({ ...aS, fibre: 4 }, { ...tS, fibMin: 10 }, "macros", {}), 3);
check("score: Fibre über Max → (9−5)×0.5 = 2", T.score({ ...aS, fibre: 9 }, { ...tS, fibMax: 5 }, "macros", {}), 2);
check("score: Salz unter Min → (1−0.5)×0.3 = 0.15", T.score({ ...aS, salt: 0.5 }, { ...tS, sMin: 1 }, "macros", {}), 0.15);
check("score: Salz über Max → (3−2)×0.3 = 0.3", T.score({ ...aS, salt: 3 }, { ...tS, sMax: 2 }, "macros", {}), 0.3);
check("score: Fibre-Strafe auch im kcal-Modus", T.score({ ...hiP, fibre: 4 }, { ...tK, fibMin: 10 }, "calories", {}), 3);
let svSeed = 7, svOk = true;
const svRnd = () => (svSeed = (svSeed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 400; i++) {
  const n = T.KEYS.map(() => Math.round(svRnd() * 2000) / 10);
  const obj = Object.fromEntries(T.KEYS.map((k, j) => [k, n[j]]));
  const t = i % 2 ? tgt(Math.round(svRnd() * 150), Math.round(svRnd() * 150), Math.round(svRnd() * 50), { fibMin: svRnd() < 0.3 ? 10 : null, fibMax: svRnd() < 0.3 ? 20 : null, sMin: svRnd() < 0.3 ? 1 : null, sMax: svRnd() < 0.3 ? 3 : null }) : kcalT(Math.round(200 + svRnd() * 900), { fibMin: svRnd() < 0.3 ? 12 : null });
  const p = { hp: svRnd() < 0.5, lp: svRnd() < 0.2, hc: svRnd() < 0.3, lc: svRnd() < 0.3, hf: svRnd() < 0.2, lf: svRnd() < 0.5 };
  const mode = i % 2 ? "macros" : "calories";
  if (Math.abs(T.scoreVec(n, t, mode, p) - T.score(obj, t, mode, p)) > 1e-12) svOk = false;
}
check("scoreVec == score (400 Zufallsfälle, beide Modi, Constraints)", svOk, true);

// ── sortResults ──
sect("sortResults");
const srcRes = [
  { nutrition: { kcal: 590, protein: 45, carbs: 40, fat: 30 }, score: 0.05 },
  { nutrition: { kcal: 500, protein: 30, carbs: 50, fat: 20 }, score: 0.1 },
  { nutrition: { kcal: 700, protein: 60, carbs: 70, fat: 10 }, score: 0.2 },
  { nutrition: { kcal: 610, protein: 45, carbs: 60, fat: 15 }, score: 0.3 },
];
const tgts = { kcal: 600, protein: 50, carbs: 60, fat: 15 };
const monotone = (arr, key, tv) => arr.every((r, i) => i === 0 || Math.abs(arr[i - 1].nutrition[key] - tv) <= Math.abs(r.nutrition[key] - tv));
check("sortResults 'score' = unverändert (gleiche Referenz)", T.sortResults(srcRes, "score", tgts) === srcRes, true);
check("sortResults kcal: aufsteigende |Ist−Ziel|", monotone(T.sortResults(srcRes, "kcal", tgts), "kcal", 600), true);
check("sortResults protein: aufsteigende |Ist−Ziel|", monotone(T.sortResults(srcRes, "protein", tgts), "protein", 50), true);
check("sortResults carbs: Top = exakter Treffer (60 g)", T.sortResults(srcRes, "carbs", tgts)[0].nutrition.carbs, 60);
check("sortResults: Tie-Breaker Score (590/610 kcal gleich weit → Score 0.05 zuerst)", T.sortResults(srcRes, "kcal", tgts)[0].score, 0.05);
check("sortResults mutiert Original nicht", srcRes.map(r => r.score).join(",") === "0.05,0.1,0.2,0.3", true);

// ── alaCarteCombos ──
sect("alaCarteCombos");
const A = it("a", "x", 40, 10, 5), Bq = it("b", "x", 10, 30, 5), C = it("c", "x", 20, 5, 10), Dd = it("d", "x", 5, 20, 2), E = it("e", "x", 30, 2, 1);
const POOL = [A, Bq, C, Dd, E];
const rSingle = T.alaCarteCombos(tgt(10, 40, 5), "macros", {}, POOL, 1);
check("Singles: exakter Treffer zuerst (a, Score 0)", rSingle[0].items.length === 1 && rSingle[0].items[0].id === "a" && rSingle[0].score === 0, true);
check("maxN=1: nur Einzel-Items", rSingle.every(r => r.items.length === 1), true);
const rPair = T.alaCarteCombos(tgt(40, 50, 10), "macros", {}, POOL, 2);
check("Paare: a+b als Top-1", ids(rPair[0]) === "a|b", true);
check("maxN=2: höchstens 2 Items", rPair.every(r => r.items.length <= 2), true);
const rDup = T.alaCarteCombos(tgt(20, 80, 10), "macros", {}, POOL, 2);
check("Duplikate erlaubt: 2× a als Top-1", ids(rDup[0]) === "a|a", true);
const rTri = T.alaCarteCombos(tgt(45, 70, 20), "macros", {}, POOL, 3);
check("Beam (maxN=3): a+b+c als Top-1", ids(rTri[0]) === "a|b|c", true);
check("maxN=3: höchstens 3 Items", rTri.every(r => r.items.length <= 3), true);
check("Nutrition = Summe der Items", rTri.every(r => approx(r.nutrition.kcal, Math.round(r.items.reduce((s, x) => s + x.kcal, 0) * 10) / 10)), true);
check("Ergebnisse nach Score sortiert", rTri.every((r, i) => i === 0 || rTri[i - 1].score <= r.score), true);
check("Top 20", rTri.length, 20);
const rInf = T.alaCarteCombos(tgt(200, 300, 60), "macros", {}, POOL, Infinity);
check("∞-Modus: Kombos mit 4+ Items", rInf.some(r => r.items.length >= 4), true);
check("∞-Modus: Sicherheitsdeckel 12 Items", rInf.every(r => r.items.length <= 12), true);
check("maxN=5 deckelt bei 5", T.alaCarteCombos(tgt(200, 300, 60), "macros", {}, POOL, 5).every(r => r.items.length <= 5), true);
const rReq = T.alaCarteCombos(tgt(40, 50, 10), "macros", {}, POOL, 3, { resultFilter: items => items.some(x => x.id === "e") });
check("resultFilter: jedes Ergebnis enthält e", rReq.length > 0 && rReq.every(r => r.items.some(x => x.id === "e")), true);
const rDist = T.alaCarteCombos(tgt(20, 80, 10), "macros", {}, POOL, 3, { distinctBy: x => x.id });
check("distinctBy: kein Item doppelt", rDist.length > 0 && rDist.every(r => new Set(r.items.map(x => x.id)).size === r.items.length), true);
const rDedup = T.alaCarteCombos(tgt(40, 50, 10), "macros", {}, POOL, 3, { dedupKey: items => String(items.length) });
check("dedupKey: je Key nur das beste Ergebnis", rDedup.length === 3 && new Set(rDedup.map(r => r.items.length)).size === 3, true);
const rBase = T.alaCarteCombos(tgt(40, 50, 10), "macros", {}, [Bq, C, Dd, E], 2, { baseItems: [A] });
check("baseItems: in jeder Kombo enthalten", rBase.every(r => r.items.some(x => x.id === "a")), true);
check("baseItems: 'nur Basis' möglich + Top-1 = a+b", rBase.some(r => r.items.length === 1) && ids(rBase[0]) === "a|b", true);
check("opts {} = identisch zu ohne opts", JSON.stringify(T.alaCarteCombos(tgt(45, 70, 20), "macros", {}, POOL, 3, {}).map(r => r.nutrition)) === JSON.stringify(rTri.map(r => r.nutrition)), true);
const SHRIMP = it("garnelen", "x", 40, 10, 5, { name: "Garnelen Bowl" });
check("Schalentier nie im Ergebnis (auch bei exaktem Treffer)", T.alaCarteCombos(tgt(10, 40, 5), "macros", {}, [SHRIMP, ...POOL], 3).every(r => r.items.every(x => x.id !== "garnelen")), true);

// ── isShellfish ──
sect("isShellfish");
const shellDE = ["Garnelen Bowl", "Riesengarnelen", "Scampi fritti", "Gambas al Ajillo", "Nordseekrabben", "Krabbencocktail", "Flusskrebse", "Hummer-Suppe", "Languste", "Miesmuscheln", "Jakobsmuscheln", "Austern", "Tintenfischringe", "Calamari fritti", "Calamares", "Sepia-Risotto", "Oktopus-Salat", "Pulpo a la Gallega", "Meeresfrüchte-Pizza", "Pizza Frutti di Mare", "Ebi Nigiri", "California Roll"];
const shellEN = ["Prawn crackers", "King Prawn Curry", "Shrimp Tempura", "Crab Cake", "Lobster Roll", "Langoustine", "Crayfish & Rocket", "Mussels", "Clam Chowder", "Oysters", "Scallops", "Squid", "Octopus", "Seafood Platter"];
check("isShellfish: deutsche Namen → true", shellDE.every(n => T.isShellfish({ name: n })), true);
check("isShellfish: englische Namen → true", shellEN.every(n => T.isShellfish({ name: n })), true);
check("isShellfish: 'Prawnless Crackers' → false", T.isShellfish({ name: "Prawnless Crackers" }), false);
check("isShellfish: Fisch/Fleisch/Veggie → false", ["Lachs Bowl", "Thunfisch Salat", "Salmon Nigiri", "Kabeljau", "Fish & Chips", "Hähnchen Bowl", "Falafel Wrap", "Döner Kebab", "Hummus Teller", "Pulled Salmon, 100 g"].every(n => !T.isShellfish({ name: n })), true);
check("SHELLFISH_SAFE: Austernpilze / Oyster mushrooms / Muschelnudeln → false", ["Austernpilze", "Ramen mit Austernpilzen", "Oyster mushrooms", "Crispy Oyster Mushroom Bao", "Muschelnudeln mit Tomatensauce"].every(n => !T.isShellfish({ name: n })), true);
check("SHELLFISH_SAFE greift nicht, wenn echtes Schalentier daneben steht", T.isShellfish({ name: "Muschelnudeln mit Garnelen" }), true);
check("Flag shellfish:true (Allergenliste „enthält“) → true", T.isShellfish({ name: "Rainbow Roll", shellfish: true }) && !T.isShellfish({ name: "Rainbow Roll" }), true);
T.SHELLFISH_NAMES.add("house special");
check("SHELLFISH_NAMES: exakter Name (+ Suffix in Klammern) → true", T.isShellfish({ name: "House Special" }) && T.isShellfish({ name: "House Special (groß)" }), true);
T.SHELLFISH_NAMES.delete("house special");
check("isShellfish: null / ohne Namen → false", T.isShellfish(null) === false && T.isShellfish({}) === false, true);

// ── Registry ──
sect("Registry");
const regProblems = T.validateRegistry(T.RESTAURANTS);
if (regProblems.length) console.log(regProblems.join("\n"));
check("validateRegistry(RESTAURANTS) ohne Probleme", regProblems.length, 0);
check("keys eindeutig", new Set(T.RESTAURANTS.map(r => r.key)).size === T.RESTAURANTS.length, true);
check("RESTO_BY_KEY deckt alle ab", T.RESTAURANTS.every(r => T.RESTO_BY_KEY[r.key] === r), true);
check("Plattform je Restaurant: Lieferando / Wolt / Uber Eats", T.RESTAURANTS.every(r => ["Lieferando", "Wolt", "Uber Eats"].includes(r.platform)), true);
const goodAC = () => ({ key: "testac", name: "Test AC", kind: "ac", gradient: ["#000", "#111"], label: "TEST", platform: "Wolt", accurate: true, maxN: 5,
  data: { cats: [{ id: "k1", name: "K1", on: true }], items: [it("i1", "k1", 10, 10, 1)] }, switches: [] });
check("validateRegistry: gültiger Test-Eintrag ok", T.validateRegistry([goodAC()]).length, 0);
check("validateRegistry: doppelter key erkannt", T.validateRegistry([goodAC(), goodAC()]).some(p => p.includes("key doppelt")), true);
check("validateRegistry: reservierter key erkannt", T.validateRegistry([{ ...goodAC(), key: "all" }]).some(p => p.includes("reserviert")), true);
const badItem = goodAC(); badItem.data.items.push({ ...it("i2", "k9", 1, 1, 1), protein: "12" });
const badP = T.validateRegistry([badItem]);
check("validateRegistry: unbekannte Kategorie erkannt", badP.some(p => p.includes("unbekannter Kategorie")), true);
check("validateRegistry: nicht-numerisches Makro erkannt", badP.some(p => p.includes("protein ist keine Zahl")), true);
const dupId = goodAC(); dupId.data.items.push(it("i1", "k1", 1, 1, 1));
check("validateRegistry: doppelte Item-id erkannt", T.validateRegistry([dupId]).some(p => p.includes("Item-id fehlt/doppelt")), true);
const grp = goodAC(); grp.switches = [{ id: "s1", label: "S1", def: true, filter: () => true, group: "g" }, { id: "s2", label: "S2", def: true, filter: () => true, group: "g" }];
check("validateRegistry: Gruppe mit 2× def:true erkannt", T.validateRegistry([grp]).some(p => p.includes("Gruppe g")), true);
const noEff = goodAC(); noEff.switches = [{ id: "s1", label: "S1", def: false }];
check("validateRegistry: Schalter ohne Wirkung erkannt", T.validateRegistry([noEff]).some(p => p.includes("ohne Wirkung")), true);
check("validateRegistry: BYO ohne Methoden erkannt", T.validateRegistry([{ ...goodAC(), key: "testbyo", kind: "byo", data: undefined }]).some(p => p.includes("BYO-Methode fehlt")), true);
check("validateRegistry: meldet Probleme aus r.validate()", T.validateRegistry([{ ...goodAC(), validate: () => ["Datenfehler X"] }]).some(p => p.includes("Datenfehler X")), true);

// ── optimizeAC (generisch, Test-Restaurant) ──
sect("optimizeAC (Test-Restaurant)");
const TR = {
  key: "testr", name: "Test R", kind: "ac", gradient: ["#000", "#111"], label: "TEST", platform: "Lieferando", accurate: true, maxN: 5,
  data: {
    cats: [{ id: "mains", name: "Mains", on: true }, { id: "sides", name: "Sides", on: true }, { id: "desserts", name: "Desserts", on: false }, { id: "drinks", name: "Drinks", on: true, drink: true }],
    items: [
      it("m1", "mains", 60, 40, 15), it("m2", "mains", 50, 30, 20), it("s1", "sides", 20, 5, 5), it("s2", "sides", 10, 20, 3, { sauce: true }),
      it("d1", "desserts", 40, 5, 10), it("dr1", "drinks", 60, 40, 15), it("fish1", "mains", 45, 35, 10, { fish: true }),
    ],
  },
  switches: [
    { id: "noSauce", label: "No sauce", def: true, filter: x => !x.sauce },
    { id: "noFish", label: "No fish", def: false, inAll: true, filter: x => !x.fish },
    { id: "onlySides", label: "Only sides", def: false, overridesCats: true, filter: x => x.cat === "sides", group: "mode" },
    { id: "mustSide", label: "Must include a side", def: false, require: items => items.some(x => x.cat === "sides"), group: "mode" },
  ],
};
check("Test-Restaurant ist gültig", T.validateRegistry([TR]).length, 0);
const stTR = T.defaultRestoState(TR);
check("defaultRestoState: Kategorien = on", stTR.cats.mains === true && stTR.cats.desserts === false, true);
check("defaultRestoState: Schalter = def, maxN 5, sel null", stTR.sw.noSauce === true && stTR.sw.noFish === false && stTR.maxN === 5 && stTR.sel === null, true);
check("initRestoStates: ein State je Restaurant", Object.keys(T.initRestoStates([TR, goodAC()])).join(",") === "testr,testac", true);
const tTR = tgt(40, 60, 15); // = m1 (und = Getränk dr1)
const rTR = T.optimizeAC(TR, tTR, "macros", {}, stTR);
const allItems = res => res.flatMap(r => r.items);
check("optimizeAC: liefert Ergebnisse", rTR.length > 0, true);
check("Kategorien: inaktive Kategorie (desserts) nie im Pool", allItems(rTR).every(x => x.cat !== "desserts"), true);
check("drink: Getränk nie im Pool — auch bei exaktem Treffer + aktivem Chip", allItems(rTR).every(x => x.cat !== "drinks"), true);
check("filter: No sauce AN → kein sauce-Item", allItems(rTR).every(x => !x.sauce), true);
check("filter: No sauce AUS → sauce-Item möglich (Top-1 = m1+s2)", ids(T.optimizeAC(TR, tgt(60, 70, 18), "macros", {}, { ...stTR, sw: { ...stTR.sw, noSauce: false } })[0]) === "m1|s2", true);
check("Chips: nur desserts an → nur desserts", allItems(T.optimizeAC(TR, tTR, "macros", {}, { ...stTR, cats: { mains: false, sides: false, desserts: true, drinks: true } })).every(x => x.cat === "desserts"), true);
const rOnly = T.optimizeAC(TR, tTR, "macros", {}, { ...stTR, cats: { mains: false, sides: false, desserts: false, drinks: false }, sw: { ...stTR.sw, onlySides: true } });
check("overridesCats: 'Only sides' ignoriert die (ausgeschalteten) Chips", rOnly.length > 0 && allItems(rOnly).every(x => x.cat === "sides"), true);
check("overridesCats: andere Filter wirken weiter (No sauce)", allItems(rOnly).every(x => !x.sauce), true);
const rMust = T.optimizeAC(TR, tTR, "macros", {}, { ...stTR, sw: { ...stTR.sw, mustSide: true } });
check("require: 'Must include a side' → jedes Ergebnis mit Side", rMust.length > 0 && rMust.every(r => r.items.some(x => x.cat === "sides")), true);
const swG = T.toggleSwitch(TR, { noSauce: true, noFish: false, onlySides: true, mustSide: false }, "mustSide", true);
check("group: einer an → andere derselben Gruppe aus", swG.mustSide === true && swG.onlySides === false, true);
check("group: Schalter anderer/ohne Gruppe unberührt", swG.noSauce === true && swG.noFish === false, true);
const swOff = T.toggleSwitch(TR, swG, "mustSide", false);
check("group: Ausschalten schaltet nichts anderes an", swOff.mustSide === false && swOff.onlySides === false, true);
check("maxN aus dem State (1 → nur Singles)", T.optimizeAC(TR, tTR, "macros", {}, { ...stTR, maxN: 1 }).every(r => r.items.length === 1), true);
const stAll = T.allState(TR, 2);
check("allState: inAll überschreibt def (noFish), sonst def", stAll.sw.noFish === true && stAll.sw.noSauce === true && stAll.sw.onlySides === false, true);
check("allState: maxN vom All-Chip", stAll.maxN, 2);
check("Ausschluss: exakter Treffer m1 ausgeschlossen → nie im Ergebnis", ids(T.optimizeAC(TR, tTR, "macros", {}, stTR)[0]) === "m1" && allItems(T.optimizeAC(TR, tTR, "macros", {}, stTR, new Set(["m1"]))).every(x => x.id !== "m1"), true);
check("Ausschluss über runOptimize durchgereicht", allItems(T.runOptimize(TR, tTR, "macros", {}, stTR, new Set(["m1", "m2"]))).every(x => x.id !== "m1" && x.id !== "m2"), true);
check("excludablesFor (à la carte): alle Items außer Getränken", T.excludablesFor(TR).map(x => x.id).join(",") === "m1,m2,s1,s2,d1,fish1" && T.excludablesFor(TR)[0].group === "Mains", true);
check("switchPass: nur aktive filter-Schalter", T.switchPass(TR, stTR)(it("x", "mains", 1, 1, 1, { sauce: true })) === false && T.switchPass(TR, { sw: {} })(it("x", "mains", 1, 1, 1, { sauce: true })) === true, true);

// ── Build-Your-Own-Schnittstelle (Stub) ──
sect("Build-Your-Own-Schnittstelle (Stub)");
let seenArgs = null;
const BYO = {
  key: "testbyo", name: "Test BYO", kind: "byo", gradient: ["#000", "#111"], label: "TEST BYO", platform: "Uber Eats", accurate: false, maxN: 5, switches: [],
  optimize: (t, mode, p, st, ex, r) => { seenArgs = { ex, r }; const parts = [it("base", "b", 50, 10, 5), it("prot", "p", 0, 30, 5)]; const n = T.sumN(parts, 1); return [{ key: "base+prot", items: parts, nutrition: n, score: T.score(n, t, mode, p) }]; },
  renderConfig: () => null, renderCard: () => null, renderPanel: () => null,
  orderSteps: () => [{ l: "Base", v: "base" }, { l: "Protein", v: "prot" }],
  searchEntries: () => [it("base", "b", 50, 10, 5, { name: "BYO Base" }), it("gar", "p", 0, 20, 2, { name: "Extra Garnelen" })],
  excludables: () => [{ id: "base", name: "BYO Base", group: "Base" }],
  summary: () => "Base + Protein",
};
check("BYO-Stub ist gültig", T.validateRegistry([BYO]).length, 0);
const exStub = new Set(["base"]);
const rB = T.runOptimize(BYO, tTR, "macros", {}, T.defaultRestoState(BYO), exStub);
check("runOptimize → BYO.optimize (mit Ausschluss-Set + Eintrag)", rB.length === 1 && rB[0].key === "base+prot" && seenArgs.ex === exStub && seenArgs.r === BYO, true);
check("resultKey: BYO-eigener key", T.resultKey(rB[0]) === "base+prot", true);
check("orderStepsFor → BYO.orderSteps", T.orderStepsFor(BYO, rB[0]).length, 2);
check("summarizeResult → BYO.summary", T.summarizeResult(BYO, rB[0]) === "Base + Protein", true);
check("excludablesFor → BYO.excludables", T.excludablesFor(BYO).length === 1 && T.excludablesFor(BYO)[0].id === "base", true);
const idxB = T.buildSearchIndex([BYO]);
check("Such-Index nutzt BYO.searchEntries (Schalentier gefiltert)", idxB.length === 1 && idxB[0].name === "BYO Base" && idxB[0].resto === "Test BYO", true);

// ── optimizeAll (All / Accurate) ──
sect("optimizeAll (All / Accurate)");
const TR2 = { ...TR, key: "testr2", name: "Test R2", accurate: false };
const cross = [TR, TR2, BYO];
const rAllT = T.optimizeAll(tTR, "macros", {}, 5, false, cross);
check("All: 1..20 Ergebnisse", rAllT.length > 0 && rAllT.length <= 20, true);
check("All: max. 1 Treffer pro Restaurant", new Set(rAllT.map(r => r._resto)).size === rAllT.length, true);
check("All: alle 3 Test-Restaurants vertreten", rAllT.length, 3);
check("All: nach Score sortiert", rAllT.every((r, i) => i === 0 || rAllT[i - 1].score <= r.score), true);
check("All: Treffer = bestes Ergebnis des Restaurants (Default-Kategorien + inAll)", ids(rAllT.find(r => r._resto === "testr")) === ids(T.optimizeAC(TR, tTR, "macros", {}, T.allState(TR, 5))[0]), true);
const tFish = tgt(35, 45, 10); // = fish1
check("Restaurant-Tab (def): Fisch-Item ist Top-1", ids(T.optimizeAC(TR, tFish, "macros", {}, stTR)[0]) === "fish1", true);
check("All: inAll (No fish an) filtert das Fisch-Item", T.optimizeAll(tFish, "macros", {}, 5, false, [TR]).every(r => r.items.every(x => !x.fish)), true);
check("All: Max-Items-Chip wird durchgereicht (1 → Singles)", T.optimizeAll(tTR, "macros", {}, 1, false, [TR, TR2]).every(r => r.items.length === 1), true);
check("All: Ausschluss-Listen je Restaurant gelten auch hier", T.optimizeAll(tTR, "macros", {}, 5, false, [TR, TR2], { testr: ["m1"] }).find(r => r._resto === "testr").items.every(x => x.id !== "m1") && ids(T.optimizeAll(tTR, "macros", {}, 5, false, [TR, TR2], { testr: ["m1"] }).find(r => r._resto === "testr2")) === "m1", true);
const rAccT = T.optimizeAll(tTR, "macros", {}, 5, true, cross);
check("Accurate: nur accurate:true", rAccT.length === 1 && rAccT[0]._resto === "testr", true);
const accReal = T.RESTAURANTS.filter(r => r.accurate).map(r => r.key).sort().join(",");
check("Accurate (echte Registry): genau die accurate-Restaurants", T.optimizeAll(tgt(65, 85, 20), "macros", {}, 5, true).map(r => r._resto).sort().join(",") === accReal, true);
check("All (echte Registry): 1 Treffer je Restaurant", T.optimizeAll(tgt(65, 85, 20), "macros", {}, 5, false).length === T.RESTAURANTS.length, true);

// ── SEARCH_INDEX / searchItems / matchesQuery ──
sect("SEARCH_INDEX / searchItems / matchesQuery");
check("SEARCH_INDEX automatisch aus der Registry", T.SEARCH_INDEX.length > 0 && T.SEARCH_INDEX.length === T.buildSearchIndex(T.RESTAURANTS).length, true);
check("SEARCH_INDEX: jeder Eintrag mit resto + name + 8 Makros", T.SEARCH_INDEX.every(x => x.resto && x.name && T.KEYS.every(k => typeof x[k] === "number")), true);
check("SEARCH_INDEX: kein Schalentier", T.SEARCH_INDEX.every(x => !T.isShellfish(x)), true);
check("SEARCH_INDEX: keine Duplikate (resto|name|kcal)", new Set(T.SEARCH_INDEX.map(x => x.resto + "|" + x.name + "|" + x.kcal)).size === T.SEARCH_INDEX.length, true);
const dupR = { ...TR, data: { cats: TR.data.cats, items: [...TR.data.items, { ...TR.data.items[0], id: "m1b" }] } };
check("buildSearchIndex: exakte Duplikate entfernt", T.buildSearchIndex([dupR]).length === T.buildSearchIndex([TR]).length, true);
const IDX = T.buildSearchIndex([{ ...TR, key: "u1", name: "Café Müller", data: { cats: [{ id: "k", name: "K", on: true }], items: [
  it("x1", "k", 50, 10, 10, { name: "Hähnchen Bowl" }), it("x2", "k", 30, 5, 5, { name: "Süßkartoffel-Pommes" }),
  it("x3", "k", 40, 8, 12, { name: "Kaesespaetzle" }), it("x4", "k", 20, 2, 1, { name: "Weißwurst Brezel Menü" }),
  it("x5", "k", 45, 10, 5, { name: "Muesli" }), it("x6", "k", 10, 1, 1, { name: "Bowl" }), it("x7", "k", 30, 20, 5, { name: "Garnelen Bowl" }) ] } }]);
const names = (q, lim) => T.searchItems(q, lim, IDX).map(x => x.name);
check("searchItems: leere Query → []", T.searchItems("", 60, IDX).length, 0);
check("searchItems: Umlaut-Query ('hähnchen')", names("hähnchen").includes("Hähnchen Bowl"), true);
check("searchItems: ae findet ä ('haehnchen')", names("haehnchen").includes("Hähnchen Bowl"), true);
check("searchItems: ohne Umlaut findet ä ('hahnchen')", names("hahnchen").includes("Hähnchen Bowl"), true);
check("searchItems: ue + ss finden ü + ß ('suesskartoffel')", names("suesskartoffel").includes("Süßkartoffel-Pommes"), true);
check("searchItems: ä-Query findet ae-Schreibweise ('käsespätzle')", names("käsespätzle").includes("Kaesespaetzle"), true);
check("searchItems: 'weißwurst' und 'weisswurst'", names("weißwurst").includes("Weißwurst Brezel Menü") && names("weisswurst").includes("Weißwurst Brezel Menü"), true);
check("searchItems: ü-Query findet ue ('müsli' → Muesli)", names("müsli").includes("Muesli"), true);
check("searchItems: Mehrwort-AND ('bowl hähnchen')", names("bowl hähnchen").join("|") === "Hähnchen Bowl", true);
check("searchItems: Restaurantname matcht ('mueller' → alle)", names("mueller").length === IDX.length, true);
check("searchItems: kürzester Name zuerst ('bowl')", names("bowl")[0] === "Bowl", true);
check("searchItems: respektiert limit", names("k", 2).length <= 2, true);
check("searchItems: Schalentier nicht im Index ('garnelen')", names("garnelen").length, 0);
check("matchesQuery: leer = Treffer, Umlaute, alle Begriffe", T.matchesQuery("Röstzwiebeln, 20 g", "") && T.matchesQuery("Röstzwiebeln, 20 g", "roestzw") && T.matchesQuery("Röstzwiebeln, 20 g", "rost 20") && !T.matchesQuery("Röstzwiebeln, 20 g", "rost 50"), true);

// ── orderTotal ──
sect("orderTotal");
const oi1 = { kcal: 100, fat: 5, sat: 1, carbs: 10, sugars: 2, fibre: 1, protein: 8, salt: 0.5 };
const oi2 = { kcal: 200, fat: 10, sat: 2, carbs: 20, sugars: 4, fibre: 2, protein: 16, salt: 1 };
const ot = T.orderTotal([{ item: oi1, qty: 2 }, { item: oi2, qty: 1 }]);
check("orderTotal kcal (2×100 + 1×200 = 400)", ot.kcal, 400);
check("orderTotal protein (2×8 + 1×16 = 32)", ot.protein, 32);
check("orderTotal salt (2×0.5 + 1×1 = 2)", ot.salt, 2);
check("orderTotal Rundung 1 Dezimale (3×0.33 → 1)", T.orderTotal([{ item: { salt: 0.33 }, qty: 3 }]).salt, 1);
check("orderTotal leere Bestellung → alles 0", T.orderTotal([]).kcal === 0 && T.orderTotal([]).protein === 0, true);

// ── comboLabel / acOrderSteps / resultKey ──
sect("comboLabel / acOrderSteps / resultKey");
check("comboLabel: '2× a + b'", T.comboLabel([A, A, Bq]) === "2× a + b", true);
const steps = T.acOrderSteps([A, Bq, A]);
check("acOrderSteps: Mengen + Reihenfolge des ersten Auftretens", steps.length === 2 && steps[0].l === "2×" && steps[0].v === "a" && steps[1].l === "1×" && steps[1].v === "b", true);
check("resultKey: sortierte ids, reihenfolgeunabhängig", T.resultKey({ items: [Bq, A] }) === "a|b" && T.resultKey({ items: [A, Bq] }) === "a|b", true);
check("resultKey: null → null", T.resultKey(null) === null, true);

// ── Bowl-Engine (generisch, Test-Menü) ──
sect("Bowl-Engine (bowlCombos, Test-Menü)");
const opt = (id, group, carbs, protein, fat, more) => Object.assign({ id, name: id, short: id, group, ing: (more && more.ing) || id, maxQty: 1, kcal: 4 * carbs + 4 * protein + 9 * fat, fat, sat: 0, carbs, sugars: 0, fibre: 0, protein, salt: 0 }, more || {});
const TMENU = { item: "Test Bowl", groups: [
  { id: "base", name: "Basis", min: 0, max: 3, none: null, options: [opt("reis", "base", 60, 6, 1, { maxQty: 4 }), opt("salat", "base", 3, 1, 0, { maxQty: 4 }), opt("nudeln", "base", 45, 20, 4)] },
  { id: "protein", name: "Proteine", min: 0, max: 10, none: null, options: [opt("huhn", "protein", 1, 23, 3, { maxQty: 10 }), opt("tofu", "protein", 3, 12, 7, { maxQty: 10 }), opt("lachs", "protein", 0, 20, 14)] },
  { id: "extra", name: "Extras", min: 0, max: 30, none: null, options: [opt("huhn_x", "extra", 1, 23, 3, { ing: "huhn" }), opt("ei", "extra", 0, 7, 5), opt("mais", "extra", 6, 1, 1), opt("nuss", "extra", 1, 3, 13, { crunch: true }), opt("avo", "extra", 1, 1, 4), opt("garnele", "extra", 0, 18, 1, { name: "Garnelen, 50 g" }), opt("pfeffer", "extra", 0, 0, 0)] },
  { id: "dip", name: "Dip", min: 1, max: 1, none: "Ohne Dip", options: [opt("curry", "dip", 8, 0, 30), opt("tzatziki", "dip", 5, 11, 0)] },
] };
const tB = tgt(60, 70, 18);
const rTB = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3 });
const cnt = (r, gid) => r.parts.filter(pt => pt.opt.group === gid).reduce((s, pt) => s + pt.qty, 0);
check("bowlCombos: liefert Ergebnisse (≤ 20)", rTB.length > 0 && rTB.length <= 20, true);
check("jede Bowl: ≥1 Base und ≥1 Protein", rTB.every(r => cnt(r, "base") >= 1 && cnt(r, "protein") >= 1), true);
check("Deckel je Base/Protein-Option (cap 2)", rTB.every(r => r.parts.every(pt => pt.qty <= (pt.opt.group === "extra" ? 1 : 2))), true);
check("Gruppen-Maximum Basis (max 3)", T.bowlCombos(TMENU, tgt(30, 400, 5), "macros", {}, { cap: 4, maxExtras: 0 }).every(r => cnt(r, "base") <= 3), true);
check("maxQty der Option (nudeln 1×)", T.bowlCombos(TMENU, tgt(200, 200, 30), "macros", {}, { cap: 4, maxExtras: 5 }).every(r => r.parts.every(pt => pt.opt.id !== "nudeln" || pt.qty <= 1)), true);
check("maxExtras 3 / 0", rTB.every(r => cnt(r, "extra") <= 3) && T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 0 }).every(r => cnt(r, "extra") === 0), true);
check("Protein-Duplikat unter Extras wird nie genutzt (läuft über die Protein-Gruppe)", T.bowlCombos(TMENU, tgt(150, 60, 10), "macros", {}, { cap: 4, maxExtras: 5 }).every(r => r.parts.every(pt => pt.opt.id !== "huhn_x")), true);
check("höchstens ein Dip", rTB.every(r => r.items.filter(x => x.group === "dip").length <= 1), true);
check("Schalentier-Option nie im Ergebnis", T.bowlCombos(TMENU, tgt(80, 60, 5), "macros", {}, { cap: 2, maxExtras: 5 }).every(r => r.items.every(x => x.id !== "garnele")), true);
check("Option ohne Nährwerte (alles 0) wird nie vorgeschlagen (keine Doppel-Ergebnisse)", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 5 }).every(r => r.items.every(x => x.id !== "pfeffer")), true);
check("keep-Filter wirkt (keine Dips / kein Crunch)", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, keep: x => x.group !== "dip" && !x.crunch }).every(r => !r.dip && r.items.every(x => !x.crunch)), true);
check("Pflicht nicht erfüllbar (keine Base erlaubt) → keine Ergebnisse", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, keep: x => x.group !== "base" }).length, 0);
check("nutrition = sumN der Items, Score darauf, sortiert", rTB.every(r => JSON.stringify(r.nutrition) === JSON.stringify(T.sumN(r.items, 1)) && Math.abs(r.score - T.score(r.nutrition, tB, "macros", {})) < 1e-12) && rTB.every((r, i) => i === 0 || rTB[i - 1].score <= r.score), true);
check("Keys eindeutig und stabil", new Set(rTB.map(r => r.key)).size === rTB.length && JSON.stringify(rTB.map(r => r.key)) === JSON.stringify(T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3 }).map(r => r.key)), true);
check("exakter Treffer wird gefunden (reis + huhn + ei + tzatziki)", (() => { const tt = tgt(6 + 23 + 7 + 11, 60 + 1 + 0 + 5, 1 + 3 + 5 + 0); const r0 = T.bowlCombos(TMENU, tt, "macros", {}, { cap: 2, maxExtras: 3 })[0]; return r0.score < 1e-9 && r0.key === "reis x1+huhnx1+eix1|tzatziki".replace(" ", ""); })(), true);

// Vollständige Durchrechnung mit identischen Regeln (Referenz für die Exaktheit der Suche): die 30 besten Roh-Scores, aufsteigend
function exhaustiveBowl(menu, t, mode, p, o) {
  const G = Object.fromEntries(menu.groups.map(g => [g.id, g]));
  const keep = x => !T.isShellfish(x) && (!o.keep || o.keep(x));
  const protIngs = new Set(G.protein.options.map(x => x.ing));
  const vec = x => T.KEYS.map(k => x[k] || 0);
  const B = G.base.options.filter(keep), P = G.protein.options.filter(keep), D = [null, ...G.dip.options.filter(keep)];
  const E = G.extra.options.filter(x => keep(x) && !protIngs.has(x.ing) && vec(x).some(v => v > 0)); // wie bowlCombos: Extras ohne Nährwerte zählen nicht
  const combos = (arr, maxTotal) => { let out = [[[0, 0, 0, 0, 0, 0, 0, 0], 0]]; for (const u of arr) { const qmax = Math.min(u.maxQty || 1, o.cap), v = vec(u), nx = []; for (const [n, c] of out) for (let q = 0; q <= qmax && c + q <= maxTotal; q++) nx.push([n.map((x, k) => x + v[k] * q), c + q]); out = nx; } return out.filter(x => x[1] >= 1).map(x => x[0]); };
  const bc = combos(B, G.base.max), pc = combos(P, G.protein.max), es = [];
  const maxE = Math.min(G.extra.max, o.maxExtras == null ? Infinity : o.maxExtras);
  const rec = (i, n, c) => { es.push(n); if (c >= maxE) return; for (let j = i; j < E.length; j++) { const v = vec(E[j]); rec(j + 1, n.map((x, k) => x + v[k]), c + 1); } };
  rec(0, [0, 0, 0, 0, 0, 0, 0, 0], 0);
  const top = [], n = [0, 0, 0, 0, 0, 0, 0, 0];
  let thr = Infinity;
  for (const d of D) {
    const dv = d ? vec(d) : [0, 0, 0, 0, 0, 0, 0, 0];
    for (const bn of bc) for (const pn of pc) {
      const cn = bn.map((x, k) => x + pn[k] + dv[k]);
      for (const en of es) {
        for (let k = 0; k < 8; k++) n[k] = cn[k] + en[k];
        const s = T.scoreVec(n, t, mode, p);
        if (s >= thr) continue;
        let i = top.length;
        top.push(s);
        while (i > 0 && top[i - 1] > s) { top[i] = top[i - 1]; i--; }
        top[i] = s;
        if (top.length > 30) top.pop();
        if (top.length === 30) thr = top[29];
      }
    }
  }
  return top;
}
const rawTop = (menu, t, mode, p, o) => T.bowlCombos(menu, t, mode, p, Object.assign({}, o, { raw: true })).map(r => r.rawScore);
const sameTop = (a, b) => a.length === b.length && a.every((s, i) => Math.abs(s - b[i]) < 1e-9);
const rawT = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, raw: true });
check("opts.raw: Rangliste { key, rawScore } mit 30 Einträgen, aufsteigend, Keys eindeutig", rawT.length === 30 && rawT.every((x, i) => typeof x.key === "string" && (i === 0 || rawT[i - 1].rawScore <= x.rawScore)) && new Set(rawT.map(x => x.key)).size === 30, true);
const oT = { cap: 3, maxExtras: 4 };
let exOkT = 0; const exTargets = [tgt(60, 70, 18), tgt(35, 130, 8), tgt(110, 40, 30), tgt(45, 90, 45), tgt(70, 20, 12, { fibMin: 5, sMax: 1 })];
for (const tt of exTargets) if (sameTop(rawTop(TMENU, tt, "macros", {}, oT), exhaustiveBowl(TMENU, tt, "macros", {}, oT))) exOkT++;
check("Makro-Modus: Top 30 = vollständige Durchrechnung (Test-Menü, 5 Ziele)", exOkT, exTargets.length);
let exKT = 0; const exKTargets = [[kcalT(450), { hp: true, lf: true }], [kcalT(700), { hc: true, lf: true }], [kcalT(900), { lc: true, hp: true }], [kcalT(350), { lp: true, hf: true }], [kcalT(520, { fibMin: 3, sMax: 1 }), { hp: true }], [kcalT(600), {}]];
for (const [tt, pp] of exKTargets) if (sameTop(rawTop(TMENU, tt, "calories", pp, oT), exhaustiveBowl(TMENU, tt, "calories", pp, oT))) exKT++;
check("Kalorien-Modus mit/ohne Präferenzen: Top 30 = vollständige Durchrechnung (Test-Menü, 6 Ziele)", exKT, exKTargets.length);

// ── Compleat: Daten ──
sect("Compleat: Daten (Shop + Wolt)");
const CR = T.RESTO_BY_KEY.compleat;
const rawC = U.readJSON(__dirname + "/data/compleat-raw.json");
const updC = require("./compleat-update.js");
const W = T.COMPLEAT.wolt, WG = Object.fromEntries(W.groups.map(g => [g.id, g]));
const wopt = id => W.groups.flatMap(g => g.options).find(o => o.id === id);
check("Compleat in der Registry: BYO, Wolt, accurate", !!CR && CR.kind === "byo" && CR.platform === "Wolt" && CR.accurate === true, true);
check("COMPLEAT-Block = compleat-update.js(data/compleat-raw.json) (Block aktuell)", JSON.stringify(W.groups) === JSON.stringify(updC.buildMenu(rawC, "wolt").groups), true);
check("Datensatz vollständig: alle Shop-Zutaten im Block (auch nicht bei Wolt)", T.COMPLEAT.ingredients.length === rawC.ingredients.length && T.COMPLEAT.ingredients.some(x => x.id === "suesskartoffel") && T.COMPLEAT.ingredients.some(x => x.id === "gemuesemix"), true);
check("bowlValidate(COMPLEAT) ohne Probleme", T.bowlValidate(T.COMPLEAT).length, 0);
check("Wolt-Gruppen: Basis 3 (ohne Quinoa) · Proteine 5 · Extras 25 · Dips 13 + „Ohne Dip“", WG.base.options.length === 3 && WG.protein.options.length === 5 && WG.extra.options.length === 25 && WG.dip.options.length === 13 && WG.dip.none === "Ohne Dip", true);
check("Wolt-Grenzen: Basis 0–5 · Proteine 0–10 · Extras 0–30 · Dip genau 1", WG.base.max === 5 && WG.protein.max === 10 && WG.extra.max === 30 && WG.dip.min === 1 && WG.dip.max === 1, true);
check("Wolt-Mengen: Basmatireis/Salat-Mix bis 4×, Protein Nudeln 1×, Hähnchen bis 10×, Pulled Salmon 1×, Extras 1×", wopt("base_basmatireis_250_g").maxQty === 4 && wopt("base_salat_mix_100_g").maxQty === 4 && wopt("base_protein_nudeln_200_g").maxQty === 1 && wopt("protein_haehnchen_100_g").maxQty === 10 && wopt("protein_pulled_salmon_100_g").maxQty === 1 && WG.extra.options.every(o => o.maxQty === 1), true);
check("Salat-Mix: Wolt 100 g statt Shop 80 g → pro-100-g-Werte (17 kcal)", wopt("base_salat_mix_100_g").amount === 100 && wopt("base_salat_mix_100_g").kcal === 17 && T.COMPLEAT.ingredients.find(x => x.id === "salatmix").portion === 80, true);
check("Basmatireis 250 g: 330 kcal · 70 g KH · 7,5 g P", wopt("base_basmatireis_250_g").kcal === 330 && wopt("base_basmatireis_250_g").carbs === 70 && wopt("base_basmatireis_250_g").protein === 7.5, true);
check("Walnusskerne 20 g: 140,8 kcal (Shop zeigt fälschlich 7 kcal)", wopt("extra_walnusskerne_20_g").kcal, 140.8);
check("Röstzwiebeln 20 g: 118 kcal (Shop rechnet mit 18 g)", wopt("extra_roestzwiebeln_20_g").kcal, 118);
check("Granatapfelkerne 15 g: 11,1 kcal (Shop rechnet mit 20 g)", wopt("extra_granatapfelkerne_15_g").kcal, 11.1);
check("Sojasoße 20 ml: Salz 2,87 g (Shop rechnet mit 40 ml)", wopt("dip_sojasosse_20ml").salt, 2.87);
check("Hart gekochtes Ei 50 g (neu bei Wolt): offizielle Shop-Werte 77,5 kcal / 6,55 g P", wopt("extra_hart_gekochtes_ei_50_g").kcal === 77.5 && wopt("extra_hart_gekochtes_ei_50_g").protein === 6.55, true);
check("Portionswerte = pro 100 g × Menge / 100 (alle Optionen)", W.groups.flatMap(g => g.options).every(o => { const ing = T.COMPLEAT.ingredients.find(x => x.id === o.ing); return T.KEYS.every(k => Math.abs(o[k] - Math.round(ing.per100[k] * o.amount / 100 * 100) / 100) < 1e-9); }), true);
check("Crunch = Erdnüsse, Walnusskerne, Röstzwiebeln, Schwarzer Sesam", W.groups.flatMap(g => g.options).filter(o => o.crunch).map(o => o.ing).sort().join(",") === "erdnuesse,roestzwiebeln,schwarzer_sesam,walnusskerne", true);
const quinoa = T.COMPLEAT.ingredients.find(x => x.id === "bunter_bio_quinoa");
check("Quinoa: im Datensatz, gesperrt mit Begründung (User 15.09.2026)", !!quinoa && /User 15\.09\.2026/.test(quinoa.blocked || "") && T.COMPLEAT_BLOCKED.has("bunter_bio_quinoa"), true);
check("Quinoa: in keiner Wolt-Option des Rechners", W.groups.every(g => g.options.every(o => o.ing !== "bunter_bio_quinoa")), true);
check("Quinoa: auch in raw.json-Wolt-Menü markiert (wird vom Update-Skript weggelassen)", rawC.wolt.groups.some(g => g.options.some(o => o.ingredient === "bunter_bio_quinoa")) && updC.buildMenu(rawC, "wolt").skipped.some(s => /Quinoa/.test(s)), true);
check("Kein Schalentier bei Compleat (Allergene + Namen)", T.COMPLEAT.ingredients.every(x => !x.shellfish && !T.isShellfish(x)) && W.groups.every(g => g.options.every(o => !T.isShellfish(o))), true);
const metaC = rawC._meta;
check("_meta: 7 dokumentierte Auffälligkeiten", metaC.anomalies.map(a => a.id).sort().join(",") === "avocado,bunter_bio_quinoa,chili_gewuerz,edamame,honey_muscle_mustard,olivenoel_salz_halbe_zitrone,pulled_salmon", true);
check("_meta: 4 Anzeige-Bugs im Shop dokumentiert", metaC.displayBugs.map(b => b.id).sort().join(",") === "granatapfelkerne,roestzwiebeln,sojasauce,walnusskerne", true);
check("_meta: Mengenabweichung Wolt ↔ Shop nur Salat-Mix", metaC.portionDiffs.length === 1 && metaC.portionDiffs[0].wolt === "Salat-Mix, 100 g", true);
check("_meta: Koriander in der Guacamole vermerkt", metaC.dislikes.some(d => /Guacamole/.test(d) && /Koriander/i.test(d)), true);
check("_meta: Entscheidungen des Users mit Datum", metaC.decisions.length >= 4 && metaC.decisions.every(d => /User 15\.09\.2026/.test(d)), true);
check("verify-compleat.js: Word-Export = nachgerechnete Shop-Anzeige", (() => { try { require("child_process").execFileSync(process.execPath, [__dirname + "/verify-compleat.js"], { stdio: "pipe" }); return true; } catch (e) { return false; } })(), true);

// ── Compleat: Optimizer ──
sect("Compleat: Optimizer");
const stC = T.defaultRestoState(CR);
check("Default: No dip AN, No crunch AUS, max. 5 Extras, max. 2 Portionen", stC.sw.noDip === true && stC.sw.noCrunch === false && stC.extra.maxExtras === 5 && stC.extra.cap === 2, true);
const run = (t, st, ex, mode, p) => T.runOptimize(CR, t, mode || "macros", p || {}, st, ex || new Set());
const cntC = (r, gid) => r.parts.filter(pt => pt.opt.group === gid).reduce((s, pt) => s + pt.qty, 0);
const tDef = tgt(65, 85, 20);
const rDef = run(tDef, stC);
check("Standardziele: Ergebnisse vorhanden", rDef.length > 0, true);
check("jede Bowl ≥1 Base + ≥1 Protein", rDef.every(r => cntC(r, "base") >= 1 && cntC(r, "protein") >= 1), true);
check("No dip AN → nie ein Dip", rDef.every(r => !r.dip), true);
check("Deckel: je Base/Protein ≤ 2, Extras ≤ 5 und je 1×", rDef.every(r => r.parts.every(pt => pt.qty <= (pt.opt.group === "extra" ? 1 : 2)) && cntC(r, "extra") <= 5), true);
check("nie Quinoa, nie Schalentier", rDef.every(r => r.items.every(x => x.ing !== "bunter_bio_quinoa" && !T.isShellfish(x))), true);
check("Chili Gewürz (alle Werte 0) nie vorgeschlagen → keine Doppel-Ergebnisse", rDef.every(r => r.items.every(x => x.ing !== "chili_gewuerz")) && new Set(rDef.map(r => r.key.replace(/\+?extra_chili[^+|]*/g, ""))).size === rDef.length, true);
const b1 = wopt("base_basmatireis_250_g"), p1 = wopt("protein_haehnchen_100_g"), d1 = wopt("dip_curvy_curry_dip");
const tDip = tgt(b1.protein + p1.protein + d1.protein, b1.carbs + p1.carbs + d1.carbs, b1.fat + p1.fat + d1.fat);
const stDipOn = { ...stC, sw: { ...stC.sw, noDip: false } };
check("No dip AUS → passender Dip wird genommen (Basmatireis + Hähnchen + Curvy Curry)", (() => { const r0 = run(tDip, stDipOn)[0]; return !!r0.dip && r0.dip.id === "dip_curvy_curry_dip"; })(), true);
check("No dip AN → derselbe Zielwert ohne Dip", run(tDip, stC).every(r => !r.dip), true);
const s1 = wopt("base_salat_mix_100_g"), wn = wopt("extra_walnusskerne_20_g");
const tCrunch = tgt(s1.protein + p1.protein + wn.protein, s1.carbs + p1.carbs + wn.carbs, s1.fat + p1.fat + wn.fat);
check("No crunch AUS → Walnusskerne möglich", run(tCrunch, stC).some(r => r.parts.some(pt => pt.opt.crunch)), true);
check("No crunch AN → nie Erdnüsse/Walnusskerne/Röstzwiebeln/Sesam", run(tCrunch, { ...stC, sw: { ...stC.sw, noCrunch: true } }).every(r => r.items.every(x => !x.crunch)), true);
check("Ausschluss 'huehnchen' → nie Hähnchen (Proteine + Extras)", run(tDef, stC, new Set(["huehnchen"])).every(r => r.items.every(x => x.ing !== "huehnchen")), true);
check("alle Basen ausgeschlossen → keine Bowl", run(tDef, stC, new Set(["basmati_reis", "salatmix", "protein_pasta"])).length, 0);
check("Portionen-Chip 1 → keine Doppelportion", run(tgt(120, 150, 25), { ...stC, extra: { ...stC.extra, cap: 1 } }).every(r => r.parts.every(pt => pt.qty === 1)), true);
check("Portionen-Chip 4 → Basis ≤ 5, Protein-Gruppe ≤ 10, Nudeln/Lachs ≤ 1", run(tgt(200, 350, 40), { ...stC, extra: { ...stC.extra, cap: 4 } }).every(r => cntC(r, "base") <= 5 && cntC(r, "protein") <= 10 && r.parts.every(pt => !["base_protein_nudeln_200_g", "protein_pulled_salmon_100_g"].includes(pt.opt.id) || pt.qty === 1)), true);
check("Extras-Chip 0 → keine Extras", run(tDef, { ...stC, extra: { ...stC.extra, maxExtras: 0 } }).every(r => cntC(r, "extra") === 0), true);
check("Kalorien-Modus (450 kcal, HP + LF) liefert gültige Bowls", (() => { const r = run(kcalT(450), stC, null, "calories", { hp: true, lf: true }); return r.length > 0 && r.every(x => cntC(x, "base") >= 1 && cntC(x, "protein") >= 1 && !x.dip); })(), true);
const oC = { cap: 2, maxExtras: 2, keep: x => !T.COMPLEAT_BLOCKED.has(x.ing) };
let exOkC = 0; const exC = [tgt(65, 85, 20), tgt(40, 60, 25), tgt(90, 50, 15), tgt(31, 80, 33)];
for (const tt of exC) if (sameTop(rawTop(W, tt, "macros", {}, oC), exhaustiveBowl(W, tt, "macros", {}, oC))) exOkC++;
check("Makro-Modus: Top 30 = vollständige Durchrechnung (Compleat inkl. Dips, 4 Ziele)", exOkC, exC.length);
let exKC = 0; const exKCTargets = [[kcalT(450), { hp: true, lf: true }], [kcalT(800), { hc: true }], [kcalT(650, { fibMin: 10, sMax: 3 }), { lc: true, lf: true }], [kcalT(1000), { hp: true, hf: true }]];
for (const [tt, pp] of exKCTargets) if (sameTop(rawTop(W, tt, "calories", pp, oC), exhaustiveBowl(W, tt, "calories", pp, oC))) exKC++;
check("Kalorien-Modus mit Präferenzen: Top 30 = vollständige Durchrechnung (Compleat inkl. Dips, 4 Ziele)", exKC, exKCTargets.length);
// Untergrenzen der Kern-Suche: LB(Kern) ≤ Score JEDER Erweiterung (Zufallsfälle aus Compleat-Optionen)
let sdLB = 20260915; const rndLB = () => (sdLB = (sdLB * 1103515245 + 12345) % 2147483648) / 2147483648;
const vecsLB = W.groups.flatMap(g => g.options).filter(x => !T.COMPLEAT_BLOCKED.has(x.ing)).map(x => T.KEYS.map(k => x[k] || 0));
const addRnd = (v, cnt) => { const out = v.slice(); for (let j = 0; j < cnt; j++) { const u = vecsLB[Math.floor(rndLB() * vecsLB.length)]; for (let k = 0; k < 8; k++) out[k] += u[k]; } return out; };
const PREFS_LB = [{ hp: true, lf: true }, { hc: true }, { lc: true, hp: true }, { lp: true, hf: true }, { hf: true, lc: true }, { lf: true }, { lp: true }];
const LBN = 700; let lbShareOk = 0, lbOverOk = 0;
for (let i = 0; i < LBN; i++) {
  const pp = PREFS_LB[i % PREFS_LB.length];
  const more = i % 3 === 0 ? { fibMax: 4 + rndLB() * 10, sMax: 1 + rndLB() * 4 } : i % 3 === 1 ? { fibMin: 5, sMin: 1 } : {};
  const tk = kcalT(Math.round(150 + rndLB() * 1100), more);
  const rho = Math.min(...vecsLB.filter(v => v[0] > 0).map(v => T.bowlShareL(v, pp) / v[0]));
  const c = addRnd([0, 0, 0, 0, 0, 0, 0, 0], 1 + Math.floor(rndLB() * 4)), e = addRnd(c, Math.floor(rndLB() * 10));
  if (T.bowlShareLB(c, tk, pp, rho, 1e9) <= T.scoreVec(e, tk, "calories", pp) + 1e-9) lbShareOk++;
  const tm = tgt(Math.round(20 + rndLB() * 140), Math.round(10 + rndLB() * 160), Math.round(3 + rndLB() * 50), more);
  if (T.bowlOverLB(c, tm, "macros", {}, 1) <= T.scoreVec(e, tm, "macros", {}) + 1e-9) lbOverOk++;
}
check("bowlShareLB ≤ Score jeder Erweiterung (700 Zufallsfälle, Kalorien-Modus mit Präferenzen)", lbShareOk, LBN);
check("bowlOverLB ≤ Score jeder Erweiterung (700 Zufallsfälle, Makro-Modus)", lbOverOk, LBN);
check("bowlShareLB schneidet: Kern mit 2000 kcal bei 450-kcal-Ziel → Untergrenze > 10", T.bowlShareLB([2000, 50, 0, 200, 0, 0, 100, 0], kcalT(450), { hp: true, lf: true }, -1.2, 1e9) > 10, true);
const stepsC = T.orderStepsFor(CR, rDef[0]);
check("Order Guide: Item → Deine Basis → Deine Proteine → (Deine Extras) → Dein Dip", stepsC[0].l === "Item" && stepsC[0].v === "Build your Bowl" && stepsC[1].l === "Deine Basis" && stepsC[2].l === "Deine Proteine" && stepsC[stepsC.length - 1].l === "Dein Dip", true);
check("Order Guide: Mengen bei Basis/Proteinen („1×“/„2×“), Extras ohne Menge, kein Dip → „Ohne Dip“", /^\d× /.test(stepsC[1].v) && /^\d× /.test(stepsC[2].v) && stepsC.filter(s => s.l === "Deine Extras").every(s => !/×/.test(s.v)) && stepsC[stepsC.length - 1].v === "Ohne Dip", true);
check("Zusammenfassung mit Kurznamen", T.summarizeResult(CR, rDef[0]) === T.bowlSummary(rDef[0]) && !/, \d/.test(T.bowlSummary(rDef[0])), true);
const exC2 = T.excludablesFor(CR);
check("Ausschluss-Liste: jede Zutat einmal, ohne Quinoa, Hähnchen unter „Deine Proteine“", new Set(exC2.map(x => x.id)).size === exC2.length && !exC2.some(x => x.id === "bunter_bio_quinoa") && exC2.find(x => x.id === "huehnchen").group === "Deine Proteine", true);
check("Such-Index: Compleat-Optionen mit Wolt-Namen, Hähnchen genau einmal, kein Quinoa", T.SEARCH_INDEX.filter(x => x.resto === "Compleat" && x.name === "Hähnchen, 100 g").length === 1 && !T.SEARCH_INDEX.some(x => /quinoa/i.test(x.name)), true);
check("Suche 'haehnchen' findet Hähnchen + Veganes Hähnchen", (() => { const nm = T.searchItems("haehnchen").map(x => x.name); return nm.includes("Hähnchen, 100 g") && nm.includes("Veganes Hähnchen, 80 g"); })(), true);
check("All: Compleat vertreten, respektiert Ausschlüsse", T.optimizeAll(tDef, "macros", {}, 5, false).some(r => r._resto === "compleat") && T.optimizeAll(tDef, "macros", {}, 5, false, undefined, { compleat: ["huehnchen"] }).find(r => r._resto === "compleat").items.every(x => x.ing !== "huehnchen"), true);
check("resultKey stabil über Neuberechnung (Karten-Markierung)", T.resultKey(run(tDef, stC)[0]) === T.resultKey(rDef[0]), true);

// ── Screenshot-Import-Parser (OCR-Text → verbleibende Makros C/P/F + "Übrig"-kcal) — Fälle aus dem London-Tool ──
sect("parseMacroScreenshot");
const OCR_CASES = [
  { name: "main_example", t: "Ubersicht\nGegessen        Ubrig        Verbrannt\n533            2.267            0\nKohlenhydrate   54 / 341 g\nEiweiss         52 / 184 g\nFett            9 / 69 g\n\nFruhstuck       533 / 840 kcal\nMittagessen     0 / 1.120 kcal\nAbendessen      0 / 0 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "missing_verbrannt_zero", t: "Ubersicht\nGegessen     Ubrig\n533         2.267\nKohlenhydrate 54 / 341 g\nEiweiss       52 / 184 g\nFett          9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "thousands_dot_calories", t: "Gegessen   Ubrig    Verbrannt\n1.045     1.755     120\nKohlenhydrate 120 / 250 g\nEiweiss 80 / 150 g\nFett 30 / 70 g\nMittagessen 600 / 1.200 kcal", e: { carbs: 130, protein: 70, fat: 40, kcal: 1755 } },
  { name: "slash_as_pipe_I_paren", t: "Gegessen   Ubrig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 | 341 g\nEiweiss 52 I 184 g\nFett 9 ) 69 g\nAbendessen 0 / 900 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "over_eaten_clamp_zero", t: "Gegessen   Ubrig   Verbrannt\n900   100   0\nKohlenhydrate 400 / 341 g\nEiweiss 200 / 184 g\nFett 80 / 69 g\nFruhstuck 900 / 840 kcal", e: { carbs: 0, protein: 0, fat: 0, kcal: 100 } },
  { name: "many_meal_rows_below", t: "Ubersicht\nGegessen   Ubrig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal\nMittagessen 0 / 1.120 kcal\nAbendessen 0 / 700 kcal\nSnacks 0 / 300 kcal\nSport 0 / 0 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "jumbled_spacing", t: "Gegessen    Ubrig    Verbrannt\n533     2.267     0\nKohlenhydrate    54/341g\nEiweiss   52  /  184   g\nFett 9/ 69 g\nMittagessen  0/1.120 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "ubrig_misspelled_Obrig", t: "Gegessen   Obrig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "ubrig_dropped_U_brig", t: "Gegessen   brig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "macro_pair_split_across_lines", t: "Gegessen   Ubrig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 /\n341 g\nEiweiss 52 /\n184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "ubrig_unreadable_computed_fallback", t: "Gegessen   Verbrannt\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2216 } },
  { name: "ubrig_same_line_stacked_labels", t: "Ubersicht\nGegessen 533\nUbrig 2.267\nVerbrannt 0\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "real_umlauts_present", t: "Übersicht\nGegessen   Übrig   Verbrannt\n533   2.267   0\nKohlenhydrate 54 / 341 g\nEiweiß 52 / 184 g\nFett 9 / 69 g\nFrühstück 533 / 840 kcal\nMittagessen 0 / 1.120 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  { name: "kg_decoy_line_first", t: "Gegessen   Ubrig   Verbrannt\n533   2.267   0\nGewicht 80 / 75 kg\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nMittagessen 0 / 1.120 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  // OCR zerlegt den Ring (533 / 2.267 / 0) in einzelne Zeilen -> Sicherheitsnetz muss 2267 finden (nicht 0)
  { name: "ring_numbers_split_lines", t: "Ubersicht\n533\n2.267\n0\nGegessen Ubrig Verbrannt\nKohlenhydrate 54 / 341 g\nEiweiss 52 / 184 g\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  // "g" von der OCR verschluckt (nur Slash da) -> Pass A nimmt die ersten 3 Nicht-kcal/kg-Slashpaare
  { name: "g_unit_dropped", t: "Gegessen Ubrig Verbrannt\n533 2.267 0\nKohlenhydrate 54 / 341\nEiweiss 52 / 184\nFett 9 / 69\nFruhstuck 533 / 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  // Slash verschluckt (aber "g" da) -> Pass B (durch "g" verankert)
  { name: "slash_dropped_g_present", t: "Gegessen Ubrig Verbrannt\n533 2.267 0\nKohlenhydrate 54 341 g\nEiweiss 52 184 g\nFett 9 69 g\nFruhstuck 533 840 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  // OCR liest das Einheiten-"g" als "9" ("341 g" -> "3419") -> g→9-Korrektur rechnet via Übrig (2267) auf 287/132/60 zurück
  { name: "g_merged_as_9_recovery", t: "Gegessen Ubrig Verbrannt\n533 2.267 0\nKohlenhydrate 54 / 3419\nEiweiss 52 / 1849\nFett 9 / 69 g\nFruhstuck 533 / 840 kcal\nMittagessen 0 / 1.120 kcal", e: { carbs: 287, protein: 132, fat: 60, kcal: 2267 } },
  // Fett-Angleichung: Rest-Makros ergeben mehr kcal als "Übrig" (1250 > 1000) -> Fett auf (1000-400-400)/9 = 22.2
  { name: "fat_trimmed_to_fit_kcal", t: "Gegessen Ubrig Verbrannt\n50 1.000 0\nKohlenhydrate 0 / 100 g\nEiweiss 0 / 100 g\nFett 0 / 50 g", e: { carbs: 100, protein: 100, fat: 22.2, kcal: 1000 } },
  // Carbs + Protein allein schon über "Übrig" (1600 > 1000) -> Fett auf 0
  { name: "fat_trimmed_to_zero", t: "Gegessen Ubrig Verbrannt\n50 1.000 0\nKohlenhydrate 0 / 200 g\nEiweiss 0 / 200 g\nFett 0 / 50 g", e: { carbs: 200, protein: 200, fat: 0, kcal: 1000 } },
  // Ring auf EINER Zeile -> Übrig (1112) statt Gegessen (1688)
  { name: "ring_one_line_picks_ubrig_not_gegessen", t: "Heute\nWoche 64\nUbersicht  Details\n1.688 Gegessen 1.112 Ubrig 0 Verbrannt\nKohlenhydrate\nEiweiss\nFett\n187 / 341 g\n126 / 184 g\n44 / 69 g\nErnahrung\nFruhstuck 533 / 840 kcal\nMittagessen 819 / 1.120 kcal", e: { carbs: 154, protein: 58, fat: 25, kcal: 1112 } },
  // dasselbe Layout, Ring-Zahlen je auf eigener Zeile (mit Labels verschachtelt)
  { name: "ring_separate_lines_eaten_total_macros", t: "Heute\n1.688\nGegessen\n1.112\nUbrig\n0\nVerbrannt\nKohlenhydrate\n187 / 341 g\nEiweiss\n126 / 184 g\nFett\n44 / 69 g\nFruhstuck 533 / 840 kcal\nMittagessen 819 / 1.120 kcal", e: { carbs: 154, protein: 58, fat: 25, kcal: 1112 } },
];
for (const c of OCR_CASES) {
  const r = T.parseMacroScreenshot(c.t) || {};
  const ok = r.carbs === c.e.carbs && r.protein === c.e.protein && r.fat === c.e.fat && r.kcal === c.e.kcal;
  check("OCR parse: " + c.name, ok, true);
}
check("OCR parse: Müll-Text → null", T.parseMacroScreenshot("hello world, nothing here") === null, true);
check("OCR parse: non-string → null", T.parseMacroScreenshot(null) === null, true);
check("OCR parse: nur 2 Makros → null", T.parseMacroScreenshot("54 / 341 g\n52 / 184 g") === null, true);
check("OCR parse: absurd + nicht korrigierbar → null", T.parseMacroScreenshot("Gegessen Ubrig Verbrannt\n500 300 0\nKohlenhydrate 99 / 8888\nEiweiss 88 / 7777\nFett 77 / 6666") === null, true);

// ── update-lib.js (LMIV-Parsing, Plausibilität, Marker-Block) ──
sect("update-lib.js");
check("parseNum '12,5' → 12.5", U.parseNum("12,5"), 12.5);
check("parseNum '1.234' → 1234 (Tausenderpunkt)", U.parseNum("1.234"), 1234);
check("parseNum '1.234,5' → 1234.5", U.parseNum("1.234,5"), 1234.5);
check("parseNum '<0,5' → 0.5", U.parseNum("<0,5"), 0.5);
check("parseNum '-' und '--' → 0", U.parseNum("-") === 0 && U.parseNum("--") === 0, true);
check("parseNum '0,05 g' → 0.05 (Einheit ignoriert)", U.parseNum("0,05 g"), 0.05);
check("parseNum '2.267 kJ' → 2267", U.parseNum("2.267 kJ"), 2267);
check("parseNum '12.5' (Dezimalpunkt) → 12.5", U.parseNum("12.5"), 12.5);
check("parseNum: Zahl bleibt Zahl", U.parseNum(7.3), 7.3);
check("parseNum: leer / 'Spuren' / null / negativ → Fehler", throws(() => U.parseNum("")) && throws(() => U.parseNum("Spuren")) && throws(() => U.parseNum(null)) && throws(() => U.parseNum(-1)), true);
check("saltFromSodium: 0,4 g Natrium → 1 g Salz", U.saltFromSodium("0,4"), 1);
check("scalePer100: 150 g Portion (200 kcal/100 g → 300)", U.scalePer100({ kcal: 200, fat: 10, sat: 2, carbs: 20, sugars: 5, fibre: 3, protein: 8, salt: 1.2 }, 150).kcal, 300);
check("scalePer100: ohne Portionsgewicht → Fehler", throws(() => U.scalePer100({ kcal: 1 }, 0)), true);
check("slugId: Umlaute + Sonderzeichen", U.slugId("Süßkartoffel-Pommes (groß)") === "suesskartoffel_pommes_gross", true);
check("checkItem: stimmiges Item ok", U.checkItem({ kcal: 542, fat: 14, sat: 3, carbs: 62, sugars: 7, fibre: 6, protein: 42, salt: 2 }).length, 0);
check("checkItem: kcal passt nicht zu den Makros", U.checkItem({ kcal: 900, fat: 14, sat: 3, carbs: 62, sugars: 7, fibre: 6, protein: 42, salt: 2 }).length, 1);
check("checkItem: sat > fat und sugars > carbs", U.checkItem({ kcal: 100, fat: 2, sat: 3, carbs: 20, sugars: 25, fibre: 0, protein: 3.5, salt: 0 }).length, 2);
const blk = U.wrapBlock("TEST", "node test.js", ["const TEST = 1;"]);
const htmlLF = "a\n// __TEST_DATA_START__ alt\nconst TEST = 0;\n// __TEST_DATA_END__\nb";
check("replaceBlock: ersetzt Block inkl. Marker (LF)", U.replaceBlock(htmlLF, "TEST", blk) === "a\n// __TEST_DATA_START__ (generiert via: node test.js — nicht von Hand editieren)\nconst TEST = 1;\n// __TEST_DATA_END__\nb", true);
const outCRLF = U.replaceBlock(htmlLF.replace(/\n/g, "\r\n"), "TEST", blk);
check("replaceBlock: CRLF-Datei bleibt durchgehend CRLF", outCRLF.includes("const TEST = 1;\r\n// __TEST_DATA_END__") && !/[^\r]\n/.test(outCRLF), true);
check("replaceBlock: fehlende Marker → null", U.replaceBlock("ohne marker", "TEST", blk) === null, true);
check("replaceBlock: '$&' im Inhalt bleibt wörtlich", U.replaceBlock(htmlLF, "TEST", U.wrapBlock("TEST", "x", ['const N = "A$&B";'])).includes('"A$&B"'), true);
const dl = U.acDataLines("X", [{ id: "k", name: "K", on: true }, { id: "d", name: "D", on: true, drink: true }], [{ id: "i", name: "I", cat: "k", kcal: 1, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0, sauce: true }], ["sauce"]);
check("acDataLines: drink- und Flag-Felder im Block", dl.some(l => l.includes("drink:true")) && dl.some(l => l.includes("sauce:true")), true);
check("buildAcItems: unbekannte Kategorie → Fehler", throws(() => U.buildAcItems([{ name: "X", cat: "nope", kcal: 1, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0 }], [{ id: "k" }])), true);

console.log(`\n${passes} bestanden, ${failures} fehlgeschlagen`);
if (failures) { console.log(failures + " Test(s) fehlgeschlagen"); process.exit(1); }
console.log("Alle Tests bestanden");
