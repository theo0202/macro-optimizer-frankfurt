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

(0, eval)(SCRIPT + "\n;globalThis.__t = { LS_PREFIX, LS, lsGet, lsSet, COMPLEAT, DEANDAVID, KEYS, sumN, score, scoreVec, sortResults, parseMacroScreenshot, SHELLFISH_RE, SHELLFISH_NAMES, SHELLFISH_SAFE, isShellfish, comboLabel, acOrderSteps, resultKey, alaCarteCombos, bowlCombos, bowlShareL, bowlShareLB, bowlKcalShareMin, BOWL_MAX_WORK, BOWL_MAX_MS, bowlOverLB, bowlRole, bowlEuro, bowlPreselectNote, bowlSubtitle, compleatEntry, bowlSummary, bowlOrderSteps, bowlSearchEntries, bowlExcludables, bowlIncludables, addInclude, includablesFor, bowlOptimize, bowlEntry, BOWL_LABELS, bowlValidate, switchPass, COMPLEAT_BLOCKED, compleatOptimize, RESERVED_TABS, defaultRestoState, initRestoStates, allState, toggleSwitch, optimizeAC, runOptimize, orderStepsFor, searchEntriesFor, summarizeResult, RESTAURANTS, RESTO_BY_KEY, validateRegistry, optimizeAll, buildSearchIndex, SEARCH_INDEX, foldVariants, searchItems, orderTotal, matchesQuery, excludablesFor, SPECIAL_TABS, DEFAULT_TAB, bowlIndex, bowlScoreKeys, switchForce, SUBWAY, SUBWAY_BLOCKED, SUBWAY_SWITCHES, SUBWAY_NOTE, subwayCombos, subwayOptimize, subwaySummary, subwayOrderSteps, subwaySearchEntries, subwayMenu, subwayMenuOf, subwayValidate, bowlSameKey, bowlDedupe, MCDONALDS, CHIDOBA, CHIDOBA_SWITCHES, CHIDOBA_TYPES, CHIDOBA_NOTE, chidobaMenu, chidobaCombos, chidobaOptimize, chidobaSummary, chidobaOrderSteps, chidobaRemovals, chidobaSearchEntries, chidobaListEntries, chidobaValidate, subwaySetVeggies, subwayVeggieIngs, LORYS, KAFFEEBOHNE, acVariantKey, acExcluded };");
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
check("Pflicht-Zutaten landen in fra_included (LS.included)", T.LS.included === "included", true);
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
check("validateRegistry: force-Schalter nur als Liste von Zutat-ids und nur bei Build-Your-Own", (() => { const a = goodAC(); a.switches = [{ id: "f", label: "F", def: true, force: ["x"] }]; const b = goodAC(); b.switches = [{ id: "f", label: "F", def: true, force: "x" }]; return T.validateRegistry([a]).some(p => /force/.test(p)) && T.validateRegistry([b]).some(p => /force/.test(p)) && !T.validateRegistry([b]).some(p => /ohne Wirkung/.test(p)); })(), true);
check("switchForce: Zutat-ids der aktiven force-Schalter", T.switchForce({ switches: [{ id: "a", force: ["x", "y"] }, { id: "b", force: ["z"] }, { id: "c", filter: () => true }] }, { sw: { a: true, b: false, c: true } }).join() === "x,y", true);

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
// Preise, Preislimit und Pflicht-Produkte („Must include“ à la carte, User 16.09.2026)
const TRP = { ...TR, key: "testp", data: { cats: TR.data.cats, items: TR.data.items.map((x, i) => ({ ...x, price: [5, 4, 2, 1.5, 3, 2, 6][i] })) } };
check("Test-Restaurant mit Preisen gültig; Preis keine Zahl → gemeldet", T.validateRegistry([TRP]).length === 0 && T.validateRegistry([{ ...TRP, data: { cats: TR.data.cats, items: [{ ...TRP.data.items[0], price: "5" }] } }]).some(p => /price/.test(p)), true);
const rP1 = T.optimizeAC(TRP, tTR, "macros", {}, stTR);
check("Preise: jedes Ergebnis trägt price = Σ Item-Preise; ohne Preisdaten kein price", rP1.length > 0 && rP1.every(r => Math.abs(r.price - r.items.reduce((a, x) => a + x.price, 0)) < 1e-9) && rTR.every(r => r.price === undefined), true);
check("Preislimit 6 €: kein Ergebnis teurer; ohne Preisdaten wirkt das Limit nicht", (() => { const r = T.optimizeAC(TRP, { ...tTR, maxPrice: 6 }, "macros", {}, stTR); const r0 = T.optimizeAC(TR, { ...tTR, maxPrice: 1 }, "macros", {}, stTR); return r.length > 0 && r.every(x => x.price <= 6 + 1e-9) && rP1.some(x => x.price > 6) && r0.length === rTR.length; })(), true);
check("Preislimit unter dem Preis der Pflicht-Produkte → keine Ergebnisse", T.optimizeAC(TRP, { ...tTR, maxPrice: 4 }, "macros", {}, stTR, null, ["m1"]).length, 0);
const rIncAC = T.optimizeAC(TRP, tgt(50, 90, 20), "macros", {}, stTR, null, ["d1", "s2"]);
check("Pflicht-Produkte: in jeder Bestellung — auch aus ausgeschalteter Kategorie (d1) und am Schalter vorbei (s2 sauce)", rIncAC.length > 0 && rIncAC.every(r => r.items.some(x => x.id === "d1") && r.items.some(x => x.id === "s2")), true);
check("Pflicht-Produkte zählen zu „Max. items“ (maxN 3 → höchstens 1 Zusatz); maxN = Anzahl Pflicht → nur die Pflicht-Produkte", T.optimizeAC(TRP, tTR, "macros", {}, { ...stTR, maxN: 3 }, null, ["d1", "s2"]).every(r => r.items.length <= 3) && (() => { const r = T.optimizeAC(TRP, tTR, "macros", {}, { ...stTR, maxN: 2 }, null, ["d1", "s2"]); return r.length === 1 && ids(r[0]) === "d1|s2"; })(), true);
check("Pflicht-Produkt unbekannt oder Getränk → [] mit missing; ausgeschlossen → still ignoriert", (() => { const a = T.optimizeAC(TRP, tTR, "macros", {}, stTR, null, ["gibtsnicht"]); const b = T.optimizeAC(TRP, tTR, "macros", {}, stTR, null, ["dr1"]); const c = T.optimizeAC(TRP, tTR, "macros", {}, stTR, new Set(["m1"]), ["m1"]); return a.length === 0 && a.missing.join() === "gibtsnicht" && b.missing.join() === "dr1" && c.length > 0 && allItems(c).every(x => x.id !== "m1"); })(), true);
check("runOptimize reicht Pflicht-Produkte an à la carte durch; includablesFor (à la carte) = Ausschluss-Liste mit Rolle item", T.runOptimize(TRP, tTR, "macros", {}, stTR, new Set(), new Set(["s1"])).every(r => r.items.some(x => x.id === "s1")) && T.includablesFor(TRP).map(x => x.id + ":" + x.role).join(",") === "m1:item,m2:item,s1:item,s2:item,d1:item,fish1:item", true);
check("alaCarteCombos: maxN 0 mit Basis → nur die Basis; Basis über dem Preislimit → []", (() => { const b = TRP.data.items.slice(0, 2); const r = T.alaCarteCombos(tTR, "macros", {}, TRP.data.items, 0, { baseItems: b, priced: true }); return r.length === 1 && r[0].items.length === 2 && r[0].price === 9 && T.alaCarteCombos(tTR, "macros", {}, TRP.data.items, 3, { baseItems: b, priced: true, maxPrice: 8 }).length === 0; })(), true);
check("allow-Schalter: Items nur mit eingeschaltetem Schalter (à la carte + switchPass), Pflicht geht vorbei; validateRegistry kennt allow", (() => {
  const TRA = { ...TRP, key: "testa", switches: [...TR.switches, { id: "addFish", label: "Add fish", def: false, allow: x => !!x.fish }] };
  const off = T.optimizeAC(TRA, tgt(45, 35, 10), "macros", {}, T.defaultRestoState(TRA)), on = T.optimizeAC(TRA, tgt(45, 35, 10), "macros", {}, { ...T.defaultRestoState(TRA), sw: { ...T.defaultRestoState(TRA).sw, addFish: true } });
  const pick = T.optimizeAC(TRA, tgt(45, 35, 10), "macros", {}, T.defaultRestoState(TRA), null, ["fish1"]);
  const bad = { ...TRA, switches: [{ id: "a", label: "A", def: false, allow: "x" }] };
  return T.validateRegistry([TRA]).length === 0 && allItems(off).every(x => !x.fish) && allItems(on).some(x => x.fish) && pick.every(r => r.items.some(x => x.id === "fish1"))
    && T.switchPass(TRA, { sw: {} })(TRP.data.items[6]) === false && T.switchPass(TRA, { sw: { addFish: true } })(TRP.data.items[6]) === true && T.validateRegistry([bad]).some(p => /allow/.test(p));
})(), true);
check("acOrderSteps: orderNote an den Namen gehängt", (() => { const st1 = T.acOrderSteps([{ id: "n9", name: "9 Nuggets", orderNote: "Sauce 1/2, Sauce 2/2: Ohne Sauce" }, { id: "n9", name: "9 Nuggets", orderNote: "Sauce 1/2, Sauce 2/2: Ohne Sauce" }]); return st1.length === 1 && st1[0].l === "2×" && st1[0].v === "9 Nuggets — Sauce 1/2, Sauce 2/2: Ohne Sauce"; })(), true);
// À la carte mit Varianten (Die gruene Kaffeebohne, User 17.09.2026): Gericht (product) × Optionen (choices)
const vit = (id, prod, ch, carbs, protein, fat, price) => it(id, "mains", carbs, protein, fat, { name: prod + (ch.length ? " · " + ch.join(" · ") : ""), price, product: prod, productName: prod.toUpperCase(), choices: ch, orderName: prod.toUpperCase(), orderNote: "Opt: " + ch.join("/") });
const TRV = {
  key: "testv", name: "Test V", kind: "ac", gradient: ["#000", "#111"], label: "TESTV", platform: "Wolt", accurate: true, maxN: 5, switches: [],
  data: {
    cats: [{ id: "mains", name: "Mains", on: true }, { id: "sides", name: "Sides", on: true }],
    choices: [{ id: "p1", name: "Chicken", group: "Protein option" }, { id: "p2", name: "Tofu", group: "Protein option" }, { id: "c1", name: "Rice", group: "Carb option" }, { id: "c2", name: "Salad", group: "Carb option" }],
    items: [
      vit("b1_p1_c1", "b1", ["p1", "c1"], 80, 40, 10, 12), vit("b1_p1_c2", "b1", ["p1", "c2"], 10, 38, 9, 12), vit("b1_p2_c1", "b1", ["p2", "c1"], 82, 28, 16, 13), vit("b1_p2_c2", "b1", ["p2", "c2"], 12, 26, 15, 13),
      vit("b2_p1", "b2", ["p1"], 20, 30, 8, 10), vit("b2_p2", "b2", ["p2"], 22, 18, 14, 11),
      it("s1", "sides", 30, 5, 10, { price: 3 }), it("s2", "sides", 5, 20, 12, { price: 4 }), it("s3", "sides", 40, 2, 1, { price: 2 }),
    ],
  },
};
const stV = T.defaultRestoState(TRV);
check("Varianten: Test-Restaurant gültig; ungültige choices/product-Kollision gemeldet", T.validateRegistry([TRV]).length === 0 && T.validateRegistry([{ ...TRV, data: { ...TRV.data, items: [...TRV.data.items, vit("x", "b1", ["zz"], 1, 1, 1, 1)] } }]).some(p => /choices ungültig/.test(p)) && T.validateRegistry([{ ...TRV, data: { ...TRV.data, items: [...TRV.data.items, it("b1", "sides", 1, 1, 1, { price: 1 })] } }]).some(p => /kollidiert/.test(p)), true);
check("Varianten: Ausschluss-Liste = Gerichte (productName) + Optionen, Pflicht-Liste = nur Gerichte", T.excludablesFor(TRV).map(x => x.id + "=" + x.name).join(",") === "b1=B1,b2=B2,s1=s1,s2=s2,s3=s3,p1=Chicken,p2=Tofu,c1=Rice,c2=Salad" && T.includablesFor(TRV).map(x => x.id + ":" + x.role).join(",") === "b1:item,b2:item,s1:item,s2:item,s3:item", true);
check("Varianten: Ausschluss eines Gerichts entfernt alle Varianten, einer Option alle Varianten mit ihr", (() => { const a = T.optimizeAC(TRV, tgt(60, 90, 20), "macros", {}, stV, new Set(["b1"])); const b = T.optimizeAC(TRV, tgt(60, 90, 20), "macros", {}, stV, new Set(["p1"])); return a.length > 0 && allItems(a).every(x => x.product !== "b1") && b.length > 0 && allItems(b).every(x => !(x.choices || []).includes("p1")) && T.acExcluded(TRV.data.items[0], new Set(["c1"])) && !T.acExcluded(TRV.data.items[1], new Set(["c1"])); })(), true);
check("Varianten: Pflicht-Gericht → jede Bestellung enthält genau eine seiner Varianten als Basis (Optimizer wählt die Variante); alle Varianten ausgeschlossen → missing", (() => { const r = T.optimizeAC(TRV, tgt(70, 60, 25), "macros", {}, stV, null, ["b1"]); const m = T.optimizeAC(TRV, tgt(70, 60, 25), "macros", {}, stV, new Set(["p1", "p2"]), ["b1"]); return r.length > 0 && r.every(x => x.items.some(y => y.product === "b1")) && new Set(r.map(x => x.items.find(y => y.product === "b1").id)).size > 1 && m.length === 0 && m.missing.join() === "b1"; })(), true);
check("Varianten: Pflicht-Gericht exakt — bestes Ergebnis = vollständige Durchrechnung (Basis + 1 und + 2 Items, Makro + Kalorien, mit/ohne Preislimit)", (() => {
  const pool = TRV.data.items, vs = pool.filter(x => x.product === "b1");
  const cases = [[tgt(70, 60, 25), "macros", {}, null], [tgt(90, 150, 30), "macros", {}, null], [kcalT(900), "calories", { hp: true }, null], [tgt(80, 100, 25), "macros", {}, 20]];
  return cases.every(([tt, md, pp, mp]) => [2, 3].every(maxN => {
    let best = Infinity;
    const ok = items => mp == null || items.reduce((a, x) => a + x.price, 0) <= mp + 1e-9;
    for (const v of vs) { if (ok([v])) best = Math.min(best, T.score(T.sumN([v], 1), tt, md, pp)); for (let i = 0; i < pool.length; i++) { if (ok([v, pool[i]])) best = Math.min(best, T.score(T.sumN([v, pool[i]], 1), tt, md, pp)); if (maxN === 3) for (let j = i; j < pool.length; j++) if (ok([v, pool[i], pool[j]])) best = Math.min(best, T.score(T.sumN([v, pool[i], pool[j]], 1), tt, md, pp)); } }
    const r = T.optimizeAC(TRV, { ...tt, maxPrice: mp }, md, pp, { ...stV, maxN }, null, ["b1"]);
    return r.length > 0 && Math.abs(r[0].score - best) < 1e-9;
  }));
})(), true);
check("Varianten: wertgleiche Bestellungen (gleiche Gerichte, Nährwerte, Preis — z.B. Option bei Gericht A statt B getauscht) nur einmal; acOrderSteps nutzt orderName", (() => {
  const a = [TRV.data.items[4], TRV.data.items[5]], b = [TRV.data.items[5], TRV.data.items[4]];
  const r = T.optimizeAC(TRV, tgt(70, 60, 25), "macros", {}, stV);
  const st1 = T.acOrderSteps([TRV.data.items[1]]);
  return T.acVariantKey(a) === T.acVariantKey(b) && T.acVariantKey(a) !== T.acVariantKey([TRV.data.items[4]]) && new Set(r.map(x => T.acVariantKey(x.items))).size === r.length && st1[0].v === "B1 — Opt: p1/c2";
})(), true);

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
const opt = (id, group, carbs, protein, fat, more) => Object.assign({ id, name: id, short: id, group, ing: (more && more.ing) || id, maxQty: 1, price: 1, kcal: 4 * carbs + 4 * protein + 9 * fat, fat, sat: 0, carbs, sugars: 0, fibre: 0, protein, salt: 0 }, more || {});
// reis_h = halbe Portion Reis (halbe Menge, halber Preis) · bohnen = steht in der Protein-Gruppe, zählt aber als Extra (wie Edamame bei Uber Eats)
const TMENU = { item: "Test Bowl", basePrice: 2, groups: [
  { id: "base", name: "Basis", min: 0, max: 3, none: null, options: [opt("reis", "base", 60, 6, 1, { maxQty: 4, price: 2.5 }), opt("reis_h", "base", 30, 3, 0.5, { ing: "reis", half: true, maxQty: 4, price: 1.25 }), opt("salat", "base", 3, 1, 0, { maxQty: 4, price: 2 }), opt("nudeln", "base", 45, 20, 4, { price: 3.5 })] },
  { id: "protein", name: "Proteine", min: 0, max: 10, none: null, options: [opt("huhn", "protein", 1, 23, 3, { maxQty: 10, price: 3 }), opt("tofu", "protein", 3, 12, 7, { maxQty: 10, price: 2.5 }), opt("lachs", "protein", 0, 20, 14, { price: 4 }), opt("bohnen", "protein", 8, 10, 1, { role: "extra", maxQty: 5, price: 1.5 })] },
  { id: "extra", name: "Extras", min: 0, max: 30, none: null, options: [opt("huhn_x", "extra", 1, 23, 3, { ing: "huhn", price: 3 }), opt("ei", "extra", 0, 7, 5), opt("mais", "extra", 6, 1, 1), opt("nuss", "extra", 1, 3, 13, { crunch: true }), opt("avo", "extra", 1, 1, 4, { price: 1.5 }), opt("garnele", "extra", 0, 18, 1, { name: "Garnelen, 50 g" }), opt("pfeffer", "extra", 0, 0, 0, { price: 0 })] },
  { id: "dip", name: "Dip", min: 1, max: 1, none: "Ohne Dip", options: [opt("curry", "dip", 8, 0, 30, { price: 2 }), opt("tzatziki", "dip", 5, 11, 0, { price: 2 })] },
] };
const tB = tgt(60, 70, 18);
const rTB = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3 });
const cnt = (r, role) => r.parts.filter(pt => T.bowlRole(pt.opt) === role).reduce((s, pt) => s + pt.qty, 0);
const ingHU = r => { const m = {}; for (const pt of r.parts) if (["base", "protein"].includes(T.bowlRole(pt.opt))) m[pt.opt.ing] = (m[pt.opt.ing] || 0) + (pt.opt.half ? 1 : 2) * pt.qty; return m; };
check("bowlCombos: liefert Ergebnisse (≤ 20)", rTB.length > 0 && rTB.length <= 20, true);
check("jede Bowl: ≥1 Base und ≥1 Protein (nach Rolle)", rTB.every(r => cnt(r, "base") >= 1 && cnt(r, "protein") >= 1), true);
check("Portionen-Deckel je Zutat (cap 2 = höchstens 2 ganze Portionen, halbe = ½), Extras je 1×", rTB.every(r => Object.values(ingHU(r)).every(v => v <= 4) && r.parts.every(pt => T.bowlRole(pt.opt) !== "extra" || pt.qty === 1)), true);
check("Gruppen-Maximum Basis (max 3 Auswahlen)", T.bowlCombos(TMENU, tgt(30, 400, 5), "macros", {}, { cap: 4, maxExtras: 0 }).every(r => cnt(r, "base") <= 3), true);
check("maxQty der Option (nudeln 1×)", T.bowlCombos(TMENU, tgt(200, 200, 30), "macros", {}, { cap: 4, maxExtras: 5 }).every(r => r.parts.every(pt => pt.opt.id !== "nudeln" || pt.qty <= 1)), true);
check("maxExtras 3 / 0", rTB.every(r => cnt(r, "extra") <= 3) && T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 0 }).every(r => cnt(r, "extra") === 0), true);
check("Protein-Duplikat unter Extras wird nie genutzt (läuft über die Protein-Rolle)", T.bowlCombos(TMENU, tgt(150, 60, 10), "macros", {}, { cap: 4, maxExtras: 5 }).every(r => r.parts.every(pt => pt.opt.id !== "huhn_x")), true);
check("höchstens ein Dip", rTB.every(r => r.items.filter(x => T.bowlRole(x) === "dip").length <= 1), true);
check("Schalentier-Option nie im Ergebnis", T.bowlCombos(TMENU, tgt(80, 60, 5), "macros", {}, { cap: 2, maxExtras: 5 }).every(r => r.items.every(x => x.id !== "garnele")), true);
check("Option ohne Nährwerte (alles 0) wird nie vorgeschlagen (keine Doppel-Ergebnisse)", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 5 }).every(r => r.items.every(x => x.id !== "pfeffer")), true);
check("keep-Filter wirkt (keine Dips / kein Crunch)", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, keep: x => T.bowlRole(x) !== "dip" && !x.crunch }).every(r => !r.dip && r.items.every(x => !x.crunch)), true);
check("Pflicht nicht erfüllbar (keine Base erlaubt) → keine Ergebnisse", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, keep: x => x.group !== "base" }).length, 0);
check("nutrition = sumN der Items, Score darauf, sortiert", rTB.every(r => JSON.stringify(r.nutrition) === JSON.stringify(T.sumN(r.items, 1)) && Math.abs(r.score - T.score(r.nutrition, tB, "macros", {})) < 1e-12) && rTB.every((r, i) => i === 0 || rTB[i - 1].score <= r.score), true);
check("Keys eindeutig und stabil", new Set(rTB.map(r => r.key)).size === rTB.length && JSON.stringify(rTB.map(r => r.key)) === JSON.stringify(T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3 }).map(r => r.key)), true);
check("exakter Treffer wird gefunden (reis + huhn + ei + tzatziki)", (() => { const tt = tgt(6 + 23 + 7 + 11, 60 + 1 + 0 + 5, 1 + 3 + 5 + 0); const r0 = T.bowlCombos(TMENU, tt, "macros", {}, { cap: 2, maxExtras: 3 })[0]; return r0.score < 1e-9 && r0.key === "reisx1+huhnx1+eix1|tzatziki"; })(), true);
// Rollen: role überschreibt die Gruppe
check("Rolle: Option der Protein-Gruppe mit role extra (Bohnen) erfüllt „≥1 Protein“ nicht", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, keep: x => x.group !== "protein" || x.id === "bohnen" }).length, 0);
check("Rolle extra zählt als Extra (maxExtras 0 → nie Bohnen; exakter Treffer mit Bohnen als Extra)", T.bowlCombos(TMENU, tgt(80, 60, 10), "macros", {}, { cap: 2, maxExtras: 0 }).every(r => r.items.every(x => x.id !== "bohnen")) && (() => { const r0 = T.bowlCombos(TMENU, tgt(6 + 23 + 10, 60 + 1 + 8, 1 + 3 + 1), "macros", {}, { cap: 2, maxExtras: 2 })[0]; return r0.rawScore < 1e-9 && r0.parts.some(pt => pt.opt.id === "bohnen" && pt.qty === 1); })(), true);
// Halbe Portionen
const rHalf = T.bowlCombos(TMENU, tgt(40, 150, 15), "macros", {}, { cap: 3, maxExtras: 2 });
check("halbe Portion neben erlaubter ganzer höchstens 1× (2 halbe = 1 ganze → keine Doppel-Ergebnisse)", rHalf.length > 0 && rHalf.every(r => r.parts.every(pt => !pt.opt.half || pt.qty === 1)), true);
check("ganze Portion ausgeschlossen → halbe darf mehrfach (bis zum Deckel: cap 2 = 4 halbe)", (() => { const r = T.bowlCombos(TMENU, tgt(12, 120, 3), "macros", {}, { cap: 2, maxExtras: 0, keep: x => !["reis", "salat", "nudeln"].includes(x.id) }); return r.length > 0 && r.some(x => x.parts.some(pt => pt.opt.id === "reis_h" && pt.qty >= 2)) && r.every(x => x.parts.every(pt => pt.opt.id !== "reis_h" || pt.qty <= 4)); })(), true);
check("Deckel in halben Portionen: cap 1 → nie ganze + halbe derselben Zutat", T.bowlCombos(TMENU, tgt(30, 200, 10), "macros", {}, { cap: 1, maxExtras: 1 }).every(r => !(r.parts.some(pt => pt.opt.id === "reis") && r.parts.some(pt => pt.opt.id === "reis_h"))), true);
// Preise + Preislimit
const priceOf = (menu, r) => Math.round((menu.basePrice + r.parts.reduce((s, pt) => s + pt.opt.price * pt.qty, 0) + (r.dip ? r.dip.price : 0)) * 100) / 100;
check("Preis = Grundpreis + Σ Optionspreise × Menge (inkl. Dip)", rTB.every(r => typeof r.price === "number" && Math.abs(r.price - priceOf(TMENU, r)) < 1e-9), true);
const rP = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, maxPrice: 9 });
check("Preislimit 9 €: Ergebnisse vorhanden, keines teurer — ohne Limit gibt es teurere", rP.length > 0 && rP.every(r => r.price <= 9 + 1e-9) && rTB.some(r => r.price > 9), true);
check("Preislimit unter dem Grundpreis → keine Bowl", T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, maxPrice: 1.99 }).length, 0);
check("Preislimit null / leer = kein Limit", [null, undefined, ""].every(v => JSON.stringify(T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, maxPrice: v }).map(r => r.key)) === JSON.stringify(rTB.map(r => r.key))), true);
check("bowlEuro: „€12.50“", T.bowlEuro(12.5) === "€12.50" && T.bowlEuro(0) === "€0.00", true);
check("Arbeitsbudget: winziges Budget → Suche endet früh mit Flag approx, Regeln bleiben erfüllt", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, maxWork: 40 }); return r.approx === true && r.length > 0 && r.every(x => cnt(x, "base") >= 1 && cnt(x, "protein") >= 1 && Object.values(ingHU(x)).every(v => v <= 4)); })(), true);
check("Arbeitsbudget: normale Suche ohne approx-Flag; raw-Rangliste trägt das Flag ebenfalls", rTB.approx === undefined && T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, raw: true, maxWork: 40 }).approx === true && T.BOWL_MAX_WORK > 1e6, true);

// Vollständige Durchrechnung mit identischen Regeln (Rollen, halbe Portionen, Deckel, Preislimit) — Referenz für die Exaktheit der Suche:
// die 30 besten Roh-Scores, aufsteigend
function exhaustiveBowl(menu, t, mode, p, o) {
  const role = x => x.role || x.group;
  const keep = x => !T.isShellfish(x) && (!o.keep || o.keep(x));
  const need = Object.assign({ base: true, protein: true }, menu.require || {});
  const inc = new Set(o.include || []);
  const all = menu.groups.flatMap(g => g.options.map(x => ({ x, g })));
  const vec = x => T.KEYS.map(k => x[k] || 0);
  const cents = x => Math.round((x.price || 0) * 100);
  const Z = () => [0, 0, 0, 0, 0, 0, 0, 0];
  const fixed = menu.fixed || [];
  if (fixed.some(x => T.isShellfish(x))) return [];
  const gmax = { base: Infinity, protein: Infinity };
  let emax = Infinity;
  for (const { x, g } of all) { const r = role(x); if (r in gmax) gmax[r] = Math.min(gmax[r], g.max); else if (r === "extra" && !g.own) emax = Math.min(emax, g.max); }
  const protIngs = menu.proteinExtras ? new Set() : new Set(all.filter(({ x }) => role(x) === "protein").map(({ x }) => x.ing));
  // Pflicht-Zutaten: Rolle laut Menü (nur pickRoles; Wolt-Duplikate unter Extras zählen nicht)
  const incRole = new Map();
  for (const { x } of all) if (inc.has(x.ing) && (!menu.pickRoles || menu.pickRoles.includes(role(x))) && !(role(x) === "extra" && protIngs.has(x.ing)) && !incRole.has(x.ing)) incRole.set(x.ing, role(x));
  for (const ing of inc) if (!incRole.has(ing)) return [];
  // Welche Werte den Score ändern können — unabhängig von bowlScoreKeys durch Stören von scoreVec ermittelt
  let sd = 11;
  const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const matters = T.KEYS.map((_, k) => { for (let i = 0; i < 40; i++) { const n = T.KEYS.map(() => rr() * 300 + 1); const n2 = n.slice(); n2[k] += 0.5 + rr() * 40; if (Math.abs(T.scoreVec(n2, t, mode, p) - T.scoreVec(n, t, mode, p)) > 1e-12) return true; } return false; });
  // fester Anteil: Bestandteile ohne Auswahl + Pflicht-Extras
  const off = Z();
  let offPc = 0;
  const addOff = x => { const v = vec(x); for (let k = 0; k < 8; k++) off[k] += v[k]; offPc += cents(x); };
  fixed.forEach(addOff);
  const EA = all.filter(({ x }) => role(x) === "extra" && keep(x) && !protIngs.has(x.ing));
  const forced = [];
  for (const ing of inc) if (incRole.get(ing) === "extra") { const e = EA.find(y => y.x.ing === ing); if (!e) return []; forced.push(e); }
  for (const g of menu.groups) if (g.own && forced.filter(e => e.g.id === g.id).length > g.max) return [];
  forced.forEach(e => addOff(e.x));
  const budget = (o.maxPrice == null ? Infinity : Math.round(o.maxPrice * 100) - Math.round((menu.basePrice || 0) * 100)) - offPc;
  if (budget < 0) return [];
  // Kern je Portionen-Rolle: je Zutat ganze Optionen (auch Varianten) je ≤ min(maxQty, cap) + halbe (≤ 1 neben erlaubter ganzer, sonst
  // ≤ min(maxQty, 2·cap)), 2·Σganze + halbe ≤ 2·cap; Pflicht-Zutaten der Rolle brauchen mindestens eine Portion
  const coreCombos = r => {
    const byIng = new Map();
    for (const { x } of all) if (role(x) === r && keep(x)) { const e = byIng.get(x.ing) || { full: [], half: null }; if (x.half) e.half = x; else e.full.push(x); byIng.set(x.ing, e); }
    const must = [...incRole].filter(([, rr2]) => rr2 === r).map(([ing]) => ing);
    if (must.some(ing => !byIng.has(ing))) return null;
    let out = [{ n: Z(), c: 0, pc: 0, sat: 0 }];
    for (const [ing, { full, half }] of byIng) {
      let fv = [{ q: 0, hu: 0, n: Z(), pc: 0 }];
      for (const f of full) {
        const nx = [];
        for (const s0 of fv) for (let a = 0; a <= Math.min(f.maxQty || 1, o.cap); a++) {
          if (s0.hu + 2 * a > 2 * o.cap) continue;
          const v = vec(f);
          nx.push({ q: s0.q + a, hu: s0.hu + 2 * a, n: s0.n.map((y, k) => y + v[k] * a), pc: s0.pc + cents(f) * a });
        }
        fv = nx;
      }
      const bMax = half ? Math.min(half.maxQty || 1, full.length ? 1 : 2 * o.cap) : 0;
      const isMust = must.includes(ing), nx = [];
      for (const s0 of out) for (const fq of fv) for (let b = 0; b <= bMax; b++) {
        if (fq.hu + b > 2 * o.cap || s0.c + fq.q + b > gmax[r]) continue;
        const n = s0.n.map((y, k) => y + fq.n[k]);
        if (b) { const v = vec(half); for (let k = 0; k < 8; k++) n[k] += v[k] * b; }
        nx.push({ n, c: s0.c + fq.q + b, pc: s0.pc + fq.pc + (b ? cents(half) * b : 0), sat: s0.sat + (isMust && fq.q + b > 0 ? 1 : 0) });
      }
      out = nx;
    }
    return out.filter(s0 => s0.c >= (need[r] ? 1 : 0) && s0.sat === must.length);
  };
  const bc = coreCombos("base"), pc = coreCombos("protein");
  if (!bc || !pc) return [];
  // Einzelauswahl (dip, side): keine oder eine Option; Pflicht-Zutat → nur deren Varianten
  const choice = r => {
    const opts = all.filter(({ x }) => role(x) === r && keep(x)).map(({ x }) => x);
    const must = [...incRole].filter(([, rr2]) => rr2 === r).map(([ing]) => ing);
    if (must.length > 1) return null;
    if (must.length === 1) { const v = opts.filter(x => x.ing === must[0]); return v.length ? v : null; }
    return [null, ...opts];
  };
  const D = choice("dip"), SD = choice("side");
  if (!D || !SD) return [];
  // freie Extras: keine Pflicht-Extras, keine pick-Optionen, nur mit Wirkung auf den Score; Grenzen je Klasse (Extras-Chip bzw. own-Gruppe)
  const E = EA.filter(e => incRole.get(e.x.ing) !== "extra" && !e.x.pick && vec(e.x).some((v, k) => v > 0 && matters[k]));
  const maxE = Math.max(0, Math.min(emax, o.maxExtras == null ? Infinity : o.maxExtras) - forced.filter(e => !e.g.own).length);
  const capOf = key => key === "" ? maxE : menu.groups.find(g => g.id === key).max - forced.filter(e => e.g.id === key).length;
  const es = [], used = new Map();
  const rec = (i, n, pr) => {
    es.push({ n, pr });
    for (let j = i; j < E.length; j++) {
      const key = E[j].g.own ? E[j].g.id : "", c = used.get(key) || 0;
      if (c >= capOf(key)) continue;
      used.set(key, c + 1);
      const v = vec(E[j].x);
      rec(j + 1, n.map((x, k) => x + v[k]), pr + cents(E[j].x));
      used.set(key, c);
    }
  };
  rec(0, Z(), 0);
  const top = [], n = Z();
  let thr = Infinity;
  for (const d of D) for (const sd2 of SD) {
    const cv = off.slice(), cpc = (d ? cents(d) : 0) + (sd2 ? cents(sd2) : 0);
    for (const x of [d, sd2]) if (x) { const v = vec(x); for (let k = 0; k < 8; k++) cv[k] += v[k]; }
    for (const bn of bc) for (const pn of pc) {
      const cp = bn.pc + pn.pc + cpc;
      if (cp > budget) continue;
      const cn = cv.map((x, k) => x + bn.n[k] + pn.n[k]);
      for (const en of es) {
        if (cp + en.pr > budget) continue;
        for (let k = 0; k < 8; k++) n[k] = cn[k] + en.n[k];
        const sc = T.scoreVec(n, t, mode, p);
        if (sc >= thr) continue;
        let i = top.length;
        top.push(sc);
        while (i > 0 && top[i - 1] > sc) { top[i] = top[i - 1]; i--; }
        top[i] = sc;
        if (top.length > 30) top.pop();
        if (top.length === 30) thr = top[29];
      }
    }
  }
  return top;
}
// Exaktheits-Vergleiche ohne Zeitbudget (sonst hinge das Ergebnis von der Rechnergeschwindigkeit ab)
const rawTop = (menu, t, mode, p, o) => T.bowlCombos(menu, t, mode, p, Object.assign({ maxMs: Infinity }, o, { raw: true })).map(r => r.rawScore);
const sameTop = (a, b) => a.length === b.length && a.every((s, i) => Math.abs(s - b[i]) < 1e-9);
const rawT = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, raw: true });
check("opts.raw: Rangliste { key, rawScore, price } mit 30 Einträgen, aufsteigend, Keys eindeutig", rawT.length === 30 && rawT.every((x, i) => typeof x.key === "string" && typeof x.price === "number" && (i === 0 || rawT[i - 1].rawScore <= x.rawScore)) && new Set(rawT.map(x => x.key)).size === 30, true);
const oT = { cap: 3, maxExtras: 4 };
let exOkT = 0; const exTargets = [tgt(60, 70, 18), tgt(35, 130, 8), tgt(110, 40, 30), tgt(45, 90, 45), tgt(70, 20, 12, { fibMin: 5, sMax: 1 })];
for (const tt of exTargets) if (sameTop(rawTop(TMENU, tt, "macros", {}, oT), exhaustiveBowl(TMENU, tt, "macros", {}, oT))) exOkT++;
check("Makro-Modus: Top 30 = vollständige Durchrechnung (Test-Menü mit halber Portion + Rollen, 5 Ziele)", exOkT, exTargets.length);
let exKT = 0; const exKTargets = [[kcalT(450), { hp: true, lf: true }], [kcalT(700), { hc: true, lf: true }], [kcalT(900), { lc: true, hp: true }], [kcalT(350), { lp: true, hf: true }], [kcalT(520, { fibMin: 3, sMax: 1 }), { hp: true }], [kcalT(600), {}]];
for (const [tt, pp] of exKTargets) if (sameTop(rawTop(TMENU, tt, "calories", pp, oT), exhaustiveBowl(TMENU, tt, "calories", pp, oT))) exKT++;
check("Kalorien-Modus mit/ohne Präferenzen: Top 30 = vollständige Durchrechnung (Test-Menü, 6 Ziele)", exKT, exKTargets.length);
let exPT = 0; const exPTargets = [[tgt(60, 70, 18), "macros", {}, 8], [tgt(35, 130, 8), "macros", {}, 9.5], [tgt(110, 40, 30), "macros", {}, 11], [kcalT(700), "calories", { hp: true, lf: true }, 8.5], [kcalT(500), "calories", {}, 7]];
for (const [tt, md, pp, mp] of exPTargets) if (sameTop(rawTop(TMENU, tt, md, pp, { ...oT, maxPrice: mp }), exhaustiveBowl(TMENU, tt, md, pp, { ...oT, maxPrice: mp }))) exPT++;
check("Preislimit: Top 30 = vollständige Durchrechnung (Test-Menü, 5 Ziele, Makro + Kalorien)", exPT, exPTargets.length);
// Pflicht-Zutaten (User 16.09.2026): Extras fest, Einzelauswahl nur diese Zutat, Portionen-Rollen ≥1 (halbe zählt)
const hasIng = (r, ing) => r.items.some(x => x.ing === ing);
const rInc = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["lachs", "avo", "tzatziki"] });
check("Pflicht: Lachs (Protein), Avocado (Extra) und Tzatziki (Dip) in JEDER Bowl, Regeln bleiben erfüllt", rInc.length > 0 && rInc.every(r => hasIng(r, "lachs") && hasIng(r, "avo") && r.dip && r.dip.id === "tzatziki" && cnt(r, "base") >= 1 && cnt(r, "extra") <= 3), true);
check("Pflicht-Extra zählt zu maxExtras, geht aber vor (maxExtras 0 → genau die Pflicht-Extras)", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 0, include: ["ei", "mais"] }); return r.length > 0 && r.every(x => cnt(x, "extra") === 2 && hasIng(x, "ei") && hasIng(x, "mais")); })(), true);
check("Pflicht-Extra ohne Nährwerte (Pfeffer) ist trotzdem in jeder Bowl", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 2, include: ["pfeffer"] }); return r.length > 0 && r.every(x => hasIng(x, "pfeffer")); })(), true);
check("Pflicht-Base mit halber Portion: jede Bowl hat Reis (ganz oder halb), keine Doppel-Keys", (() => { const r = T.bowlCombos(TMENU, tgt(20, 60, 8), "macros", {}, { cap: 2, maxExtras: 1, include: ["reis"] }); return r.length > 0 && r.every(x => hasIng(x, "reis")) && new Set(r.map(x => x.key)).size === r.length && r.some(x => x.parts.some(pt => pt.opt.id === "reis_h")); })(), true);
check("Pflicht-Protein (Hähnchen) ersetzt das Duplikat unter Extras nicht (läuft über die Protein-Rolle)", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["huhn"] }); return r.length > 0 && r.every(x => x.parts.some(pt => pt.opt.id === "huhn") && x.items.every(y => y.id !== "huhn_x")); })(), true);
check("Pflicht nicht verfügbar (per keep ausgeschlossen / Schalentier / unbekannt) → [] mit missing", (() => { const a = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["avo"], keep: x => x.id !== "avo" }); const b = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["garnele"] }); const c = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["gibtsnicht"] }); return a.length === 0 && a.missing.join() === "avo" && b.missing.join() === "garnele" && c.missing.join() === "gibtsnicht"; })(), true);
check("zwei Pflicht-Dips → [] mit conflict", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["curry", "tzatziki"] }); return r.length === 0 && r.conflict.length === 2; })(), true);
check("Pflicht + Preislimit: Pflicht-Extras zählen zum Preis", (() => { const r = T.bowlCombos(TMENU, tB, "macros", {}, { cap: 2, maxExtras: 3, include: ["avo"], maxPrice: 9 }); return r.length > 0 && r.every(x => x.price <= 9 + 1e-9 && Math.abs(x.price - priceOf(TMENU, x)) < 1e-9); })(), true);
const incCases = [[tgt(60, 70, 18), "macros", {}, ["lachs"]], [tgt(35, 130, 8), "macros", {}, ["reis", "ei"]], [tgt(110, 40, 30), "macros", {}, ["curry", "nudeln"]], [kcalT(700), "calories", { hp: true, lf: true }, ["avo", "tofu"]], [kcalT(500), "calories", {}, ["tzatziki", "reis"]], [tgt(45, 90, 45), "macros", {}, ["huhn", "pfeffer", "mais"]], [kcalT(600), "calories", { lc: true }, ["salat", "bohnen"]]];
let exInc = 0;
for (const [tt, md, pp, inc] of incCases) if (sameTop(rawTop(TMENU, tt, md, pp, { ...oT, include: inc }), exhaustiveBowl(TMENU, tt, md, pp, { ...oT, include: inc }))) exInc++;
check("Pflicht-Zutaten: Top 30 = vollständige Durchrechnung (Test-Menü, Makro + Kalorien mit/ohne Präferenzen, 7 Fälle)", exInc, incCases.length);
let exIncP = 0;
for (const [tt, md, pp, inc, mp] of [[tgt(60, 70, 18), "macros", {}, ["lachs", "avo"], 11], [kcalT(650), "calories", { hp: true }, ["reis"], 9]]) if (sameTop(rawTop(TMENU, tt, md, pp, { ...oT, include: inc, maxPrice: mp }), exhaustiveBowl(TMENU, tt, md, pp, { ...oT, include: inc, maxPrice: mp }))) exIncP++;
check("Pflicht-Zutaten + Preislimit: Top 30 = vollständige Durchrechnung (2 Fälle)", exIncP, 2);

// Menü ohne Basis-Pflicht, mit festem Bestandteil, Brot (side) und Varianten (2 Portionen Dressing / Brot) — Muster Dean & David
const TSAL = { item: "Test Salad", basePrice: 7.25, require: { base: false, protein: true },
  fixed: [opt("blatt", "fixed", 2.8, 1.4, 0.3, { price: 0 })],
  groups: [
    { id: "dressing", name: "Dressing", min: 1, max: 1, none: "ohne Dressing", options: [opt("caesar", "dressing", 5.4, 1.2, 23.2, { role: "dip", price: 0 }), opt("caesar2", "dressing", 10.8, 2.4, 46.4, { role: "dip", ing: "caesar", variant: true, price: 0.8, orderName: "caesar", order: [{ group: "extra", name: "Extra Dressing/Sauce" }] }), opt("tahini", "dressing", 6.1, 3.4, 15.5, { role: "dip", price: 0 }), opt("tahini2", "dressing", 12.2, 6.8, 31, { role: "dip", ing: "tahini", variant: true, price: 0.8, orderName: "tahini", order: [{ group: "extra", name: "Extra Dressing/Sauce" }] })] },
    { id: "brot", name: "Brot", min: 0, max: 3, none: "ohne Brot", options: [opt("brot", "brot", 11.5, 2.1, 1.4, { role: "side", price: 0 }), opt("brot2", "brot", 23, 4.2, 2.8, { role: "side", ing: "brot", variant: true, price: 0.3, orderName: "brot", order: [{ group: "extra", name: "extra Brot" }] })] },
    { id: "extra", name: "Extra Brot/Dressing", min: 0, max: 999, none: null, options: [] },
    { id: "extras", name: "Extras", min: 0, max: 999, none: null, options: [opt("chicken", "extras", 2.4, 15.2, 3.8, { role: "protein", maxQty: 999, price: 3.75 }), opt("lachs2", "extras", 1.2, 12.7, 5.9, { role: "protein", maxQty: 999, price: 4.25 }), opt("halloumi", "extras", 1.9, 19.5, 23.1, { role: "protein", maxQty: 999, price: 3.75 }), opt("avocado", "extras", 0.9, 0.4, 3.1, { role: "extra", maxQty: 999, price: 2.25 }), opt("ei2", "extras", 0.2, 5.3, 4.5, { role: "extra", maxQty: 999, price: 1.25 }), opt("croutons", "extras", 9.8, 1.8, 1.5, { role: "extra", maxQty: 999, price: 1.25 }), opt("kartoffeln", "extras", 18.3, 2.3, 5.3, { role: "extra", maxQty: 999, price: 3.75 }), opt("gurke", "extras", 0.5, 0.2, 0.1, { role: "extra", maxQty: 999, price: 1.25 }), opt("gewuerz", "extras", 0, 0, 0, { role: "extra", maxQty: 999, price: 0 })] },
  ] };
const TBOWL = { ...TSAL, item: "Test Bowl bar", require: { base: true, protein: true }, groups: [{ id: "basis", name: "Basis", min: 1, max: 1, none: null, options: [opt("jasmin", "basis", 74, 6.5, 0.6, { role: "base", price: 0 }), opt("quinoa", "basis", 46.4, 6.4, 3, { role: "base", price: 0 })] }, ...TSAL.groups] };
const tSal = tgt(45, 40, 25), oS = { cap: 2, maxExtras: 3 };
const rSal = T.bowlCombos(TSAL, tSal, "macros", {}, oS);
check("require base:false → Bowls ohne Basis erlaubt, ≥1 Protein bleibt Pflicht", rSal.length > 0 && rSal.every(r => cnt(r, "base") === 0 && cnt(r, "protein") >= 1), true);
check("fester Bestandteil (Blattsalat) in jeder Bowl: items + Nährwerte, kein Aufpreis", rSal.every(r => r.fixed.length === 1 && r.items[0].id === "blatt" && JSON.stringify(r.nutrition) === JSON.stringify(T.sumN(r.items, 1)) && Math.abs(r.price - (7.25 + r.parts.reduce((a, pt) => a + pt.opt.price * pt.qty, 0) + (r.dip ? r.dip.price : 0) + (r.side ? r.side.price : 0))) < 1e-9), true);
check("Einzelauswahl: höchstens ein Dressing (auch als 2-Portionen-Variante) und höchstens ein Brot", rSal.every(r => r.items.filter(x => T.bowlRole(x) === "dip").length <= 1 && r.items.filter(x => T.bowlRole(x) === "side").length <= 1), true);
check("Brot-Variante (2 Scheiben, +0,30 €) und Dressing-Variante (+0,80 €) werden gewählt, wenn sie passen", (() => { const tt = tgt(1.4 + 4.2 + 15.2 + 2.4, 2.8 + 23 + 2.4 + 10.8, 0.3 + 2.8 + 3.8 + 46.4); const r0 = T.bowlCombos(TSAL, tt, "macros", {}, oS)[0]; return r0.rawScore < 1e-9 && r0.side.id === "brot2" && r0.dip.id === "caesar2" && Math.abs(r0.price - (7.25 + 3.75 + 0.3 + 0.8)) < 1e-9; })(), true);
check("Key enthält Brot und Dressing; Keys eindeutig", rSal.every(r => (r.side ? r.key.includes("|" + r.side.id + "|") : true)) && new Set(rSal.map(r => r.key)).size === rSal.length, true);
check("Zusammenfassung: Teile, dann Brot, dann Dressing (Kurznamen)", (() => { const r = { parts: [{ opt: { short: "Chicken" }, qty: 2 }], side: { short: "2× Landbrot" }, dip: { short: "Caesar" } }; return T.bowlSummary(r) === "2× Chicken + 2× Landbrot + Caesar"; })(), true);
check("Order Guide: Varianten → Name in der eigenen Gruppe + „Extra …“ in der Bestellschritt-Gruppe; „ohne …“ bei leerer Einzelauswahl; Stepper-Extras mit Menge", (() => {
  const X = id => TSAL.groups.flatMap(g => g.options).find(o => o.id === id);
  const st1 = T.bowlOrderSteps(TSAL, { parts: [{ opt: X("chicken"), qty: 2 }, { opt: X("avocado"), qty: 1 }], side: X("brot2"), dip: X("caesar2") });
  const st2 = T.bowlOrderSteps(TSAL, { parts: [{ opt: X("chicken"), qty: 1 }], side: null, dip: null });
  const v = (st, l) => (st.find(x => x.l === l) || {}).v;
  return v(st1, "Dressing") === "caesar" && v(st1, "Brot") === "brot" && v(st1, "Extra Brot/Dressing") === "extra Brot · Extra Dressing/Sauce" && v(st1, "Extras") === "2× chicken · 1× avocado"
    && v(st2, "Dressing") === "ohne Dressing" && v(st2, "Brot") === "ohne Brot" && v(st2, "Extra Brot/Dressing") === undefined;
})(), true);
check("Pflicht bei Varianten: Dressing Tahini → jede Bowl hat Tahini (1 oder 2 Portionen); Brot → jede Bowl hat Brot", (() => { const r = T.bowlCombos(TSAL, tSal, "macros", {}, { ...oS, include: ["tahini", "brot"] }); return r.length > 0 && r.every(x => x.dip && x.dip.ing === "tahini" && x.side && x.side.ing === "brot") && r.some(x => x.dip.id === "tahini2" || x.side.id === "brot2"); })(), true);
check("Basis-Pflicht im Bowl-Menü: genau eine Basis (Gruppe max 1)", (() => { const r = T.bowlCombos(TBOWL, tgt(50, 110, 25), "macros", {}, oS); return r.length > 0 && r.every(x => cnt(x, "base") === 1); })(), true);
let exSal = 0;
const salCases = [[TSAL, tSal, "macros", {}, oS], [TSAL, tgt(70, 25, 40), "macros", {}, { cap: 3, maxExtras: 4 }], [TSAL, kcalT(600), "calories", { hp: true, lf: true }, oS], [TSAL, kcalT(450), "calories", {}, oS], [TBOWL, tgt(50, 110, 25), "macros", {}, oS], [TBOWL, kcalT(800), "calories", { hc: true }, oS],
  [TSAL, tSal, "macros", {}, { ...oS, include: ["halloumi", "avocado"] }], [TSAL, kcalT(650), "calories", { hp: true }, { ...oS, include: ["caesar", "gewuerz"] }], [TBOWL, tgt(60, 90, 20), "macros", {}, { ...oS, include: ["quinoa", "brot", "lachs2"] }], [TSAL, tSal, "macros", {}, { ...oS, maxPrice: 14 }], [TBOWL, tgt(60, 90, 20), "macros", {}, { ...oS, include: ["ei2"], maxPrice: 16 }]];
for (const [mn, tt, md, pp, oo] of salCases) if (sameTop(rawTop(mn, tt, md, pp, oo), exhaustiveBowl(mn, tt, md, pp, oo))) exSal++;
check("Salat-/Bowl-Muster (fester Bestandteil, Brot, Varianten, ohne Basis-Pflicht): Top 30 = vollständige Durchrechnung (11 Fälle inkl. Pflicht + Preislimit)", exSal, salCases.length);
check("bowlValidate: Test-Salat gültig; meldet Variante ohne Grundoption und Bestellschritt mit unbekannter Gruppe", (() => {
  const data = { ingredients: ["blatt", "caesar", "tahini", "brot", "chicken", "lachs2", "halloumi", "avocado", "ei2", "croutons", "kartoffeln", "gurke", "gewuerz"].map(id => ({ id, name: id, per100: { kcal: 1, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0 } })), salad: TSAL };
  const okV = T.bowlValidate(data, ["salad"]).length === 0;
  const bad = JSON.parse(JSON.stringify(data));
  bad.salad.groups[0].options = bad.salad.groups[0].options.filter(o => o.id !== "tahini");
  bad.salad.groups[1].options[1].order[0].group = "gibtsnicht";
  const P = T.bowlValidate(bad, ["salad"]);
  return okV && P.some(x => /Variante ohne Grundoption/.test(x)) && P.some(x => /Bestellschritt ohne gültige Gruppe/.test(x));
})(), true);
check("bowlIncludables: je Zutat einmal mit Rolle, ohne Varianten, ohne Wolt-Duplikat, ohne Schalentier/Gesperrtes", (() => {
  const a = T.bowlIncludables(TSAL, new Set(["croutons"])); const b = T.bowlIncludables(TMENU, null);
  return a.map(x => x.id).join() === "caesar,tahini,brot,chicken,lachs2,halloumi,avocado,ei2,kartoffeln,gurke,gewuerz" && a.find(x => x.id === "caesar").role === "dip" && a.find(x => x.id === "brot").role === "side"
    && b.filter(x => x.id === "huhn").length === 1 && b.find(x => x.id === "huhn").role === "protein" && !b.some(x => x.id === "garnele") && b.find(x => x.id === "reis").name === "reis";
})(), true);
check("addInclude: keine Doppelten; ein neuer Dip ersetzt den alten, Extras/Proteine bleiben", (() => { const inc = T.bowlIncludables(TSAL, null); const l1 = T.addInclude(["caesar", "avocado"], "tahini", inc); const l2 = T.addInclude(l1, "avocado", inc); const l3 = T.addInclude(l2, "brot", inc); return l1.join() === "avocado,tahini" && l2.join() === "tahini,avocado" && l3.join() === "tahini,avocado,brot"; })(), true);

// Muster Subway: Sub (protein, genau 1, Variante „Extra Fleisch“), Brot (base, genau 1), Käse (side), Extras (Extras-Chip), Veggies (own + pick),
// Saucen (own, max 2; Sub s_pb laut groupMax nur 1 — gilt in subwayCombos), Seasonings (own); proteinExtras + pickRoles
const TSUB = { item: "Test Sub", basePrice: 0, require: { base: true, protein: true }, proteinExtras: true, pickRoles: ["side", "extra"], groups: [
  { id: "sub", name: "Create Your Own", min: 1, max: 1, none: null, options: [
    opt("s_huhn", "sub", 4, 13, 1.3, { role: "protein", price: 8.99, sizeName: "s_huhn - 15-CM", none: { kaese: "ohne Käse" } }),
    opt("s_ham", "sub", 0.7, 5.4, 1, { role: "protein", ing: "ham", price: 7.59, sizeName: "s_ham - 15-CM" }),
    opt("s_pb", "sub", 8.1, 10, 2.3, { role: "protein", price: 8.99, groupMax: { saucen: 1 }, sizeName: "s_pb - 15-CM" }),
    opt("s_veg", "sub", 0, 0, 0, { role: "protein", price: 6.49, sizeName: "s_veg - 15-CM" }),
    opt("s_huhn2", "sub", 8, 26, 2.6, { role: "protein", ing: "s_huhn", variant: true, price: 11.18, orderName: "s_huhn", order: [{ group: "extras", name: "Extra Fleisch / Protein" }] }),
    opt("s_ham2", "sub", 1.4, 10.8, 2, { role: "protein", ing: "ham", variant: true, price: 9.78, orderName: "s_ham", order: [{ group: "extras", name: "Extra Fleisch / Protein" }] }),
  ] },
  { id: "brot", name: "Brot", min: 1, max: 1, none: null, options: [opt("italian", "brot", 36, 7, 2.1, { role: "base", price: 0 }), opt("oat", "brot", 41, 9.5, 2.6, { role: "base", price: 0 }), opt("gf", "brot", 53, 3.3, 6.6, { role: "base", price: 1.49 })] },
  { id: "zubereitung", name: "Zubereitungsart", min: 1, max: 1, none: null, choices: ["Getoastet", "Ungetoastet"], options: [] },
  { id: "kaese", name: "Käse", min: 0, max: 1, none: "ohne Käse", options: [opt("scheibe", "kaese", 0.4, 2.3, 3.5, { role: "side", price: 0 }), opt("cheddar", "kaese", 0, 2.8, 3.8, { role: "side", price: 0 })] },
  { id: "extras", name: "Extras", min: 0, max: 15, none: null, options: [opt("bacon", "extras", 0.2, 3, 2.8, { role: "extra", price: 1.49 }), opt("ham_x", "extras", 0.7, 5.4, 1, { role: "extra", ing: "ham", price: 1.49 }), opt("tuna", "extras", 2.5, 12, 10, { role: "extra", price: 1.49 }), opt("frisch", "extras", 0.5, 1.2, 2.2, { role: "extra", price: 0.89, sauce: true })] },
  { id: "veggies", name: "Veggies", min: 1, max: 14, none: "ohne Veggies", own: true, options: [opt("tomate", "veggies", 0.8, 0.3, 0.1, { role: "extra", pick: true, price: 0 }), opt("mais", "veggies", 0.8, 0.2, 0.1, { role: "extra", pick: true, price: 0 }), opt("jala", "veggies", 0.1, 0, 0, { role: "extra", pick: true, price: 0 })] },
  { id: "saucen", name: "Saucen", min: 0, max: 2, none: "ohne Saucen", own: true, options: [opt("chipotle", "saucen", 1.3, 0.1, 6.3, { role: "extra", price: 0 }), opt("onion", "saucen", 5.6, 0.1, 0.1, { role: "extra", price: 0 }), opt("mayo", "saucen", 0.6, 0, 4.9, { role: "extra", price: 0 }), opt("balsamico", "saucen", 0, 0, 0, { role: "extra", price: 0, kcal: 1 })] },
  { id: "seasonings", name: "Seasonings", min: 0, max: 3, none: null, own: true, options: [opt("roest", "seasonings", 2.9, 0.4, 3, { role: "extra", price: 0 })] },
] };
const tSub = tgt(45, 90, 25), oSub = { cap: 1, maxExtras: 3 };
const inG = (r, gid) => r.parts.filter(pt => pt.opt.group === gid).length;
const rSub = T.bowlCombos(TSUB, tSub, "macros", {}, oSub);
check("Muster Subway: genau 1 Sub + 1 Brot, Käse ≤ 1, Saucen ≤ 2 (eigene Grenze), Extras ≤ 3, ohne Pflicht nie Veggies (pick)", rSub.length > 0 && rSub.every(r => cnt(r, "protein") === 1 && cnt(r, "base") === 1 && (r.side ? 1 : 0) <= 1 && inG(r, "saucen") <= 2 && inG(r, "extras") <= 3 && inG(r, "veggies") === 0), true);
check("eigene Grenze zählt nicht zum Extras-Chip: maxExtras 0 → keine Extras, Saucen trotzdem (Fett-Ziel)", (() => { const r = T.bowlCombos(TSUB, tgt(20, 50, 30), "macros", {}, { cap: 1, maxExtras: 0 }); return r.length > 0 && r.every(x => inG(x, "extras") === 0) && r.some(x => inG(x, "saucen") > 0); })(), true);
check("pick: Veggies nur als Pflicht-Zutat — dann in jeder Bestellung, ohne Extras-Chip zu belasten", (() => { const r = T.bowlCombos(TSUB, tSub, "macros", {}, { cap: 1, maxExtras: 0, include: ["tomate", "mais"] }); return r.length > 0 && r.every(x => hasIng(x, "tomate") && hasIng(x, "mais") && !hasIng(x, "jala") && inG(x, "extras") === 0); })(), true);
check("proteinExtras: Ham als Extra auf einem anderen Sub (exakter Treffer s_huhn + italian + ham_x)", (() => { const r0 = T.bowlCombos(TSUB, tgt(13 + 7 + 5.4, 4 + 36 + 0.7, 1.3 + 2.1 + 1), "macros", {}, oSub)[0]; return r0.rawScore < 1e-9 && r0.parts.some(pt => pt.opt.id === "ham_x") && r0.parts.some(pt => pt.opt.id === "s_huhn"); })(), true);
check("pickRoles: Pflicht „ham“ = das Extra, nicht das Sub; Brot/Sub nicht als Pflicht wählbar", (() => { const r = T.bowlCombos(TSUB, tSub, "macros", {}, { ...oSub, include: ["ham"] }); const inc = T.bowlIncludables(TSUB, null); return r.length > 0 && r.every(x => x.parts.some(pt => pt.opt.id === "ham_x")) && r.some(x => !x.parts.some(pt => T.bowlRole(pt.opt) === "protein" && pt.opt.ing === "ham")) && !inc.some(x => ["base", "protein"].includes(x.role)) && inc.find(x => x.id === "ham").role === "extra" && inc.some(x => x.id === "tomate"); })(), true);
check("mehr Pflicht-Saucen als die eigene Grenze (3 bei max 2) → [] mit conflict", (() => { const r = T.bowlCombos(TSUB, tSub, "macros", {}, { ...oSub, include: ["chipotle", "onion", "mayo"] }); return r.length === 0 && r.conflict.length === 3; })(), true);
check("wirkungslose Extras: Balsamico (nur 1 kcal) im Makro-Modus nie, im Kalorien-Modus als exakter Treffer; bowlScoreKeys", (() => {
  const a = T.bowlCombos(TSUB, tgt(30, 60, 10), "macros", {}, oSub).every(r => !hasIng(r, "balsamico"));
  const r0 = T.bowlCombos(TSUB, kcalT(4 * 36 + 4 * 7 + 9 * 2.1 + 1), "calories", {}, { cap: 1, maxExtras: 0, keep: x => ["s_veg", "italian", "balsamico"].includes(x.id) })[0];
  const k1 = T.bowlScoreKeys(tgt(30, 60, 0), "macros", {}).join(), k2 = T.bowlScoreKeys(kcalT(500, { sMax: 2 }), "calories", { hp: true }).join();
  return a && r0.rawScore < 1e-9 && hasIng(r0, "balsamico") && k1 === "false,false,false,true,false,false,true,false" && k2 === "true,false,false,false,false,false,true,true";
})(), true);
check("bowlIndex mit Klassen: Punktzahl = Π Σ C(n,k), jede Teilmenge einmal, Grenzen je Klasse eingehalten", (() => {
  const mk = (id, ci) => ({ opt: { id: "bi_" + id }, pc: 0, ci, v: [1, 0, 0, 0, 0, 0, 0, 0] });
  const ex = [mk("a", 0), mk("b", 0), mk("c", 1), mk("d", 1), mk("e", 1), mk("f", 2)];
  const idx = T.bowlIndex(ex, [1, 2, 1]), masks = Array.from(idx.M.slice(0, idx.N));
  const ok = masks.every(mask => { const c = [0, 0, 0]; ex.forEach((e, j) => { if ((mask >>> j) & 1) c[e.ci]++; }); return c[0] <= 1 && c[1] <= 2 && c[2] <= 1; });
  return idx.N === 3 * 7 * 2 && new Set(masks).size === idx.N && ok && T.bowlIndex(ex.map(e => ({ ...e, ci: 0 })), 2).N === 1 + 6 + 15;
})(), true);
check("Bestellschritte: „Extra …“-Einträge zuerst, keine Menge bei Gruppen mit max 1, leere Pflicht-/Einzelauswahl-Gruppe → „ohne …“", (() => {
  const X = id => TSUB.groups.flatMap(g => g.options).find(o => o.id === id);
  const st1 = T.bowlOrderSteps(TSUB, { parts: [{ opt: X("italian"), qty: 1 }, { opt: X("s_huhn2"), qty: 1 }, { opt: X("bacon"), qty: 1 }], side: null, dip: null });
  const v = l => (st1.find(x => x.l === l) || {}).v;
  return v("Brot") === "italian" && v("Create Your Own") === "s_huhn" && v("Extras") === "Extra Fleisch / Protein · bacon" && v("Veggies") === "ohne Veggies" && v("Käse") === "ohne Käse" && v("Saucen") === undefined && v("Zubereitungsart") === undefined;
})(), true);
check("bowlValidate: Muster Subway gültig (own-Gruppen mit max < 6 erlaubt); meldet pick außerhalb von Extras und ungültige pickRoles", (() => {
  const data = { ingredients: [...new Set(TSUB.groups.flatMap(g => g.options.map(o => o.ing)))].map(id => ({ id, name: id, per100: { kcal: 1, fat: 0, sat: 0, carbs: 0, sugars: 0, fibre: 0, protein: 0, salt: 0 } })), sub: TSUB };
  const P0 = T.bowlValidate(data, ["sub"]);
  const bad = JSON.parse(JSON.stringify(data));
  bad.sub.groups[1].options[0].pick = true; bad.sub.pickRoles = ["side", "gibtsnicht"];
  const P = T.bowlValidate(bad, ["sub"]);
  return P0.length === 0 && P.some(x => /pick nur bei Extras/.test(x)) && P.some(x => /pickRoles ungültig/.test(x));
})(), true);
const subCases = [[tSub, "macros", {}, oSub], [tgt(70, 60, 30), "macros", {}, { cap: 1, maxExtras: 2 }], [kcalT(650), "calories", { hp: true, lf: true }, oSub], [kcalT(450), "calories", {}, oSub],
  [tgt(30, 80, 20), "macros", {}, { ...oSub, include: ["tomate", "chipotle"] }], [kcalT(700), "calories", { hc: true }, { cap: 1, maxExtras: 2, include: ["ham", "scheibe"] }],
  [tgt(50, 70, 20, { fibMin: 3 }), "macros", {}, { ...oSub, maxPrice: 12 }], [tgt(40, 60, 15), "macros", {}, { cap: 1, maxExtras: 1, keep: x => x.id !== "onion" }]];
let exSub = 0;
for (const [tt, md, pp, oo] of subCases) if (sameTop(rawTop(TSUB, tt, md, pp, oo), exhaustiveBowl(TSUB, tt, md, pp, oo))) exSub++;
check("Muster Subway: Top 30 = vollständige Durchrechnung (eigene Grenzen, pick, proteinExtras, pickRoles, Pflicht, Preislimit; 8 Fälle)", exSub, subCases.length);
// Referenz für subwayCombos: jedes Sub einzeln vollständig durchrechnen (Wolt-Grenzen des Subs, gleichnamiges Extra entfällt) und Ranglisten mischen
function exhaustiveSubway(menu, t, mode, p, o) {
  const role = x => x.role || x.group;
  const extraIngs = new Set(menu.groups.flatMap(g => g.options.filter(x => role(x) === "extra").map(x => x.ing)));
  let top = [];
  for (const sub of menu.groups.find(g => g.id === "sub").options) {
    if (sub.variant || (o.keep && !o.keep(sub))) continue;
    const m = { ...menu, groups: menu.groups.map(g => sub.groupMax && sub.groupMax[g.id] != null ? { ...g, max: sub.groupMax[g.id] } : g) };
    const keep = x => (role(x) !== "protein" || x.ing === sub.ing) && !(extraIngs.has(sub.ing) && role(x) === "extra" && x.ing === sub.ing) && (!o.keep || o.keep(x));
    top = top.concat(exhaustiveBowl(m, t, mode, p, { ...o, keep }));
  }
  return top.sort((a, b) => a - b).slice(0, 30);
}
const subRaw = (menu, tt, md, pp, oo) => T.subwayCombos(menu, tt, md, pp, Object.assign({ maxMs: Infinity }, oo, { raw: true })).map(r => r.rawScore);
const swCases = [[tSub, "macros", {}, oSub], [tgt(60, 70, 35), "macros", {}, { cap: 1, maxExtras: 2 }], [kcalT(700), "calories", { hp: true }, { ...oSub, include: ["ham"] }], [kcalT(500), "calories", {}, { ...oSub, include: ["tomate"] }], [tgt(35, 75, 30), "macros", {}, { ...oSub, maxPrice: 11 }]];
let exSW = 0;
for (const [tt, md, pp, oo] of swCases) if (sameTop(subRaw(TSUB, tt, md, pp, oo), exhaustiveSubway(TSUB, tt, md, pp, oo))) exSW++;
check("subwayCombos (Muster): Top 30 = Durchrechnung je Sub (Sub-Grenzen, gleichnamiges Extra entfällt; 5 Fälle)", exSW, swCases.length);
check("subwayCombos: nie Sub + gleichnamiges Extra; Sub mit groupMax saucen 1 höchstens 1 Sauce, andere bis 2; Ergebnisse tragen size", (() => {
check("bowlDedupe: gleiche Zutaten + Werte in anderer Anordnung → nur die günstigste (Position der ersten); andere Werte bleiben getrennt", (() => {
  const o = (id, ing, kcal, extra) => Object.assign({ id, ing, kcal, fat: 1, sat: 0, carbs: 2, sugars: 0, fibre: 0, protein: 3, salt: 0 }, extra || {});
  const mk = (parts, price, extra) => Object.assign({ parts: parts.map(p => ({ opt: p, qty: 1 })), side: null, dip: null, fixed: [], price, nutrition: { kcal: 1 } }, extra || {});
  const a = mk([o("cup_chicken", "chicken", 100), o("x_beef", "beef", 150)], 21.97), b = mk([o("cup_beef", "beef", 150), o("x_chicken", "chicken", 100)], 19.47), c = mk([o("cup_beef", "beef", 150), o("x_chicken2", "chicken", 101)], 10);
  const d = mk([o("cup_chicken", "chicken", 100), o("x_beef", "beef", 150)], 21.97, { type: "salat" });
  const out = T.bowlDedupe([a, b, c, d]);
  return out.length === 3 && out[0] === b && out[1] === c && out[2] === d && T.bowlSameKey(a) === T.bowlSameKey(b) && T.bowlSameKey(a) !== T.bowlSameKey(c);
})(), true);
check("bowlValidate: Zutaten mit valuesOnOptions brauchen keine per100-Werte", (() => { const data = { ingredients: [...new Set(TSUB.groups.flatMap(g => g.options.map(o => o.ing)))].map(id => ({ id, name: id, valuesOnOptions: true })), sub: TSUB }; const bad = { ingredients: data.ingredients.map(({ valuesOnOptions, ...x }) => x), sub: TSUB }; return T.bowlValidate(data, ["sub"]).length === 0 && T.bowlValidate(bad, ["sub"]).some(p => /per100/.test(p)); })(), true);
  const r = T.subwayCombos(TSUB, tgt(30, 60, 45), "macros", {}, { cap: 1, maxExtras: 3 }), rp = T.subwayCombos(TSUB, tgt(30, 60, 45), "macros", {}, { cap: 1, maxExtras: 3, keep: x => T.bowlRole(x) !== "protein" || x.ing === "s_pb" });
  const TS2 = { ...TSUB, size: "15-CM" };
  return r.length > 0 && r.every(x => !(x.parts.some(pt => pt.opt.id === "s_ham" || pt.opt.id === "s_ham2") && x.parts.some(pt => pt.opt.id === "ham_x"))) && r.some(x => inG(x, "saucen") === 2)
    && rp.length > 0 && rp.every(x => inG(x, "saucen") <= 1) && T.subwayCombos(TS2, tSub, "macros", {}, oSub).every(x => x.size === "15-CM");
})(), true);

// ── Compleat: Daten ──
sect("Compleat: Daten (Shop + Wolt + Uber Eats)");
const CR = T.RESTO_BY_KEY.compleat, CU = T.RESTO_BY_KEY.compleatuber;
const rawC = U.readJSON(__dirname + "/data/compleat-raw.json");
const updC = require("./compleat-update.js");
const W = T.COMPLEAT.wolt, WG = Object.fromEntries(W.groups.map(g => [g.id, g]));
const wopt = id => W.groups.flatMap(g => g.options).find(o => o.id === id);
const UE = T.COMPLEAT.ubereats, UG = Object.fromEntries(UE.groups.map(g => [g.id, g]));
const ueAll = UE.groups.flatMap(g => g.options);
const uopt = name => ueAll.find(o => o.name === name);
check("Registry: Compleat (Wolt) + Compleat (Uber Eats) — BYO, accurate, eigenes Menü, gemeinsame Ausschluss-Liste", !!CR && !!CU && CR.kind === "byo" && CU.kind === "byo" && CR.platform === "Wolt" && CU.platform === "Uber Eats" && CR.accurate === true && CU.accurate === true && CR.menu === W && CU.menu === UE && CR.exclusionKey === "compleat" && CU.exclusionKey === "compleat" && CR.name === "Compleat (Wolt)" && CU.name === "Compleat (Uber Eats)", true);
check("COMPLEAT-Block = compleat-update.js(data/compleat-raw.json) — Wolt + Uber Eats (Block aktuell)", (() => { const bw = updC.buildMenu(rawC, "wolt"), bu = updC.buildMenu(rawC, "ubereats"); return JSON.stringify(W.groups) === JSON.stringify(bw.groups) && JSON.stringify(UE.groups) === JSON.stringify(bu.groups) && W.basePrice === bw.basePrice && UE.basePrice === bu.basePrice && W.item === bw.item && UE.item === bu.item && JSON.stringify(W.preselected || []) === JSON.stringify(bw.preselected) && JSON.stringify(UE.preselected || []) === JSON.stringify(bu.preselected); })(), true);
check("Datensatz vollständig: alle Shop-Zutaten im Block (auch nicht bei Wolt)", T.COMPLEAT.ingredients.length === rawC.ingredients.length && T.COMPLEAT.ingredients.some(x => x.id === "suesskartoffel") && T.COMPLEAT.ingredients.some(x => x.id === "gemuesemix"), true);
const valC = T.bowlValidate(T.COMPLEAT);
if (valC.length) console.log(valC.join("\n"));
check("bowlValidate(COMPLEAT) ohne Probleme (beide Menüs)", valC.length, 0);
check("bowlValidate erkennt Fehler (Preis fehlt, Kern-Rolle in zwei Gruppen)", (() => { const bad = JSON.parse(JSON.stringify(T.COMPLEAT)); delete bad.ubereats.groups[0].options[0].price; bad.ubereats.groups[2].options.push({ ...bad.ubereats.groups[0].options[1], id: "x_dup", group: bad.ubereats.groups[2].id }); const P = T.bowlValidate(bad, ["ubereats"]); return P.some(x => /price fehlt/.test(x)) && P.some(x => /Rolle base steht in mehreren Gruppen/.test(x)); })(), true);
// Wolt
check("Wolt-Gruppen: Basis 3 (ohne Quinoa) · Proteine 5 · Extras 25 · Dips 13 + „Ohne Dip“", WG.base.options.length === 3 && WG.protein.options.length === 5 && WG.extra.options.length === 25 && WG.dip.options.length === 13 && WG.dip.none === "Ohne Dip", true);
check("Wolt-Grenzen: Basis 0–5 · Proteine 0–10 · Extras 0–30 · Dip genau 1", WG.base.max === 5 && WG.protein.max === 10 && WG.extra.max === 30 && WG.dip.min === 1 && WG.dip.max === 1, true);
check("Wolt-Mengen: Basmatireis/Salat-Mix bis 4×, Protein Nudeln 1×, Hähnchen bis 10×, Pulled Salmon 1×, Extras 1×", wopt("base_basmatireis_250_g").maxQty === 4 && wopt("base_salat_mix_100_g").maxQty === 4 && wopt("base_protein_nudeln_200_g").maxQty === 1 && wopt("protein_haehnchen_100_g").maxQty === 10 && wopt("protein_pulled_salmon_100_g").maxQty === 1 && WG.extra.options.every(o => o.maxQty === 1), true);
check("Wolt: Grundpreis 2 €, jede Option mit Preis, Rolle = Gruppe", W.basePrice === 2 && W.item === "Build your Bowl" && W.groups.every(g => g.options.every(o => typeof o.price === "number" && o.role === g.id)), true);
// Wolt zeigt auf der Menükarte 4 €: Grundpreis 2 € + im Pflicht-Dip vorausgewählter „Curvy Curry Dip“ 2 € (User-Rückfrage 16.09.2026,
// im Wolt-Web-UI geprüft: Button 4,00 € → nach Klick auf „Ohne Dip“ 2,00 €). Der Rechner rechnet Grundpreis + gewählte Optionen.
check("Wolt: Menükarte 4 € = Grundpreis 2 € + vorausgewählter „Curvy Curry Dip“ (2 €)", (() => { const p = W.preselected || []; return p.length === 1 && p[0].group === "dip" && p[0].name === "Curvy Curry Dip" && p[0].price === 2 && W.basePrice + p[0].price === 4 && rawC.wolt.cardPrice === 4 && rawC.wolt.itemPrice === 2 && WG.dip.options.some(o => o.name === "Curvy Curry Dip" && o.price === 2); })(), true);
check("bowlPreselectNote (Wolt): nennt Kartenpreis, Vorauswahl und „Ohne Dip“", (() => { const n = T.bowlPreselectNote(W, "Wolt"); return n.includes("Wolt shows €4.00") && n.includes("Curvy Curry Dip €2.00") && n.includes("Ohne Dip"); })(), true);
check("bowlPreselectNote (Uber Eats): keine Vorauswahl → kein Hinweis", T.bowlPreselectNote(UE, "Uber Eats") === "" && !(UE.preselected && UE.preselected.length) && rawC.ubereats.cardPrice === rawC.ubereats.itemPrice, true);
check("Hinweistext beider Compleat-Tabs bindet bowlPreselectNote ein", (SCRIPT.match(/bowlPreselectNote\(m,/g) || []).length === 2, true);
check("bowlValidate meldet Vorauswahl auf unbekannte Gruppe", (() => { const bad = JSON.parse(JSON.stringify(T.COMPLEAT)); bad.wolt.preselected = [{ group: "gibtsnicht", name: "X", price: 1 }]; return T.bowlValidate(bad, ["wolt"]).some(x => /preselected: unbekannte Gruppe/.test(x)); })(), true);
check("Wolt-Preise: Basmatireis 2,50 € · Hähnchen 3,00 € · Pulled Salmon 4,00 €", wopt("base_basmatireis_250_g").price === 2.5 && wopt("protein_haehnchen_100_g").price === 3 && wopt("protein_pulled_salmon_100_g").price === 4, true);
check("Salat-Mix: Wolt 100 g statt Shop 80 g → pro-100-g-Werte (17 kcal)", wopt("base_salat_mix_100_g").amount === 100 && wopt("base_salat_mix_100_g").kcal === 17 && T.COMPLEAT.ingredients.find(x => x.id === "salatmix").portion === 80, true);
check("Basmatireis 250 g: 330 kcal · 70 g KH · 7,5 g P", wopt("base_basmatireis_250_g").kcal === 330 && wopt("base_basmatireis_250_g").carbs === 70 && wopt("base_basmatireis_250_g").protein === 7.5, true);
check("Walnusskerne 20 g: 140,8 kcal (Shop zeigt fälschlich 7 kcal)", wopt("extra_walnusskerne_20_g").kcal, 140.8);
check("Röstzwiebeln 20 g: 118 kcal (Shop rechnet mit 18 g)", wopt("extra_roestzwiebeln_20_g").kcal, 118);
check("Granatapfelkerne 15 g: 11,1 kcal (Shop rechnet mit 20 g)", wopt("extra_granatapfelkerne_15_g").kcal, 11.1);
check("Sojasoße 20 ml: Salz 2,87 g (Shop rechnet mit 40 ml)", wopt("dip_sojasosse_20ml").salt, 2.87);
check("Hart gekochtes Ei 50 g (neu bei Wolt): offizielle Shop-Werte 77,5 kcal / 6,55 g P", wopt("extra_hart_gekochtes_ei_50_g").kcal === 77.5 && wopt("extra_hart_gekochtes_ei_50_g").protein === 6.55, true);
check("Portionswerte = pro 100 g × Menge / 100 (alle Wolt-Optionen)", W.groups.flatMap(g => g.options).every(o => { const ing = T.COMPLEAT.ingredients.find(x => x.id === o.ing); return T.KEYS.every(k => Math.abs(o[k] - Math.round(ing.per100[k] * o.amount / 100 * 100) / 100) < 1e-9); }), true);
// Uber Eats
check("Uber Eats „Selbst zusammenstellen“: Grundpreis 1 €, Gruppen Base · Proteine · Vitamine · Toppings · Dips", UE.item === "Selbst zusammenstellen" && UE.basePrice === 1 && UE.groups.map(g => g.name).join("|") === "Base|Proteine|Vitamine|Toppings|Dips", true);
check("Uber Eats: Base 8 (ohne Quinoa ganz + halb) · Proteine 14 · Vitamine 11 (ohne Halbe Limette) · Toppings 7 · Dips 13 + „ohne Dip“", UG.base.options.length === 8 && UG.protein.options.length === 14 && UG.vitamine.options.length === 11 && UG.toppings.options.length === 7 && UG.dip.options.length === 13 && UG.dip.none === "ohne Dip", true);
check("Uber Eats: Gruppen bis 100 Auswahlen, Dips Pflicht (1–100), Stepper Base bis 10×, sonst bis 5×", UE.groups.every(g => g.max === 100) && UG.dip.min === 1 && UG.base.options.every(o => o.maxQty === 10) && UE.groups.filter(g => g.id !== "base").every(g => g.options.every(o => o.maxQty === 5)), true);
check("Uber Eats: Rollen — 10 Haupt-Protein-Optionen (inkl. halber), Ei/Edamame/Erbsen/Feta unter „Proteine“ als Extras, Vitamine + Toppings Extras", ueAll.filter(o => o.role === "protein").length === 10 && ["hart_gekochtes_ei", "edamame", "erbsen", "feta_kaese"].every(id => ueAll.filter(o => o.ing === id).length === 1 && ueAll.filter(o => o.ing === id).every(o => o.role === "extra" && o.group === "protein")) && UG.vitamine.options.every(o => o.role === "extra") && UG.toppings.options.every(o => o.role === "extra") && UG.base.options.every(o => o.role === "base") && UG.dip.options.every(o => o.role === "dip"), true);
check("Uber Eats: 9 halbe Portionen (4 Base, 5 Proteine), je halbe Menge zum halben Preis der ganzen", (() => { const hs = ueAll.filter(o => o.half); return hs.length === 9 && UG.base.options.filter(o => o.half).length === 4 && hs.every(o => { const f = ueAll.find(y => !y.half && y.ing === o.ing && y.group === o.group); return !!f && f.amount === 2 * o.amount && Math.abs(f.price - 2 * o.price) < 1e-9; }); })(), true);
check("Uber Eats: Salatmix 80 g = Shop-Portion (13,6 kcal), halbe 40 g (6,8 kcal)", uopt("Salatmix (80g)").amount === 80 && uopt("Salatmix (80g)").kcal === 13.6 && uopt("Salatmix - Halbe Portion (40g)").kcal === 6.8, true);
check("Uber Eats: Preise Basmati Reis 2,50 € · halbe 1,25 € · Pulled Salmon 4,00 € · Chili Gewürz 0 €", uopt("Basmati Reis (250g)").price === 2.5 && uopt("Basmati Reis - Halbe Portion (125g)").price === 1.25 && uopt("Pulled Salmon (100g)").price === 4 && uopt("Chili Gewürz (1g)").price === 0, true);
check("Uber Eats: Portionswerte = pro 100 g × Menge / 100 (alle Optionen)", ueAll.every(o => { const ing = T.COMPLEAT.ingredients.find(x => x.id === o.ing); return T.KEYS.every(k => Math.abs(o[k] - Math.round(ing.per100[k] * o.amount / 100 * 100) / 100) < 1e-9); }), true);
check("Uber Eats: Kurznamen ohne Menge, halbe Portion als „½ …“", uopt("Basmati Reis (250g)").short === "Basmati Reis" && uopt("Hühnchen - Halbe Portion (50g)").short === "½ Hühnchen" && uopt("Olivenöl (20ml), Salz & halbe Zitrone").short === "Olivenöl, Salz & halbe Zitrone", true);
check("Uber Eats: Quinoa (ganz + halb) nicht im Rechner-Menü, als gesperrt übersprungen", ueAll.every(o => o.ing !== "bunter_bio_quinoa") && updC.buildMenu(rawC, "ubereats").skipped.filter(s => /Quinoa/.test(s)).length === 2, true);
check("Uber Eats: Halbe Limette ohne offizielle Werte → nicht im Menü, in _meta.ubereats.noData", !ueAll.some(o => /Limette/.test(o.name)) && rawC._meta.ubereats.noData.some(d => /Halbe Limette/.test(d)), true);
check("Uber Eats: kcal-Angaben geprüft — Abweichungen nur Protein-Pasta halbe (238 statt 190,5) und Granatapfelkerne (15 statt 11,1)", rawC._meta.ubereats.kcalDiffs.map(d => d.ubereats + ":" + d.ubereatsKcal + ":" + d.shopKcal).sort().join("|") === "Granatapfelkerne (15g):15:11.1|Protein-Pasta - Halbe Portion (100g):238:190.5", true);
check("Uber Eats: keine Mengenabweichung zum Shop, jede Shop-Zutat angeboten", rawC._meta.ubereats.portionDiffs.length === 0 && rawC._meta.ubereats.notOnUberEats.length === 0, true);
check("Uber-Eats-Erfassung: 58 Optionen, Zeitstempel und Produktseite, = raw.json", (() => { const capU = U.readJSON(__dirname + "/data/compleat-ubereats-menu.json"); return capU.groups.reduce((a, g) => a + g.options.length, 0) === 58 && /^2026-09-15T/.test(capU.capturedAt) && /ubereats\.com\/de-en\/store\/compleat-frankfurt-nordend\//.test(capU.pageUrl) && rawC.ubereats.capturedAt === capU.capturedAt && rawC.ubereats.itemPrice === capU.item.price / 100; })(), true);
// beide Plattformen
check("Crunch = Erdnüsse, Walnusskerne, Röstzwiebeln, Schwarzer Sesam (beide Menüs)", [...new Set([...W.groups, ...UE.groups].flatMap(g => g.options).filter(o => o.crunch).map(o => o.ing))].sort().join(",") === "erdnuesse,roestzwiebeln,schwarzer_sesam,walnusskerne", true);
const quinoa = T.COMPLEAT.ingredients.find(x => x.id === "bunter_bio_quinoa");
check("Quinoa: im Datensatz, gesperrt mit Begründung (User 15.09.2026)", !!quinoa && /User 15\.09\.2026/.test(quinoa.blocked || "") && T.COMPLEAT_BLOCKED.has("bunter_bio_quinoa"), true);
check("Quinoa: in keiner Option der Rechner-Menüs (Wolt + Uber Eats)", [...W.groups, ...UE.groups].every(g => g.options.every(o => o.ing !== "bunter_bio_quinoa")), true);
check("Quinoa: in raw.json-Menüs vorhanden (wird vom Update-Skript weggelassen)", rawC.wolt.groups.some(g => g.options.some(o => o.ingredient === "bunter_bio_quinoa")) && updC.buildMenu(rawC, "wolt").skipped.some(s => /Quinoa/.test(s)) && rawC.ubereats.groups.some(g => g.options.some(o => o.ingredient === "bunter_bio_quinoa")), true);
check("Kein Schalentier bei Compleat (Allergene + Namen, beide Menüs)", T.COMPLEAT.ingredients.every(x => !x.shellfish && !T.isShellfish(x)) && [...W.groups, ...UE.groups].every(g => g.options.every(o => !T.isShellfish(o))), true);
const metaC = rawC._meta;
check("_meta: 7 dokumentierte Auffälligkeiten", metaC.anomalies.map(a => a.id).sort().join(",") === "avocado,bunter_bio_quinoa,chili_gewuerz,edamame,honey_muscle_mustard,olivenoel_salz_halbe_zitrone,pulled_salmon", true);
check("_meta: 4 Anzeige-Bugs im Shop dokumentiert", metaC.displayBugs.map(b => b.id).sort().join(",") === "granatapfelkerne,roestzwiebeln,sojasauce,walnusskerne", true);
check("_meta: Mengenabweichung Wolt ↔ Shop nur Salat-Mix", metaC.portionDiffs.length === 1 && metaC.portionDiffs[0].wolt === "Salat-Mix, 100 g", true);
check("_meta: Koriander in der Guacamole vermerkt", metaC.dislikes.some(d => /Guacamole/.test(d) && /Koriander/i.test(d)), true);
check("_meta: Entscheidungen des Users mit Datum (inkl. Preislimit + Uber Eats)", metaC.decisions.length >= 7 && metaC.decisions.every(d => /^User [0-9]{2}[.][0-9]{2}[.][0-9]{4}/.test(d)) && metaC.decisions.some(d => /Preislimit/.test(d)) && metaC.decisions.some(d => /Uber Eats/.test(d)), true);
check("_meta: 4-€-Rückfrage dokumentiert (Grundpreis bleibt 2 € + vorausgewählter Dip)", metaC.decisions.some(d => /User 16[.]09[.]2026/.test(d) && /4 €/.test(d) && /Grundpreis bleibt 2 €/.test(d)) && /Menükarte/.test(metaC.woltRules) && /keine Vorauswahl/.test(metaC.ubereatsRules), true);
check("verify-compleat.js: Word-Export = nachgerechnete Shop-Anzeige", (() => { try { require("child_process").execFileSync(process.execPath, [__dirname + "/verify-compleat.js"], { stdio: "pipe" }); return true; } catch (e) { return false; } })(), true);
check("_meta: halbe Portionen haben je 100 g dieselben Werte wie die ganze — einzige Ausnahme Quinoa (gesperrt, Eiweiß 0,9 statt 1,8)", metaC.halfPortionDiffs.length === 1 && metaC.halfPortionDiffs[0].id === "bunter_bio_quinoa" && metaC.halfPortionDiffs[0].halb.protein === 0.9 && metaC.halfPortionDiffs[0].ganz.protein === 1.8 && !!rawC.ingredients.find(x => x.id === "bunter_bio_quinoa").blocked, true);
// Abgleich mit den 41 Fertig-Bowls des Onlineshops (data/compleat-presets.json, Anzeige vom 16.09.2026)
const presetsC = U.readJSON(__dirname + "/data/compleat-presets.json");
const vp = require("./verify-compleat-presets.js");
const vpRes = vp.verifyPresets(rawC, presetsC);
if (vpRes.failures.length) vpRes.failures.forEach(f => console.log(f));
check("Fertig-Bowls: 41 Bowls, Shop-Rechnung reproduziert jede Anzeige, keine unerklärte Abweichung", presetsC.bowls.length === 41 && vpRes.failures.length === 0, true);
check("Fertig-Bowls: unser Datensatz trifft 33 von 41 Anzeigen im Rahmen der Rundung (Rest = bekannte Shop-Effekte)", vpRes.rows.filter(r => r.direct).length, 33);
check("Fertig-Bowls (User-Beispiele): Classic Bowl - High Protein 730 kcal · Super Bowl - High Protein 759 kcal — beide ohne Abweichung", [["Classic Bowl - High Protein", 730], ["Super Bowl - High Protein", 759]].every(([n, kcal]) => { const r = vpRes.rows.find(x => x.name === n); return r && r.direct && r.shown.kcal === kcal && Math.abs(r.ours.kcal - kcal) < 1 && Math.abs(r.ours.protein - r.shown.protein) <= 0.05; }), true);
check("Fertig-Bowls: Shop-Rundung (kcal je Option gerundet, Rest Σ Wert × Menge / 100) — Super Bowl HP 759 statt ungerundet 758,3", (() => { const b = presetsC.bowls.find(x => x.name === "Super Bowl - High Protein"); const t = vp.shopTotal(b.items.map(it => ({ per100: it.per100, q: it.shopAmount }))); return t.kcal === 759 && t.carbs === 72.3 && t.fat === 20.6; })(), true);
check("Fertig-Bowls: Datenfehler im Datensatz fällt auf (Hühnchen-Eiweiß verfälscht → Abgleich meldet Probleme)", (() => { const bad = JSON.parse(JSON.stringify(rawC)); bad.ingredients.find(x => x.id === "huehnchen").per100.protein = 25; return vp.verifyPresets(bad, presetsC).failures.length > 0; })(), true);
check("verify-compleat-presets.js läuft ohne Probleme", (() => { try { require("child_process").execFileSync(process.execPath, [__dirname + "/verify-compleat-presets.js"], { stdio: "pipe" }); return true; } catch (e) { return false; } })(), true);

// ── Compleat: Optimizer ──
sect("Compleat: Optimizer (Wolt + Uber Eats)");
const stC = T.defaultRestoState(CR);
check("Default: No dip AN, No crunch AUS, max. 5 Extras, max. 2 Portionen", stC.sw.noDip === true && stC.sw.noCrunch === false && stC.extra.maxExtras === 5 && stC.extra.cap === 2, true);
const run = (t, st, ex, mode, p) => T.runOptimize(CR, t, mode || "macros", p || {}, st, ex || new Set());
const cntC = (r, role) => r.parts.filter(pt => T.bowlRole(pt.opt) === role).reduce((s, pt) => s + pt.qty, 0);
const priceC = (menu, r) => Math.round((menu.basePrice + r.parts.reduce((s, pt) => s + pt.opt.price * pt.qty, 0) + (r.dip ? r.dip.price : 0)) * 100) / 100;
const tDef = tgt(65, 85, 20);
const rDef = run(tDef, stC);
check("Standardziele: Ergebnisse vorhanden", rDef.length > 0, true);
check("jede Bowl ≥1 Base + ≥1 Protein", rDef.every(r => cntC(r, "base") >= 1 && cntC(r, "protein") >= 1), true);
check("No dip AN → nie ein Dip", rDef.every(r => !r.dip), true);
check("Deckel: je Base/Protein ≤ 2, Extras ≤ 5 und je 1×", rDef.every(r => r.parts.every(pt => pt.qty <= (T.bowlRole(pt.opt) === "extra" ? 1 : 2)) && cntC(r, "extra") <= 5), true);
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
// Preise (Wolt)
check("Wolt: Preis je Bowl = 2 € Grundpreis + Σ Optionspreise", rDef.every(r => typeof r.price === "number" && Math.abs(r.price - priceC(W, r)) < 1e-9), true);
check("Wolt: „No dip“ AN → Preis ohne Dip-Aufschlag; Order Guide sagt „Ohne Dip“ (Wolt hat „Curvy Curry Dip“ 2 € vorausgewählt)", rDef.every(r => !r.dip && Math.abs(r.price - (W.basePrice + r.parts.reduce((a, pt) => a + pt.qty * pt.opt.price, 0))) < 1e-9) && T.bowlOrderSteps(W, rDef[0]).slice(-1)[0].v === "Ohne Dip", true);
const rCap = run({ ...tDef, maxPrice: 12 }, stC);
check("Preislimit über die Ziele (t.maxPrice = 12 €): Ergebnisse, keines teurer — ohne Limit teurer", rCap.length > 0 && rCap.every(r => r.price <= 12 + 1e-9) && rDef[0].price > 12, true);
check("Preislimit unter dem Grundpreis (1,50 €) → keine Bowl", run({ ...tDef, maxPrice: 1.5 }, stC).length, 0);
const oC = { cap: 2, maxExtras: 2, keep: x => !T.COMPLEAT_BLOCKED.has(x.ing) };
let exOkC = 0; const exC = [tgt(65, 85, 20), tgt(40, 60, 25), tgt(90, 50, 15), tgt(31, 80, 33)];
for (const tt of exC) if (sameTop(rawTop(W, tt, "macros", {}, oC), exhaustiveBowl(W, tt, "macros", {}, oC))) exOkC++;
check("Makro-Modus: Top 30 = vollständige Durchrechnung (Compleat Wolt inkl. Dips, 4 Ziele)", exOkC, exC.length);
let exKC = 0; const exKCTargets = [[kcalT(450), { hp: true, lf: true }], [kcalT(800), { hc: true }], [kcalT(650, { fibMin: 10, sMax: 3 }), { lc: true, lf: true }], [kcalT(1000), { hp: true, hf: true }]];
for (const [tt, pp] of exKCTargets) if (sameTop(rawTop(W, tt, "calories", pp, oC), exhaustiveBowl(W, tt, "calories", pp, oC))) exKC++;
check("Kalorien-Modus mit Präferenzen: Top 30 = vollständige Durchrechnung (Compleat Wolt inkl. Dips, 4 Ziele)", exKC, exKCTargets.length);
let exPC = 0; const exPCT = [[tgt(65, 85, 20), "macros", {}], [tgt(31, 80, 33), "macros", {}], [kcalT(600), "calories", { hp: true, lf: true }]];
for (const [tt, md, pp] of exPCT) if (sameTop(rawTop(W, tt, md, pp, { ...oC, maxPrice: 11 }), exhaustiveBowl(W, tt, md, pp, { ...oC, maxPrice: 11 }))) exPC++;
check("Preislimit 11 €: Top 30 = vollständige Durchrechnung (Compleat Wolt inkl. Dips, 3 Ziele)", exPC, exPCT.length);
// Untergrenzen der Kern-Suche: LB(Kern) ≤ Score JEDER Erweiterung (Zufallsfälle aus Compleat-Optionen)
let sdLB = 20260915; const rndLB = () => (sdLB = (sdLB * 1103515245 + 12345) % 2147483648) / 2147483648;
const vecsLB = [...W.groups, ...UE.groups].flatMap(g => g.options).filter(x => !T.COMPLEAT_BLOCKED.has(x.ing)).map(x => T.KEYS.map(k => x[k] || 0));
const addRnd = (v, n) => { const out = v.slice(); for (let j = 0; j < n; j++) { const u = vecsLB[Math.floor(rndLB() * vecsLB.length)]; for (let k = 0; k < 8; k++) out[k] += u[k]; } return out; };
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
let kmOk = 0, kmN = 0, lbKOk = 0;
for (let i = 0; i < 400; i++) {
  const L = (rndLB() - 0.45) * 900, kLo = 1 + rndLB() * 900, kHi = kLo + rndLB() * 1200, T0 = rndLB() < 0.1 ? 0 : Math.round(150 + rndLB() * 1100);
  const m = T.bowlKcalShareMin(L, kLo, kHi, T0);
  let min = Infinity; for (let k = 0; k <= 400; k++) { const K = kLo + (kHi - kLo) * k / 400; min = Math.min(min, (T0 > 0 ? Math.abs(K - T0) / Math.max(T0, 1) * 4 : 0) + L / K); }
  kmN++; if (m <= min + 1e-9 && m >= min - 0.02) kmOk++;
  // bowlShareLB mit kmax: Erweiterung e mit kcal ≤ kmax
  const pp = PREFS_LB[i % PREFS_LB.length], tk = kcalT(Math.round(150 + rndLB() * 1100));
  const rho = Math.min(...vecsLB.filter(v => v[0] > 0).map(v => T.bowlShareL(v, pp) / v[0]));
  const c = addRnd([0, 0, 0, 0, 0, 0, 0, 0], 1 + Math.floor(rndLB() * 3)), e = addRnd(c, Math.floor(rndLB() * 8));
  if (T.bowlShareLB(c, tk, pp, rho, 1e9, e[0] + rndLB() * 200) <= T.scoreVec(e, tk, "calories", pp) + 1e-9) lbKOk++;
}
check("bowlKcalShareMin = Minimum über das kcal-Intervall (400 Zufallsfälle, dichtes Raster als Referenz)", kmOk, kmN);
check("bowlShareLB mit erreichbarer kcal-Obergrenze ≤ Score jeder Erweiterung (400 Zufallsfälle)", lbKOk, 400);
const stepsC = T.orderStepsFor(CR, rDef[0]);
check("Order Guide (Wolt): Item → Deine Basis → Deine Proteine → (Deine Extras) → Dein Dip", stepsC[0].l === "Item" && stepsC[0].v === "Build your Bowl" && stepsC[1].l === "Deine Basis" && stepsC[2].l === "Deine Proteine" && stepsC[stepsC.length - 1].l === "Dein Dip", true);
check("Order Guide (Wolt): Mengen bei Basis/Proteinen („1×“/„2×“), Extras ohne Menge, kein Dip → „Ohne Dip“", /^\d× /.test(stepsC[1].v) && /^\d× /.test(stepsC[2].v) && stepsC.filter(s => s.l === "Deine Extras").every(s => !/×/.test(s.v)) && stepsC[stepsC.length - 1].v === "Ohne Dip", true);
check("Zusammenfassung mit Kurznamen", T.summarizeResult(CR, rDef[0]) === T.bowlSummary(rDef[0]) && !/, \d/.test(T.bowlSummary(rDef[0])), true);
check("Untertitel im Detail-Panel: „Build your Bowl · N components · €Preis“", T.bowlSubtitle(W, rDef[0]) === "Build your Bowl · " + rDef[0].items.length + " components · " + T.bowlEuro(rDef[0].price), true);
const exC2 = T.excludablesFor(CR);
check("Ausschluss-Liste (Wolt): jede Zutat einmal, ohne Quinoa, Hähnchen unter „Deine Proteine“", new Set(exC2.map(x => x.id)).size === exC2.length && !exC2.some(x => x.id === "bunter_bio_quinoa") && exC2.find(x => x.id === "huehnchen").group === "Deine Proteine", true);

// Uber Eats
const stU = T.defaultRestoState(CU);
const runU = (t, st, ex, mode, p) => T.runOptimize(CU, t, mode || "macros", p || {}, st || stU, ex || new Set());
const rU = runU(tDef);
check("Uber Eats: Defaults wie Wolt (No dip AN, No crunch AUS, 5 Extras, 2 Portionen)", stU.sw.noDip === true && stU.sw.noCrunch === false && stU.extra.maxExtras === 5 && stU.extra.cap === 2, true);
check("Uber Eats: Standardziele liefern Bowls — je ≥1 Base + ≥1 Haupt-Protein, kein Dip", rU.length > 0 && rU.every(r => cntC(r, "base") >= 1 && cntC(r, "protein") >= 1 && !r.dip), true);
check("Uber Eats: nie Quinoa, Limette, Chili oder Schalentier", rU.every(r => r.items.every(x => x.ing !== "bunter_bio_quinoa" && !/Limette/.test(x.name) && x.ing !== "chili_gewuerz" && !T.isShellfish(x))), true);
const huC = r => { const m = {}; for (const pt of r.parts) if (["base", "protein"].includes(T.bowlRole(pt.opt))) m[pt.opt.ing] = (m[pt.opt.ing] || 0) + (pt.opt.half ? 1 : 2) * pt.qty; return m; };
const rUbig = runU(tgt(160, 220, 40), { ...stU, extra: { ...stU.extra, cap: 3 } });
check("Uber Eats: halbe Portion höchstens 1× neben der ganzen, Deckel je Zutat in halben Portionen (cap 3), Extras je 1×", rUbig.length > 0 && rUbig.every(r => r.parts.every(pt => (!pt.opt.half || pt.qty === 1) && (T.bowlRole(pt.opt) !== "extra" || pt.qty === 1)) && Object.values(huC(r)).every(v => v <= 6)), true);
const hF = uopt("Hühnchen (100g)"), hH = uopt("Hühnchen - Halbe Portion (50g)"), bF = uopt("Basmati Reis (250g)");
check("Uber Eats: 150 g Hühnchen = ganze + halbe Portion (exakter Treffer)", (() => { const tt = tgt(bF.protein + hF.protein + hH.protein, bF.carbs + hF.carbs + hH.carbs, bF.fat + hF.fat + hH.fat); const r0 = runU(tt, { ...stU, extra: { ...stU.extra, maxExtras: 0 } })[0]; return r0.rawScore < 1e-9 && r0.parts.some(pt => pt.opt === hF && pt.qty === 1) && r0.parts.some(pt => pt.opt === hH && pt.qty === 1); })(), true);
check("Uber Eats: Protein-Pflicht — nur Ei/Edamame/Erbsen/Feta übrig → keine Bowl", runU(tDef, stU, new Set(["huehnchen", "veganes_huehnchen_planted_chicken", "rinderhackbaellchen", "vegane_hackbaellchen", "pulled_salmon"])).length, 0);
check("Uber Eats: No dip AUS → passender Dip (Basmati + Hühnchen + Curvy Curry), höchstens einer", (() => { const d = uopt("Curvy Curry (80g)"); const tt = tgt(bF.protein + hF.protein + d.protein, bF.carbs + hF.carbs + d.carbs, bF.fat + hF.fat + d.fat); const r = runU(tt, { ...stU, sw: { ...stU.sw, noDip: false } }); return r[0].dip === d && r.every(x => x.items.filter(y => T.bowlRole(y) === "dip").length <= 1); })(), true);
check("Uber Eats: Preis = 1 € Grundpreis + Σ Optionspreise", rU.every(r => typeof r.price === "number" && Math.abs(r.price - priceC(UE, r)) < 1e-9), true);
const rUp = runU({ ...tDef, maxPrice: 10 });
check("Uber Eats: Preislimit 10 € → Ergebnisse, keines teurer", rUp.length > 0 && rUp.every(r => r.price <= 10 + 1e-9), true);
check("Uber Eats: Standard-Einstellungen bleiben im Arbeitsbudget (Makro- und Kalorien-Modus, kein approx)", !rU.approx && !runU(kcalT(450), stU, null, "calories", { hp: true, lf: true }).approx && !runU(tgt(40, 60, 15)).approx && !runU(kcalT(750), stU, null, "calories", { hc: true }).approx, true);
check("Zeitbudget: maxMs 0 bei aufwendiger Uber-Eats-Suche → Abbruch mit approx, Bowls trotzdem gültig; Standard 500 ms", (() => { const r = T.bowlCombos(UE, tgt(140, 150, 50), "macros", {}, { cap: 4, maxExtras: 6, keep: x => !T.COMPLEAT_BLOCKED.has(x.ing), maxMs: 0 }); return r.approx === true && r.length > 0 && r.every(x => cntC(x, "base") >= 1 && cntC(x, "protein") >= 1 && x.parts.every(pt => !pt.opt.half || pt.qty === 1)) && T.BOWL_MAX_MS === 500 && T.BOWL_MAX_WORK === Infinity; })(), true);
check("Uber Eats: Ausschluss 'huehnchen' → nie Hühnchen (ganz + halb)", runU(tDef, stU, new Set(["huehnchen"])).every(r => r.items.every(x => x.ing !== "huehnchen")), true);
const stepsU = T.orderStepsFor(CU, rU[0]);
check("Uber Eats Order Guide: „Selbst zusammenstellen“ → Base → Proteine → … → Dips „ohne Dip“, jede Auswahl mit Menge", stepsU[0].l === "Item" && stepsU[0].v === "Selbst zusammenstellen" && stepsU[1].l === "Base" && stepsU.some(s => s.l === "Proteine") && stepsU[stepsU.length - 1].l === "Dips" && stepsU[stepsU.length - 1].v === "ohne Dip" && stepsU.slice(1, -1).every(s => s.v.split(" · ").every(v => /^\d× /.test(v))), true);
const exclU = T.excludablesFor(CU);
check("Uber Eats Ausschluss-Liste: je Zutat einmal (ganz + halb zusammen), ohne Quinoa/Limette, Name ohne Menge", new Set(exclU.map(x => x.id)).size === exclU.length && !exclU.some(x => x.id === "bunter_bio_quinoa" || /Limette/.test(x.name)) && exclU.find(x => x.id === "huehnchen").name === "Hühnchen" && exclU.find(x => x.id === "huehnchen").group === "Proteine", true);
// Uber Eats exakt — kleine Konfigurationen, damit die vollständige Durchrechnung schnell bleibt
const oU1 = { cap: 1, maxExtras: 1, keep: x => !T.COMPLEAT_BLOCKED.has(x.ing) && T.bowlRole(x) !== "dip" };
const oU0 = { cap: 1, maxExtras: 0, keep: x => !T.COMPLEAT_BLOCKED.has(x.ing) };
const oUh = { cap: 2, maxExtras: 3, keep: x => ["basmati_reis", "salatmix", "huehnchen", "pulled_salmon", "brokkoli", "avocado", "edamame", "mais", "curvy_curry"].includes(x.ing) };
let exUok = 0; const exUT = [
  [tgt(65, 85, 20), "macros", {}, oU1], [tgt(40, 120, 30), "macros", {}, oU1],
  [kcalT(450), "calories", { hp: true, lf: true }, oU1], [kcalT(800), "calories", { hc: true }, oU1],
  [tgt(50, 70, 25), "macros", {}, oU0], [kcalT(650), "calories", { lc: true, hp: true }, oU0],
  [tgt(80, 100, 20), "macros", {}, oUh], [kcalT(700), "calories", { hp: true }, oUh],
  [tgt(65, 85, 20), "macros", {}, { ...oU1, maxPrice: 9 }], [tgt(80, 100, 20), "macros", {}, { ...oUh, maxPrice: 12.5 }],
];
for (const [tt, md, pp, oo] of exUT) if (sameTop(rawTop(UE, tt, md, pp, oo), exhaustiveBowl(UE, tt, md, pp, oo))) exUok++;
check("Uber Eats: Top 30 = vollständige Durchrechnung (Makro/Kalorien, halbe Portionen, Dips, Preislimit; 10 Fälle)", exUok, exUT.length);
// Pflicht-Zutaten bei Compleat (User 16.09.2026)
const runI = (R, t, st, ex, inc) => T.runOptimize(R, t, "macros", {}, st, ex || new Set(), new Set(inc));
check("Compleat Wolt: Pflicht Pulled Salmon → in jeder Bowl, Regeln + Deckel bleiben", (() => { const r = runI(CR, tDef, stC, null, ["pulled_salmon"]); return r.length > 0 && r.every(x => x.items.some(y => y.ing === "pulled_salmon") && cntC(x, "base") >= 1 && !x.dip); })(), true);
check("Pflicht geht am Schalter vorbei: „No dip“ AN + Pflicht Guacamole → Guacamole in jeder Bowl; „No crunch“ AN + Erdnüsse → drin", (() => { const a = runI(CR, tDef, stC, null, ["guacamole"]); const b = runI(CR, tDef, { ...stC, sw: { ...stC.sw, noCrunch: true } }, null, ["erdnuesse"]); return a.length > 0 && a.every(x => x.dip && x.dip.ing === "guacamole") && b.length > 0 && b.every(x => x.items.some(y => y.ing === "erdnuesse")); })(), true);
check("Pflicht nie gegen Ausschluss oder Sperre: ausgeschlossene Pflicht wird ignoriert, Quinoa bleibt gesperrt", (() => { const a = runI(CR, tDef, stC, new Set(["avocado"]), ["avocado"]); const b = runI(CR, tDef, stC, null, ["bunter_bio_quinoa"]); return a.length > 0 && a.every(x => x.items.every(y => y.ing !== "avocado")) && b.length > 0 && b.every(x => x.items.every(y => y.ing !== "bunter_bio_quinoa")); })(), true);
check("Plattform-Unterschied: Pflicht Süßkartoffel → Wolt [] mit missing, Uber Eats Bowls mit Süßkartoffel", (() => { const w = runI(CR, tDef, stC, null, ["suesskartoffel"]); const u = runI(CU, tDef, stU, null, ["suesskartoffel"]); return w.length === 0 && w.missing.join() === "suesskartoffel" && u.length > 0 && u.every(x => x.items.some(y => y.ing === "suesskartoffel")); })(), true);
check("Uber Eats: Pflicht Hühnchen darf auch als halbe Portion erfüllt werden", (() => { const u = runI(CU, tgt(30, 70, 15), stU, null, ["huehnchen"]); return u.length > 0 && u.every(x => x.items.some(y => y.ing === "huehnchen")) && u.some(x => x.parts.some(pt => pt.opt.ing === "huehnchen" && pt.opt.half)); })(), true);
check("includables: Wolt ohne Quinoa und ohne Protein-Duplikate, Uber Eats ohne Limette; gemeinsamer Schlüssel compleat", (() => { const w = T.includablesFor(CR), u = T.includablesFor(CU); return !w.some(x => x.id === "bunter_bio_quinoa") && w.filter(x => x.id === "huehnchen").length === 1 && w.find(x => x.id === "huehnchen").role === "protein" && !u.some(x => /limette/i.test(x.name)) && CR.exclusionKey === CU.exclusionKey; })(), true);
check("All: Pflicht-Liste (inclMap.compleat) gilt für Wolt UND Uber Eats", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false, undefined, {}, { compleat: ["avocado"] }); const w = a.find(r => r._resto === "compleat"), u = a.find(r => r._resto === "compleatuber"); return !!w && !!u && w.items.some(x => x.ing === "avocado") && u.items.some(x => x.ing === "avocado"); })(), true);
let exUI = 0;
const exUIC = [[tgt(65, 85, 20), "macros", {}, { ...oU1, include: ["avocado"] }], [kcalT(600), "calories", { hp: true }, { ...oUh, include: ["huehnchen", "mais"] }], [tgt(80, 100, 20), "macros", {}, { ...oUh, include: ["pulled_salmon", "curvy_curry"] }]];
for (const [tt, md, pp, oo] of exUIC) if (sameTop(rawTop(UE, tt, md, pp, oo), exhaustiveBowl(UE, tt, md, pp, oo))) exUI++;
check("Uber Eats mit Pflicht-Zutaten: Top 30 = vollständige Durchrechnung (3 Fälle, halbe Portionen, Dip)", exUI, exUIC.length);
// plattformübergreifend
check("Such-Index: beide Plattformen mit eigenen Namen (Hähnchen, 100 g · Hühnchen (100g)), kein Quinoa, keine Limette", T.SEARCH_INDEX.filter(x => x.resto === "Compleat (Wolt)" && x.name === "Hähnchen, 100 g").length === 1 && T.SEARCH_INDEX.filter(x => x.resto === "Compleat (Uber Eats)" && x.name === "Hühnchen (100g)").length === 1 && !T.SEARCH_INDEX.some(x => /^Compleat/.test(x.resto) && /quinoa|limette/i.test(x.name)), true);
check("Suche 'haehnchen' findet Hähnchen + Veganes Hähnchen (Wolt)", (() => { const nm = T.searchItems("haehnchen").map(x => x.name); return nm.includes("Hähnchen, 100 g") && nm.includes("Veganes Hähnchen, 80 g"); })(), true);
check("Suche 'huehnchen uber' findet Uber-Eats-Hühnchen (ganz + halb)", (() => { const nm = T.searchItems("huehnchen uber").map(x => x.name); return nm.includes("Hühnchen (100g)") && nm.includes("Hühnchen - Halbe Portion (50g)"); })(), true);
const allC = T.optimizeAll(tDef, "macros", {}, 5, false);
check("All: beide Compleat-Einträge mit je einem Treffer und Preis", allC.filter(r => r._resto === "compleat").length === 1 && allC.filter(r => r._resto === "compleatuber").length === 1 && allC.every(r => typeof r.price === "number"), true);
check("All: gemeinsame Ausschluss-Liste (exclMap.compleat) gilt für Wolt UND Uber Eats", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false, undefined, { compleat: ["huehnchen"] }); const w = a.find(r => r._resto === "compleat"), u = a.find(r => r._resto === "compleatuber"); return !!w && !!u && w.items.every(x => x.ing !== "huehnchen") && u.items.every(x => x.ing !== "huehnchen"); })(), true);
check("All: Preislimit gilt auch dort", T.optimizeAll({ ...tDef, maxPrice: 12 }, "macros", {}, 5, false).every(r => r.price == null || r.price <= 12 + 1e-9), true);
check("resultKey stabil über Neuberechnung (Karten-Markierung)", T.resultKey(run(tDef, stC)[0]) === T.resultKey(rDef[0]), true);

// ── Dean & David (Wolt, Mix Your Own) ──
sect("Dean & David (Wolt, Mix Your Own Salad bar + Bowl bar)");
const rawDD = U.readJSON(__dirname + "/data/deandavid-raw.json");
const updDD = require("./deandavid-update.js");
const DD = T.DEANDAVID, DS = DD.salad, DB = DD.bowl;
const DRS = T.RESTO_BY_KEY.deandavidsalad, DRB = T.RESTO_BY_KEY.deandavidbowl;
const ddOpt = (menu, name) => menu.groups.flatMap(g => g.options).find(o => o.name === name);
const ddG = (menu, id) => menu.groups.find(g => g.id === id);
check("Registry: Dean & David Salad + Bowl (Wolt) — BYO, accurate, gemeinsame Listen (deandavid), Schalter „No dressing“ Default AN", !!DRS && !!DRB && DRS.kind === "byo" && DRB.kind === "byo" && DRS.accurate === true && DRB.accurate === true && DRS.exclusionKey === "deandavid" && DRB.exclusionKey === "deandavid" && DRS.menu === DS && DRB.menu === DB && DRS.switches.length === 1 && DRS.switches[0].id === "noDressing" && DRS.switches[0].def === true, true);
check("DEANDAVID-Block = deandavid-update.js(data/deandavid-raw.json) (Block aktuell)", (() => { const a = updDD.buildMenu(rawDD, "salad"), b = updDD.buildMenu(rawDD, "bowl"); return JSON.stringify(a.groups) === JSON.stringify(DS.groups) && JSON.stringify(b.groups) === JSON.stringify(DB.groups) && JSON.stringify(a.fixed) === JSON.stringify(DS.fixed) && JSON.stringify(b.fixed) === JSON.stringify(DB.fixed) && a.basePrice === DS.basePrice && b.basePrice === DB.basePrice && DD.ingredients.length === rawDD.ingredients.length; })(), true);
const valDD = T.bowlValidate(DD, ["salad", "bowl"]);
if (valDD.length) console.log(valDD.join("\n"));
check("bowlValidate(DEANDAVID) ohne Probleme (Salat + Bowl)", valDD.length, 0);
check("Grundpreis 7,25 € · Salat ohne Basis-Pflicht, Bowl mit · Premium Blattsalatmix fest in beiden (20 kcal, 1,4 g P)", DS.basePrice === 7.25 && DB.basePrice === 7.25 && DS.require.base === false && DB.require.base === true && DS.fixed.length === 1 && DS.fixed[0].kcal === 20 && DS.fixed[0].protein === 1.4 && DB.fixed.length === 1 && DB.fixed[0].ing === "blattsalatmix", true);
check("Salat: 5 Dressings (+5 Varianten) + „ohne Dressing/Sauce“ · Landbrot (+Variante) + „ohne Brot“ · „Extra Brot/Dressing“ nur Bestellschritt · 26 Extras", ddG(DS, "dressing").options.filter(o => !o.variant).length === 5 && ddG(DS, "dressing").options.filter(o => o.variant).length === 5 && ddG(DS, "dressing").none === "ohne Dressing/Sauce" && ddG(DS, "brot").options.length === 2 && ddG(DS, "brot").none === "ohne Brot" && ddG(DS, "extra_brot_dressing").options.length === 0 && ddG(DS, "extras").options.length === 26, true);
check("Bowl: 2 Basen (je 1×) · 4 Saucen (+4 Varianten) + „ohne Dressing“ · Landbrot · 26 Extras", ddG(DB, "basis").options.length === 2 && ddG(DB, "basis").options.every(o => o.role === "base" && o.maxQty === 1) && ddG(DB, "dressing").options.filter(o => !o.variant).length === 4 && ddG(DB, "dressing").none === "ohne Dressing" && ddG(DB, "brot").options.length === 2 && ddG(DB, "extras").options.length === 26, true);
check("Proteine (User 16.09.2026): Chicken, Lachs, Rind, Halloumi, Ziegenkäse, Schafskäse mit Rolle protein; 20 übrige Toppings extra; Wolt-Stepper bis 999", ddG(DS, "extras").options.filter(o => o.role === "protein").map(o => o.name).sort().join("|") === ["Chicken extra", "Halloumi extra", "Lachs extra", "Rind extra", "Schafskäse extra", "Ziegenkäse extra"].sort().join("|") && ddG(DS, "extras").options.filter(o => o.role === "extra").length === 20 && ddG(DS, "extras").options.every(o => o.maxQty === 999), true);
check("Werte pro Portion: Chicken extra = Hähnchen-Filetstreifen 105 kcal / 15,2 g P · Halloumi 293 kcal · Lachs = Räucherlachs 108 kcal · Geg. Kartoffeln = Roast Potatoes 136 kcal · Jasmin-Duftreis 330 kcal", ddOpt(DS, "Chicken extra").kcal === 105 && ddOpt(DS, "Chicken extra").protein === 15.2 && ddOpt(DS, "Halloumi extra").kcal === 293 && ddOpt(DS, "Lachs extra").kcal === 108 && ddOpt(DS, "Geg. Kartoffeln extra").kcal === 136 && ddOpt(DS, "Geg. Kartoffeln extra").ing === "roast_potatoes" && ddOpt(DB, "Jasmin-Duftreis").kcal === 330, true);
check("Preise laut Wolt: Lachs 4,25 € · Avocado 2,25 € · Edamame 1,25 € · Kürbis 3,75 € · Dressing und Brot 0 €", ddOpt(DS, "Lachs extra").price === 4.25 && ddOpt(DS, "Avocado extra").price === 2.25 && ddOpt(DS, "Edamame extra").price === 1.25 && ddOpt(DS, "Kürbis").price === 3.75 && ddOpt(DS, "Caesar Dressing").price === 0 && ddOpt(DS, "Mit knusprigem Landbrot").price === 0, true);
check("Varianten (User 16.09.2026): Caesar ×2 = 468 kcal für +0,80 €, Landbrot ×2 = 138 kcal für +0,30 €, mit Bestellschritten „Extra Dressing/Sauce“ / „extra Brot“", (() => { const c2 = ddOpt(DS, "Caesar Dressing + Extra Dressing/Sauce"), b2 = ddOpt(DS, "Mit knusprigem Landbrot + extra Brot"); return !!c2 && !!b2 && c2.variant === true && c2.kcal === 468 && c2.price === 0.8 && c2.orderName === "Caesar Dressing" && c2.order[0].name === "Extra Dressing/Sauce" && c2.order[0].group === "extra_brot_dressing" && b2.variant === true && b2.kcal === 138 && b2.price === 0.3 && b2.order[0].name === "extra Brot" && b2.short === "2× Landbrot"; })(), true);
check("Ohne offizielle Werte bzw. weggelassen nicht im Menü, aber dokumentiert: Pumpkin spice Gewürz, Marinierte Zwiebeln, Sonnenblumenkerne extra (User 16.09.2026)", [DS, DB].every(m => m.groups.every(g => g.options.every(o => !/Pumpkin spice|Marinierte Zwiebeln|Sonnenblumenkerne/.test(o.name)))) && rawDD._meta.noData.some(x => /Pumpkin spice Gewürz/.test(x)) && rawDD._meta.noData.some(x => /Marinierte Zwiebeln/.test(x)) && rawDD._meta.omitted.some(x => /Sonnenblumenkerne extra/.test(x) && /User 16\.09\.2026/.test(x)), true);
check("Allergenliste: kein Baustein mit Krebs- oder Weichtieren; Landbrot Gluten + Sesam, Halloumi Milch, Lachs Fisch", DD.ingredients.every(x => !x.shellfish) && rawDD._meta.shellfish.length === 0 && DD.ingredients.find(x => x.id === "landbrot").allergens.some(a => /^Gluten/.test(a)) && DD.ingredients.find(x => x.id === "landbrot").allergens.includes("Sesam") && DD.ingredients.find(x => x.id === "halloumi").allergens.includes("Milch") && DD.ingredients.find(x => x.id === "raeucherlachs").allergens.includes("Fisch"), true);
check("Ballaststoffe nicht angegeben → 0 (dokumentiert); Auffälligkeiten dokumentiert (Jasmin-Duftreis Seite 2, Räucherlachs Zucker)", DD.ingredients.every(x => x.perPortion.fibre === 0 && x.per100.fibre === 0) && /Ballaststoffe/.test(rawDD._meta.fibre) && rawDD._meta.anomalies.some(a => a.id === "jasmin_duftreis") && rawDD._meta.anomalies.some(a => a.id === "raeucherlachs"), true);
check("Filialen: Mainzer Landstraße + Tower 185 identisch, MyZeil ohne Marinierte Zwiebeln, Bockenheim ohne Salat bar", /identisch/.test(rawDD._meta.venues["deandavid-mainzer-landstrasse"]) && /identisch/.test(rawDD._meta.venues["deandavid-tower-185"]) && /Marinierte Zwiebeln/.test(rawDD._meta.venues["deandavid-myzeil"]) && /Salad bar fehlt/.test(rawDD._meta.venues["deandavid-bockenheim"]), true);
const stDS = T.defaultRestoState(DRS), stDB = T.defaultRestoState(DRB);
const runDD = (R, t, st, inc, mode, p) => T.runOptimize(R, t, mode || "macros", p || {}, st, new Set(), new Set(inc || []));
const rDS = runDD(DRS, tDef, stDS), rDB = runDD(DRB, tDef, stDB);
check("Defaults: No dressing AN, max. 5 Extras, max. 2 Portionen", stDS.sw.noDressing === true && stDS.extra.maxExtras === 5 && stDS.extra.cap === 2 && stDB.sw.noDressing === true, true);
check("Salat: ≥1 Protein, keine Basis, kein Dressing (Schalter), Blattsalatmix enthalten, Proteine ≤ 2 Portionen, Toppings je 1×", rDS.length > 0 && rDS.every(r => cntC(r, "protein") >= 1 && cntC(r, "base") === 0 && !r.dip && r.fixed.length === 1 && r.items[0].ing === "blattsalatmix" && r.parts.every(pt => T.bowlRole(pt.opt) === "protein" ? pt.qty <= 2 : pt.qty === 1)), true);
check("Bowl: genau eine Basis, ≥1 Protein", rDB.length > 0 && rDB.every(r => cntC(r, "base") === 1 && cntC(r, "protein") >= 1), true);
check("Preis = 7,25 € + Toppings + Brot-/Dressing-Varianten", [...rDS, ...rDB].every(r => Math.abs(r.price - Math.round((7.25 + r.parts.reduce((a, pt) => a + pt.opt.price * pt.qty, 0) + (r.dip ? r.dip.price : 0) + (r.side ? r.side.price : 0)) * 100) / 100) < 1e-9), true);
check("No dressing AUS → Dressing wird genutzt, wenn es passt (höchstens eines)", (() => { const r = runDD(DRS, tgt(40, 30, 45), { ...stDS, sw: { noDressing: false } }); return r.length > 0 && r.some(x => x.dip) && r.every(x => x.items.filter(y => T.bowlRole(y) === "dip").length <= 1); })(), true);
check("Pflicht „Tahini Lemon“ geht am Schalter vorbei; Pflicht Halloumi in jedem Salat", (() => { const r = runDD(DRS, tDef, stDS, ["tahini_lemon", "halloumi"]); return r.length > 0 && r.every(x => x.dip && x.dip.ing === "tahini_lemon" && x.items.some(y => y.ing === "halloumi")); })(), true);
check("Pflicht Jasmin-Duftreis: im Salat-Tab missing, im Bowl-Tab in jeder Bowl", (() => { const s1 = runDD(DRS, tDef, stDS, ["jasmin_duftreis"]); const b1 = runDD(DRB, tDef, stDB, ["jasmin_duftreis"]); return s1.length === 0 && s1.missing.join() === "jasmin_duftreis" && b1.length > 0 && b1.every(x => x.parts.some(pt => pt.opt.ing === "jasmin_duftreis")); })(), true);
check("Order Guide Salat: Item → Dressing („ohne Dressing/Sauce“) → Brot → Extras mit Mengen", (() => { const st1 = DRS.orderSteps(rDS[0]); return st1[0].v === "Mix Your Own Salad bar" && st1[1].l === "WELCHES DRESSING MÖCHTEST DU? (MYO SALAD)" && st1[1].v === "ohne Dressing/Sauce" && st1[2].l === "BROT MIT DAZU?" && st1.slice(-1)[0].l === "WÄHLE DEINE EXTRAS" && st1.slice(-1)[0].v.split(" · ").every(v => /^\d× /.test(v)); })(), true);
check("Order Guide mit Varianten: „Caesar Dressing“, „Mit knusprigem Landbrot“ und beide Extras in „EXTRA BROT/DRESSING DAZU?“", (() => { const X = n => ddOpt(DS, n); const st1 = DRS.orderSteps({ parts: [{ opt: X("Chicken extra"), qty: 1 }], side: X("Mit knusprigem Landbrot + extra Brot"), dip: X("Caesar Dressing + Extra Dressing/Sauce") }); const v = l => (st1.find(x => x.l === l) || {}).v; return v("WELCHES DRESSING MÖCHTEST DU? (MYO SALAD)") === "Caesar Dressing" && v("BROT MIT DAZU?") === "Mit knusprigem Landbrot" && v("EXTRA BROT/DRESSING DAZU?") === "extra Brot · Extra Dressing/Sauce"; })(), true);
check("Suche, Ausschluss, Pflicht: je Zutat ein Eintrag ohne Varianten; Such-Index mit Dean-&-David-Badge", (() => { const inc = T.includablesFor(DRS), ex = T.excludablesFor(DRB); return inc.filter(x => x.id === "caesar").length === 1 && !inc.some(x => /\+ /.test(x.name)) && ex.some(x => x.id === "jasmin_duftreis") && !T.SEARCH_INDEX.some(x => /\+ (Extra Dressing\/Sauce|extra Brot)$/.test(x.name)) && T.SEARCH_INDEX.some(x => x.resto === "Dean & David Salad (Wolt)" && x.name === "Halloumi extra"); })(), true);
check("All: Dean & David Salat + Bowl mit je einem Treffer und Preis", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false); return a.filter(r => r._resto === "deandavidsalad").length === 1 && a.filter(r => r._resto === "deandavidbowl").length === 1 && a.every(r => typeof r.price === "number"); })(), true);
let exDD = 0;
const exDDC = [[DS, tDef, "macros", {}, { cap: 2, maxExtras: 2 }], [DS, kcalT(550), "calories", { hp: true, lf: true }, { cap: 2, maxExtras: 2 }], [DB, tgt(50, 110, 20), "macros", {}, { cap: 2, maxExtras: 2 }], [DS, tgt(40, 30, 45), "macros", {}, { cap: 2, maxExtras: 2, include: ["tahini_lemon", "avocado"] }], [DB, kcalT(900), "calories", { hc: true }, { cap: 1, maxExtras: 2, maxPrice: 16 }]];
for (const [mn, tt, md, pp, oo] of exDDC) if (sameTop(rawTop(mn, tt, md, pp, oo), exhaustiveBowl(mn, tt, md, pp, oo))) exDD++;
check("Dean & David: Top 30 = vollständige Durchrechnung (Salat + Bowl, Makro/Kalorien, Pflicht, Preislimit; 5 Fälle)", exDD, exDDC.length);

// ── Subway (Wolt, Create Your Own) ──
sect("Subway (Wolt, Create Your Own)");
const SW = T.RESTO_BY_KEY.subway, SWD = T.SUBWAY, SWS = SWD.small, SWF = SWD.footlong;
const rawSW = U.readJSON(__dirname + "/data/subway-raw.json");
const updSW = require("./subway-update.js");
const subG = (menu, gid) => menu.groups.find(g => g.id === gid) || { options: [] };
const swOpt = (menu, gid, name) => subG(menu, gid).options.find(o => o.name === name);
const swIng = (menu, gid, ing) => subG(menu, gid).options.find(o => o.ing === ing && !o.variant);
const STDV = ["salat", "tomaten", "paprika", "zwiebeln", "mais"];
check("Registry: Subway (Wolt) — BYO, accurate, Listen unter „subway“, Schalter No sauce / No cheese / No seasonings / Standard veggies (alle Default AN)", !!SW && SW.kind === "byo" && SW.accurate === true && SW.platform === "Wolt" && SW.exclusionKey === "subway" && SW.name === "Subway (Wolt)" && SW.switches.map(x => x.id + ":" + x.def).join() === "noSauce:true,noCheese:true,noSeasonings:true,stdVeggies:true" && SW.switches[3].force.join() === STDV.join(), true);
check("SUBWAY-Block = subway-update.js(data/subway-raw.json) — 15-CM + Footlong (Block aktuell)", (() => { const a = updSW.buildMenu(rawSW, "small"), b = updSW.buildMenu(rawSW, "footlong"); return JSON.stringify(a.groups) === JSON.stringify(SWS.groups) && JSON.stringify(b.groups) === JSON.stringify(SWF.groups) && a.size === SWS.size && b.size === SWF.size && a.factor === 1 && b.factor === 2 && SWD.ingredients.length === rawSW.ingredients.length && SWD.stdVeggies.join() === rawSW._meta.stdVeggies.join(); })(), true);
const valSW = T.subwayValidate();
if (valSW.length) console.log(valSW.join("\n"));
check("subwayValidate ohne Probleme (beide Menüs, Footlong = 2 × 15-CM je Option)", valSW.length, 0);
check("Datensatz: alle 160 Zeilen der Nährwerttabelle in 15 Abschnitten (auch Getränke, Cookies, Wraps) — im Tracker nur Sub-Bausteine (User 16.09.2026)", rawSW.products.length === 160 && new Set(rawSW.products.map(x => x.section)).size === 15 && ["Getränke", "Cookies", "Wraps", "Salads", "Baked Potato"].every(sec => rawSW.products.some(x => x.section === sec)) && ![SWS, SWF].some(m => m.groups.some(g => g.options.some(o => /Cookie|Pepsi|Wrap|Potato/.test(o.name)))), true);
check("Subs: 11 Create-Your-Own-Artikel (+ 10 „Extra Fleisch / Protein“-Varianten, nicht bei Veggie Delite®); Italian B.M.T.®, Salami, Tuna raus (User 16.09.2026)", (() => {
  const subs = subG(SWS, "sub").options, names = subs.filter(o => !o.variant).map(o => o.name);
  return names.join("|") === "Beef Chili|Chicken Teriyaki|Plant-based Chicken Teriyaki|Chicken Fajita|Chicken Tandoori|Pulled Chicken Breast|Philly Beef & Cheese|BBQ Rib|Ham|Spicy Vegan Patty|Veggie Delite®" && subs.filter(o => o.variant).length === 10 && !subs.some(o => o.variant && o.ing === "veggie_delite")
    && !subs.some(o => /B\.M\.T|^Salami|^Tuna/.test(o.name)) && rawSW._meta.removed.length === 3 && ["Italian B.M.T.®", "Salami", "Tuna"].every(n => rawSW._meta.removed.some(x => x.startsWith(n + " ")));
})(), true);
check("Ohne offizielle Werte nicht im Tracker, aber dokumentiert: BBQ Pulled Pork/Plant, Dölicious, Nacho Chicken Classic, Sour Cream, Pulled Pork/Plant, Meersalz, Pfefferkörner", ["BBQ Pulled Pork", "BBQ Pulled Plant", "Plant-based Dölicious Chicken (V)", "Nacho Chicken Classic", "Sour Cream", "Pulled Pork", "Pulled Plant", "Meersalz", "Pfefferkörner"].every(n => rawSW._meta.noData.some(x => x.includes("„" + n + "“")) && ![SWS, SWF].some(m => m.groups.some(g => g.options.some(o => o.name === n)))) && ["BBQ Pulled Pork", "Dölicious", "Nacho Chicken Classic", "Sour Cream", "Meersalz"].every(n => T.SUBWAY_NOTE.includes(n.replace("Dölicious", "Dölicious Chicken"))), true);
check("Nie (User 16.09.2026): Extras ohne Extra Käse, Cheddar, Doritos Nacho Cheese, Mozzarella-Emmental-Mix; Käse nur Scheibenkäse, Cheddar, Mozzarella-Emmental-Mix (nie Frischkäse, Vegan Cheese)", [SWS, SWF].every(m => subG(m, "extras").options.map(o => o.name).join("|") === "Bacon|Chicken Teriyaki|Frischkäse|Tuna|Peperoni-Salami|Ham" && subG(m, "kaese").options.map(o => o.name).join("|") === "Scheibenkäse|Cheddar|Mozzarella-Emmental-Mix") && ["Extra Käse", "Doritos Nacho Cheese", "Vegan Cheese"].every(n => rawSW._meta.never.some(x => x.includes("„" + n + "“"))), true);
check("Preise (Wolt Zeil = Liste des Users): Beef Chili 9,79/16,79 € · Ham 7,59/13,19 € · Veggie Delite® 6,49/11,69 € · Extra Fleisch +2,19/+4,29 € · Glutenfrei +1,49/+2,89 € · Peperoni-Salami 1,69/3,39 € · Saucen 0 €", swOpt(SWS, "sub", "Beef Chili").price === 9.79 && swOpt(SWF, "sub", "Beef Chili").price === 16.79 && swOpt(SWS, "sub", "Ham").price === 7.59 && swOpt(SWF, "sub", "Ham").price === 13.19 && swOpt(SWS, "sub", "Veggie Delite®").price === 6.49 && swOpt(SWF, "sub", "Veggie Delite®").price === 11.69 && swOpt(SWS, "sub", "Ham + Extra Fleisch / Protein").price === 9.78 && swOpt(SWF, "sub", "Ham + Extra Fleisch / Protein").price === 17.48 && swOpt(SWS, "brot", "Glutenfrei").price === 1.49 && swOpt(SWF, "brot", "Glutenfrei").price === 2.89 && swOpt(SWS, "extras", "Peperoni-Salami").price === 1.69 && swOpt(SWF, "extras", "Peperoni-Salami").price === 3.39 && subG(SWS, "saucen").options.every(o => o.price === 0) && rawSW._meta.userPrices === "alle 18 Preise wie in der Liste des Users", true);
check("Nährwerte je Portion (15-CM) und ×2 (Footlong): Italian 190/380 kcal · Beef Chili 114/228 · Ham 34 (+ Extra Fleisch 68) · Veggie Delite® 0 · Eisbergsalat = Salat 1,5 · Rote Paprika = Paprika 3 · Scheibenkäse 42", swOpt(SWS, "brot", "Italian").kcal === 190 && swOpt(SWF, "brot", "Italian").kcal === 380 && swOpt(SWS, "sub", "Beef Chili").kcal === 114 && swOpt(SWF, "sub", "Beef Chili").kcal === 228 && swOpt(SWS, "sub", "Ham").kcal === 34 && swOpt(SWS, "sub", "Ham + Extra Fleisch / Protein").kcal === 68 && T.KEYS.every(k => swOpt(SWS, "sub", "Veggie Delite®")[k] === 0) && swOpt(SWS, "veggies", "Eisbergsalat").kcal === 1.5 && swOpt(SWS, "veggies", "Eisbergsalat").ing === "salat" && swOpt(SWS, "veggies", "Rote Paprika").kcal === 3 && swOpt(SWS, "kaese", "Scheibenkäse").kcal === 42, true);
check("Garlic & Herb (Vegan) gesperrt (Portion widerspricht 100 g): im Datensatz, nie im Menü, Auffälligkeit dokumentiert", SWD.ingredients.find(x => x.id === "garlic_herb").blocked === true && T.SUBWAY_BLOCKED.has("garlic_herb") && ![SWS, SWF].some(m => m.groups.some(g => g.options.some(o => o.ing === "garlic_herb"))) && rawSW._meta.anomalies.some(a => /Garlic/.test(a.name)) && rawSW._meta.blocked.length === 1 && subG(SWS, "saucen").options.length === 11, true);
check("Wolt-Grenzen: Brot + Sub genau 1 · Käse 0–1 · Extras bis 15 (Extras-Chip) · Veggies/Saucen/Seasonings eigene Grenze (Saucen 2 bzw. Footlong 3, Plant-based Chicken Teriyaki Footlong 2) · Veggies nur pick", subG(SWS, "brot").max === 1 && subG(SWS, "sub").max === 1 && subG(SWS, "kaese").max === 1 && subG(SWS, "extras").max === 15 && !subG(SWS, "extras").own && ["veggies", "saucen", "seasonings"].every(g => subG(SWS, g).own && subG(SWF, g).own) && subG(SWS, "saucen").max === 2 && subG(SWF, "saucen").max === 3 && swOpt(SWF, "sub", "Plant-based Chicken Teriyaki").groupMax.saucen === 2 && !swOpt(SWS, "sub", "Plant-based Chicken Teriyaki").groupMax && subG(SWS, "veggies").options.length === 10 && subG(SWS, "veggies").options.every(o => o.pick) && ![SWS, SWF].some(m => m.groups.some(g => g.id !== "veggies" && g.options.some(o => o.pick))), true);
check("„ohne …“ je Sub laut Wolt: Beef Chili „ohne Käse“, Ham ohne Käse-Option, Chicken Tandoori „ohne Saucen“, BBQ Rib „ohne Seasonings“, alle „ohne Veggies“", swOpt(SWS, "sub", "Beef Chili").none.kaese === "ohne Käse" && !swOpt(SWS, "sub", "Ham").none.kaese && swOpt(SWS, "sub", "Chicken Tandoori").none.saucen === "ohne Saucen" && swOpt(SWS, "sub", "BBQ Rib").none.seasonings === "ohne Seasonings" && subG(SWS, "sub").options.every(o => o.none.veggies === "ohne Veggies"), true);
check("Frischkäse (Extra) zählt für „No sauce“ (User 16.09.2026); Standard-Veggies = Eisbergsalat, Tomaten, Rote Paprika, Rote Zwiebeln, Mais", swOpt(SWS, "extras", "Frischkäse").sauce === true && subG(SWS, "extras").options.filter(o => o.sauce).length === 1 && STDV.map(id => swIng(SWS, "veggies", id).name).join("|") === "Eisbergsalat|Tomaten|Rote Paprika|Rote Zwiebeln|Mais", true);
check("_meta: Entscheidungen mit Datum, Annahmen, Filialvergleich (Skyline Plaza + Nordwestzentrum), Auffälligkeiten (Vollkornbrot Salz, Bacon Zucker)", rawSW._meta.decisions.length >= 6 && rawSW._meta.decisions.every(d => /^User 16[.]09[.]2026/.test(d)) && rawSW._meta.assumptions.some(a => /Standard veggies/.test(a)) && /Beef Chili/.test(rawSW._meta.venues["subway-franfurt-skyline-plaza"]) && /Ham/.test(rawSW._meta.venues["subway-frankfurt-nordwestzentrum"]) && rawSW._meta.anomalies.some(a => a.name === "Vollkornbrot") && rawSW._meta.anomalies.some(a => a.name === "Bacon") && /Footlong/.test(rawSW._meta.basis), true);
const stSW = T.defaultRestoState(SW);
const swSt = (extra, sw) => ({ ...stSW, extra: { ...stSW.extra, ...(extra || {}) }, sw: { ...stSW.sw, ...(sw || {}) } });
const runSW = (t, st, ex, inc, mode, p) => T.runOptimize(SW, t, mode || "macros", p || {}, st || stSW, new Set(ex || []), new Set(inc || []));
const swOpts = r => [...r.parts.map(pt => pt.opt), r.side, r.dip].filter(Boolean);
const swPrice = r => Math.round(swOpts(r).reduce((a, o) => a + o.price, 0) * 100) / 100;
const rSW = runSW(tDef);
check("Defaults: 15-CM, alle Brote und Subs, max. 5 Extras; No sauce, No cheese, No seasonings (User 16.09.2026), Standard veggies AN", stSW.extra.size === "small" && stSW.extra.breads.length === 0 && stSW.extra.subs.length === 0 && stSW.extra.maxExtras === 5 && stSW.sw.noSauce && stSW.sw.noCheese && stSW.sw.noSeasonings && stSW.sw.stdVeggies, true);
check("Standard: je 1 Sub + 1 Brot, kein Käse, keine Sauce, keine Seasonings, kein Frischkäse, genau die 5 Standard-Veggies, Extras ≤ 5, Preis = Σ Optionen, size 15-CM", rSW.length > 0 && rSW.every(r => cntC(r, "protein") === 1 && cntC(r, "base") === 1 && !r.side && inG(r, "saucen") === 0 && inG(r, "seasonings") === 0 && !swOpts(r).some(o => o.sauce) && swOpts(r).filter(o => o.group === "veggies").map(o => o.ing).sort().join() === STDV.slice().sort().join() && inG(r, "extras") <= 5 && Math.abs(r.price - swPrice(r)) < 1e-9 && r.size === "15-CM"), true);
const rSWmany = [tgt(90, 80, 20), tgt(60, 40, 30), tgt(120, 150, 40), tgt(40, 100, 10)].flatMap(tt => runSW(tt, swSt({ maxExtras: 6 })));
check("nie Sub + gleichnamiges Extra (Ham, Chicken Teriyaki) — doppelt nur über „Extra Fleisch / Protein“; Ham als Extra auf anderen Subs möglich", rSWmany.every(r => { const sub = swOpts(r).find(o => o.group === "sub"); return !swOpts(r).some(o => o.group === "extras" && o.ing === sub.ing); }) && rSWmany.some(r => swOpts(r).some(o => o.group === "extras" && o.ing === "ham")), true);
check("Footlong: Werte = 2 × dieselbe Zusammenstellung in 15-CM, Footlong-Preise, Untertitel „Footlong“", (() => { const r = runSW(tgt(100, 160, 35), swSt({ size: "footlong" })); const small = new Map(SWS.groups.flatMap(g => g.options.map(o => [o.id, o]))); return r.length > 0 && r.every(x => { const n2 = T.sumN(x.items.map(o => small.get(o.id.replace(/^fl_/, ""))), 2); return x.items.every(o => /^fl_/.test(o.id)) && T.KEYS.every(k => Math.abs(n2[k] - x.nutrition[k]) < 1e-6) && Math.abs(x.price - swPrice(x)) < 1e-9 && x.size === SWF.size; }) && SW.panelSubtitle(r[0]).includes("Footlong"); })(), true);
check("No sauce AUS: Saucen genutzt (≤ 2 bei 15-CM, ≤ 3 bei Footlong), Frischkäse möglich", (() => { const a = runSW(tgt(40, 80, 40), swSt({}, { noSauce: false })); const b = runSW(tgt(60, 150, 70), swSt({ size: "footlong" }, { noSauce: false })); return a.some(r => inG(r, "saucen") > 0) && a.every(r => inG(r, "saucen") <= 2) && b.some(r => inG(r, "saucen") === 3) && b.every(r => inG(r, "saucen") <= 3); })(), true);
check("Footlong Plant-based Chicken Teriyaki: höchstens 2 Saucen (Wolt)", (() => { const r = runSW(tgt(60, 150, 70), swSt({ size: "footlong", subs: ["pb_chicken_teriyaki"] }, { noSauce: false })); return r.length > 0 && r.every(x => inG(x, "saucen") <= 2 && swOpts(x).some(o => o.ing === "pb_chicken_teriyaki")) && r.some(x => inG(x, "saucen") === 2); })(), true);
check("No cheese AUS: höchstens ein Käse (Scheibenkäse, Cheddar oder Mozzarella-Emmental-Mix), wird genutzt, wenn er passt", (() => { const r = runSW(tgt(40, 60, 30), swSt({}, { noCheese: false })); return r.some(x => x.side) && r.every(x => !x.side || ["scheibenkaese", "cheddar", "mozzarella_emmental_mix"].includes(x.side.ing)); })(), true);
check("No seasonings AUS: Röstzwiebeln möglich; bei AN nie — als Pflicht trotzdem in jedem Sub", (() => { const tt = tgt(50, 90, 25); const off = runSW(tt, swSt({}, { noSeasonings: false })), on = runSW(tt), pick = runSW(tDef, stSW, null, ["roestzwiebeln"]); return off.some(r => inG(r, "seasonings") > 0) && on.every(r => inG(r, "seasonings") === 0) && pick.length > 0 && pick.every(r => swOpts(r).some(o => o.ing === "roestzwiebeln")); })(), true);
check("Standard veggies AUS → keine Veggies; Pflicht Jalapeños → nur Jalapeños", runSW(tDef, swSt({}, { stdVeggies: false })).every(r => inG(r, "veggies") === 0) && runSW(tDef, swSt({}, { stdVeggies: false }), null, ["jalapenos"]).every(r => swOpts(r).filter(o => o.group === "veggies").map(o => o.ing).join() === "jalapenos"), true);
check("Brot- und Sub-Chips: nur die gewählten (Italian/Honey Oat · Ham/Chicken Fajita)", (() => { const r = runSW(tDef, swSt({ breads: ["italian", "honey_oat"], subs: ["ham", "chicken_fajita"] })); return r.length > 0 && r.every(x => ["italian", "honey_oat"].includes(swOpts(x).find(o => o.group === "brot").ing) && ["ham", "chicken_fajita"].includes(swOpts(x).find(o => o.group === "sub").ing)); })(), true);
check("Ausschluss: Tomaten fehlen in den Standard-Veggies; Ham weder als Sub noch als Extra", runSW(tDef, stSW, ["tomaten"]).every(r => swOpts(r).filter(o => o.group === "veggies").length === 4 && !swOpts(r).some(o => o.ing === "tomaten")) && rSWmany.length > 0 && [tgt(90, 80, 20), tgt(40, 60, 12)].every(tt => runSW(tt, swSt({ maxExtras: 6 }), ["ham"]).every(r => !swOpts(r).some(o => o.ing === "ham"))), true);
check("Pflicht: Chipotle Southwest trotz „No sauce“ in jedem Sub; 3 Saucen bei 15-CM → conflict; Käse-Pflicht trotz „No cheese“", (() => { const a = runSW(tDef, stSW, null, ["chipotle_southwest"]); const b = runSW(tDef, stSW, null, ["chipotle_southwest", "sweet_onion", "ketchup"]); const c = runSW(tDef, stSW, null, ["cheddar"]); return a.length > 0 && a.every(r => swOpts(r).some(o => o.ing === "chipotle_southwest")) && b.length === 0 && b.conflict.length === 3 && c.length > 0 && c.every(r => r.side && r.side.ing === "cheddar"); })(), true);
check("Preislimit 9 €: Ergebnisse, keines teurer", (() => { const r = runSW({ ...tDef, maxPrice: 9 }); return r.length > 0 && r.every(x => x.price <= 9 + 1e-9); })(), true);
const X15 = (gid, name) => swOpt(SWS, gid, name);
const selBC = { parts: [{ opt: X15("brot", "Italian"), qty: 1 }, { opt: X15("sub", "Beef Chili + Extra Fleisch / Protein"), qty: 1 }, { opt: X15("extras", "Bacon"), qty: 1 }, ...STDV.map(id => ({ opt: swIng(SWS, "veggies", id), qty: 1 }))], side: null, dip: null, size: SWS.size, price: 0 };
check("Order Guide: Beef Chili → Deine Größe → Brot → Zubereitungsart → Käse „ohne Käse“ → Extras (Extra Fleisch zuerst) → Veggies", SW.orderSteps(selBC).map(x => x.l + ": " + x.v).join(" | ") === "Item: Beef Chili | Deine Größe: Beef Chili - 15-CM | Brot: Italian | Zubereitungsart: Getoastet or Ungetoastet (your choice) | Käse: ohne Käse | Extras: Extra Fleisch / Protein · Bacon | Veggies: Eisbergsalat · Tomaten · Rote Paprika · Rote Zwiebeln · Mais", true);
check("Order Guide Footlong: Ham ohne Käse-Schritt, Chicken Tandoori „Saucen: ohne Saucen“, ohne Veggies „ohne Veggies“", (() => {
check("Subway: keine Doppel-Anordnungen (Ham-Sub + Chicken Teriyaki = Chicken-Teriyaki-Sub + Ham → nur die günstigere)", (() => { const r = [tgt(40, 50, 10), tgt(45, 60, 12), tgt(60, 50, 15)].map(tt => runSW(tt, swSt({ subs: ["ham", "chicken_teriyaki"], maxExtras: 3 }))); return r.every(list => list.length > 0 && new Set(list.map(T.bowlSameKey)).size === list.length) && r.some(list => list.some(x => swOpts(x).some(o => o.group === "sub" && o.ing === "ham") && swOpts(x).some(o => o.group === "extras" && o.ing === "chicken_teriyaki"))) && r.every(list => !list.some(x => swOpts(x).some(o => o.group === "sub" && o.ing === "chicken_teriyaki" && !o.variant) && swOpts(x).some(o => o.group === "extras" && o.ing === "ham") && swOpts(x).filter(o => o.group === "extras").length === 1 && x.parts.length === 2 + 5)); })(), true);
// Veggies nachträglich im Detail-Panel (User 16.09.2026, wie „Salad“ im London-Tool)
check("subwaySetVeggies: gleiche Veggies → identische Nährwerte, Preis, Teile; key bleibt", [tDef, tgt(90, 120, 30)].flatMap(tt => [runSW(tt).slice(0, 4), runSW(tt, swSt({ size: "footlong" }, { noSauce: false })).slice(0, 4)]).flat().every(r => { const r2 = T.subwaySetVeggies(r, T.subwayVeggieIngs(r)); return r2 !== r && r2.key === r.key && JSON.stringify(r2.nutrition) === JSON.stringify(r.nutrition) && r2.price === r.price && r2.parts.map(pt => pt.opt.id + "x" + pt.qty).join() === r.parts.map(pt => pt.opt.id + "x" + pt.qty).join(); }), true);
check("subwaySetVeggies: Oliven + Jalapeños dazu, Tomaten weg → Nährwerte = Summe der Teile, Veggies in Wolt-Reihenfolge, Order Guide passt; alles weg → „ohne Veggies“", (() => {
  const r = runSW(tDef)[0], cur = T.subwayVeggieIngs(r);
  const r2 = T.subwaySetVeggies(r, [...cur.filter(x => x !== "tomaten"), "jalapenos", "oliven"]);
  const items = [...r2.parts.flatMap(pt => Array(pt.qty).fill(pt.opt)), r2.side, r2.dip].filter(Boolean);
  const exp = T.sumN(items, 1), veg = r2.parts.filter(pt => pt.opt.group === "veggies").map(pt => pt.opt.name).join(" · ");
  const r3 = T.subwaySetVeggies(r2, []);
  const vStep = sel => (SW.orderSteps(sel).find(x => x.l === "Veggies") || {}).v;
  const d = T.KEYS.every(k => Math.abs(r2.nutrition[k] - Math.round((r.nutrition[k] - swIng(SWS, "veggies", "tomaten")[k] + swIng(SWS, "veggies", "jalapenos")[k] + swIng(SWS, "veggies", "oliven")[k]) * 10) / 10) < 0.11);
  return JSON.stringify(r2.nutrition) === JSON.stringify(exp) && d && veg === "Eisbergsalat · Rote Paprika · Rote Zwiebeln · Schwarze Oliven · Jalapeños · Mais" && vStep(r2) === veg && vStep(r3) === "ohne Veggies" && r3.parts.every(pt => pt.opt.group !== "veggies") && r3.price === r.price
    && T.subwayVeggieIngs(T.subwaySetVeggies(r3, STDV)).slice().sort().join() === STDV.slice().sort().join() && JSON.stringify(T.subwaySetVeggies(r3, cur).nutrition) === JSON.stringify(r.nutrition);
})(), true);
check("subwaySetVeggies Footlong: nimmt die Footlong-Veggies (Werte ×2)", (() => { const r = runSW(tgt(100, 160, 35), swSt({ size: "footlong" }))[0]; const r2 = T.subwaySetVeggies(r, ["gurken"]); const v = r2.parts.filter(pt => pt.opt.group === "veggies").map(pt => pt.opt); return v.length === 1 && v[0].id === "fl_" + swIng(SWS, "veggies", "gurken").id && v[0].kcal === 2 * swIng(SWS, "veggies", "gurken").kcal && r2.size === r.size; })(), true);
  const XF = (gid, name) => swOpt(SWF, gid, name);
  const ham = SW.orderSteps({ parts: [{ opt: XF("brot", "Honey Oat"), qty: 1 }, { opt: XF("sub", "Ham"), qty: 1 }], side: null, dip: null, size: SWF.size });
  const tan = SW.orderSteps({ parts: [{ opt: XF("brot", "Sesam"), qty: 1 }, { opt: XF("sub", "Chicken Tandoori"), qty: 1 }], side: XF("kaese", "Cheddar"), dip: null, size: SWF.size });
  const v = (st1, l) => (st1.find(x => x.l === l) || {}).v;
  return v(ham, "Deine Größe") === "Ham - FOOTLONG (30-CM)" && v(ham, "Käse") === undefined && v(ham, "Saucen") === undefined && v(ham, "Veggies") === "ohne Veggies" && v(tan, "Saucen") === "ohne Saucen" && v(tan, "Käse") === "Cheddar";
})(), true);
check("Zusammenfassung: Sub zuerst („2× …“ bei Extra Fleisch), dann Brot, Käse, Extras, Saucen, Seasonings; Veggies nicht", T.subwaySummary({ ...selBC, side: X15("kaese", "Cheddar"), parts: [...selBC.parts, { opt: X15("saucen", "Ketchup"), qty: 1 }, { opt: X15("seasonings", "Röstzwiebeln"), qty: 1 }] }) === "2× Beef Chili + Italian + Cheddar + Bacon + Ketchup + Röstzwiebeln" && T.summarizeResult(SW, rSW[0]) === T.subwaySummary(rSW[0]), true);
check("Suche, Ausschluss, Pflicht: Such-Index je Größe („Italian (Brot, Footlong)“ 380 kcal), ohne Varianten/Garlic/0-Werte; Pflicht ohne Brot/Sub; Ausschluss mit Subs und Broten", (() => {
  const idx = T.SEARCH_INDEX.filter(x => x.resto === "Subway (Wolt)"), inc = T.includablesFor(SW), ex = T.excludablesFor(SW);
  return idx.some(x => x.name === "Italian (Brot, 15-CM)" && x.kcal === 190) && idx.some(x => x.name === "Italian (Brot, Footlong)" && x.kcal === 380) && idx.some(x => x.name === "Ham (sub protein, 15-CM)") && !idx.some(x => /Extra Fleisch|Garlic|Veggie Delite/.test(x.name))
    && !inc.some(x => ["base", "protein"].includes(x.role)) && inc.some(x => x.id === "salat" && x.name === "Eisbergsalat") && inc.find(x => x.id === "ham").role === "extra" && !inc.some(x => x.id === "garlic_herb")
    && ex.some(x => x.id === "italian") && ex.some(x => x.id === "veggie_delite") && new Set(ex.map(x => x.id)).size === ex.length && !ex.some(x => x.id === "garlic_herb");
})(), true);
check("All: Subway mit einem Treffer und Preis", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false); return a.filter(r => r._resto === "subway").length === 1 && a.every(r => typeof r.price === "number"); })(), true);
const swKeep = x => (T.bowlRole(x) !== "protein" || ["ham", "chicken_teriyaki", "pb_chicken_teriyaki", "chicken_fajita", "veggie_delite"].includes(x.ing)) && (T.bowlRole(x) !== "base" || ["italian", "honey_oat"].includes(x.ing)) && (x.group !== "saucen" || ["chipotle_southwest", "sweet_onion", "lite_mayonnaise", "balsamic_vinegar"].includes(x.ing));
const swExCases = [[SWS, tDef, "macros", {}, { cap: 1, maxExtras: 3, keep: swKeep, include: STDV }], [SWF, tgt(90, 150, 35), "macros", {}, { cap: 1, maxExtras: 3, keep: swKeep, include: STDV }], [SWF, kcalT(1100), "calories", { hp: true, lf: true }, { cap: 1, maxExtras: 2, keep: swKeep }], [SWS, kcalT(550), "calories", {}, { cap: 1, maxExtras: 3, keep: swKeep, include: ["ham", "scheibenkaese"] }], [SWS, tgt(50, 70, 25), "macros", {}, { cap: 1, maxExtras: 3, keep: swKeep, maxPrice: 12 }]];
let exSWr = 0;
for (const [mn, tt, md, pp, oo] of swExCases) if (sameTop(subRaw(mn, tt, md, pp, oo), exhaustiveSubway(mn, tt, md, pp, oo))) exSWr++;
check("Subway exakt: Top 30 = Durchrechnung je Sub (echte Daten, 15-CM + Footlong, Makro/Kalorien, Pflicht, Preislimit; 5 Fälle)", exSWr, swExCases.length);
check("Laufzeit: Standard (15-CM + Footlong) und Footlong mit Saucen + Käse + 6 Extras bleiben im Zeitbudget (kein approx)", !rSW.approx && !runSW(tgt(120, 170, 45), swSt({ size: "footlong" })).approx && !runSW(tgt(90, 160, 35), swSt({ size: "footlong", maxExtras: 6 }, { noSauce: false, noCheese: false })).approx && !runSW(kcalT(1200), swSt({ size: "footlong", maxExtras: 6 }, { noSauce: false, noCheese: false }), null, null, "calories", { hp: true }).approx, true);

// ── McDonald's (Wolt, à la carte) ──
sect("McDonald's (Wolt, à la carte)");
const MC = T.RESTO_BY_KEY.mcdonalds, MCD = T.MCDONALDS;
const rawMC = U.readJSON(__dirname + "/data/mcdonalds-raw.json");
const updMC = require("./mcdonalds-update.js");
const mcItem = name => MCD.items.find(x => x.name === name);
const mcSite = name => rawMC.products.find(p => p.listName === name);
check("Registry: McDonald's (Wolt) — à la carte, accurate, Schalter „No sauces & dressings“ Default AN, Desserts-Chip aus", !!MC && MC.kind === "ac" && MC.accurate === true && MC.platform === "Wolt" && MC.name === "McDonald's (Wolt)" && MC.switches.length === 1 && MC.switches[0].id === "noSauce" && MC.switches[0].def === true && MCD.cats.map(c => c.id + ":" + c.on).join() === "burger:true,mcwrap:true,nuggets:true,beilagen:true,desserts:false", true);
check("MCDONALDS-Block = mcdonalds-update.js(data/mcdonalds-raw.json) (Block aktuell)", JSON.stringify(updMC.buildData(rawMC)) === JSON.stringify({ cats: MCD.cats, items: MCD.items }), true);
check("74 bei Wolt bestellbare Produkte, jedes mit Wolt-Preis und offiziellen Werten der Website (Big Mac® 6,99 €, Hamburger 2,79 €)", MCD.items.length === 74 && MCD.items.every(x => typeof x.price === "number" && x.price > 0) && mcItem("Big Mac®").price === 6.99 && mcItem("Hamburger").price === 2.79 && T.KEYS.every(k => mcItem("Big Mac®")[k] === mcSite("Big Mac®").perServing[k]) && mcItem("Pommes Frites Groß").kcal === 463 && mcItem("9 Chicken McNuggets®").kcal === 401, true);
check("Zuordnung Wolt → Website (Filet-o-Fish®, McWrap® Chicken Sweet Chili, Chicken + Cheese Box, Frucht-Quatsch …) dokumentiert", rawMC._meta.mapping["Filet-o-Fish®"] === "Filet-O-Fish®" && rawMC._meta.mapping["Chicken + Cheese Box"] === "Chicken & Cheese Box" && rawMC._meta.mapping["McFlurry® Kitkat White mit Erdbeer Sauce"] === "McFlurry® KitKat® White Erdbeersauce" && !!mcItem("Filet-o-Fish®"), true);
check("Nicht im Tracker: Frühstück, Getränke, McMenüs, Happy Meals, Bundles, Mehrweg, Milchshakes; Mild Wasabi Sauce ohne offizielle Werte (dokumentiert)", !MCD.items.some(x => /McMenü|Happy Meal|Bundle|Mehrweg|Milchshake|Iced Coffee|McMuffin|Coca-Cola|Trio$/.test(x.name)) && rawMC._meta.noData.some(x => /Mild Wasabi Sauce/.test(x)) && rawMC._meta.skipped.some(x => /Mehrweg/.test(x)) && rawMC._meta.skipped.some(x => /Milchshake/.test(x)) && /Frühstück/.test(rawMC._meta.sources.nutrition.skippedCategories.fruehstueck), true);
check("Pflicht-Auswahlen bei Wolt → Order-Guide-Hinweis: Nuggets „Ohne Sauce“, Salate „Ohne Dressing“, McFlurry Mix & Match „Ohne Zutat“", mcItem("9 Chicken McNuggets®").orderNote === "Sauce 1/2, Sauce 2/2: Ohne Sauce" && mcItem("Big Chicken Salad").orderNote === "Dressing: Ohne Dressing" && mcItem("McFlurry® Original Mix & Match").orderNote === "Zutat (inklusive) 1/2, Zutat (inklusive) 2/2: Ohne Zutat" && !mcItem("Big Mac®").orderNote && mcSite("McFlurry® Original Mix & Match").name === "McFlurry (ohne Wahlzutat)", true);
check("Saucen, Dips und Dressings markiert (12, nur Beilagen & Extras), Burger/Pommes/McFlurry mit „Sauce“ im Namen nicht", MCD.items.filter(x => x.sauce).length === 12 && MCD.items.every(x => !x.sauce || x.cat === "beilagen") && mcItem("Ketchup 20ml").sauce && mcItem("Honig-Senf Dressing 50ml").sauce && !mcItem("Big Mac®").sauce && !mcItem("Pommes Frites Groß").sauce && !mcItem("McFlurry® Kitkat White mit Erdbeer Sauce").sauce, true);
check("_meta: Entscheidungen mit Datum, Schalentier/Koriander geprüft, Auffälligkeiten (Chickenburger kcal)", rawMC._meta.decisions.every(d => /^User 16[.]09[.]2026/.test(d)) && /kein Produkt/.test(rawMC._meta.shellfish) && /kein Tracker-Produkt/.test(rawMC._meta.dislikes) && rawMC._meta.anomalies.some(a => a.name === "Chickenburger"), true);
const stMC = T.defaultRestoState(MC);
const runMC = (t, st, ex, inc, mode, p) => T.runOptimize(MC, t, mode || "macros", p || {}, st || stMC, new Set(ex || []), new Set(inc || []));
const rMC = runMC(tDef);
check("Standard: keine Saucen und keine Desserts, höchstens 5 Produkte, Preis = Σ Wolt-Preise", rMC.length > 0 && rMC.every(r => r.items.length <= 5 && r.items.every(x => !x.sauce && x.cat !== "desserts") && Math.abs(r.price - Math.round(r.items.reduce((a, x) => a + x.price * 100, 0)) / 100) < 1e-9), true);
check("Must include Big Mac® + Pommes Frites Klein: in jeder Bestellung, zählen zu „Max. items“", (() => { const r = runMC(tDef, stMC, null, ["big_mac", "pommes_frites_klein"]); return r.length > 0 && r.every(x => x.items.some(y => y.id === "big_mac") && x.items.some(y => y.id === "pommes_frites_klein") && x.items.length <= 5); })(), true);
check("Must include geht an Desserts-Chip und Saucen-Schalter vorbei (McFlurry, Ketchup); Ausschluss wirkt", (() => { const r = runMC(tDef, stMC, ["big_mac"], ["mcflurry_original_mix_match", "ketchup_20ml"]); return r.length > 0 && r.every(x => x.items.some(y => y.id === "mcflurry_original_mix_match") && x.items.some(y => y.id === "ketchup_20ml") && x.items.every(y => y.id !== "big_mac")); })(), true);
check("Preislimit 8 € (max. 3 Produkte): Ergebnisse, keines teurer", (() => { const r = runMC({ ...tDef, maxPrice: 8 }, { ...stMC, maxN: 3 }); return r.length > 0 && r.every(x => x.price <= 8 + 1e-9 && x.items.length <= 3); })(), true);
check("No sauces & dressings AUS: Saucen möglich", runMC(tgt(30, 60, 40), { ...stMC, sw: { noSauce: false } }).some(r => r.items.some(x => x.sauce)), true);
check("Order Guide mit Hinweis („1× 9 Chicken McNuggets® — Sauce 1/2, Sauce 2/2: Ohne Sauce“), Suche + All mit Preis", (() => { const st1 = T.orderStepsFor(MC, { items: [mcItem("9 Chicken McNuggets®"), mcItem("Big Mac®")] }); const a = T.optimizeAll(tDef, "macros", {}, 5, false); return st1[0].v === "9 Chicken McNuggets® — Sauce 1/2, Sauce 2/2: Ohne Sauce" && st1[1].v === "Big Mac®" && T.SEARCH_INDEX.some(x => x.resto === "McDonald's (Wolt)" && x.name === "Big Mac®") && a.filter(r => r._resto === "mcdonalds").length === 1 && typeof a.find(r => r._resto === "mcdonalds").price === "number"; })(), true);

// ── Chidoba (Wolt, Cup + Salat) ──
sect("Chidoba (Wolt, Cup + Salat)");
const CH = T.RESTO_BY_KEY.chidoba, CHD = T.CHIDOBA;
const rawCH = U.readJSON(__dirname + "/data/chidoba-raw.json");
const updCH = require("./chidoba-update.js");
const chG = (menu, gid) => menu.groups.find(g => g.id === gid) || { options: [] };
const chOpt = (menu, gid, name) => chG(menu, gid).options.find(o => o.name === name);
const chFix = (menu, ing) => menu.fixed.find(f => f.ing === ing);
check("Registry: Chidoba (Wolt) — BYO, accurate, Listen unter „chidoba“, Schalter „No sauce/cheese/dips“ AN + „Add Chili con carne“ AUS (allow)", !!CH && CH.kind === "byo" && CH.accurate === true && CH.platform === "Wolt" && CH.exclusionKey === "chidoba" && CH.switches.map(x => x.id + ":" + x.def).join() === "noSauce:true,addChili:false" && typeof CH.switches[1].allow === "function", true);
check("CHIDOBA-Block = chidoba-update.js(data/chidoba-raw.json) — Cup + Salat (Block aktuell)", ["cup", "salat"].every(tp => { const m = updCH.buildMenu(rawCH, tp); return JSON.stringify(m.groups) === JSON.stringify(CHD[tp].groups) && JSON.stringify(m.fixed) === JSON.stringify(CHD[tp].fixed) && JSON.stringify(m.removals) === JSON.stringify(CHD[tp].removals); }), true);
const valCH = T.chidobaValidate();
if (valCH.length) console.log(valCH.join("\n"));
check("chidobaValidate ohne Probleme", valCH.length, 0);
check("Produkte laut Wolt Kaiserstraße: 4 Cups (Chicken/Beef 14,49 €, Filetsteak 16,99 €, Barbacoa 15,99 €), 3 Salate (15,69/15,69/18,49 €); Chili con Carne 8,49 €", chG(CHD.cup, "produkt").options.map(o => o.name + " " + o.price).sort().join("|") === "Barbacoa Cup 15.99|Beef Cup 14.49|Chicken Cup 14.49|Filetsteak Cup 16.99" && chG(CHD.salat, "produkt").options.map(o => o.name + " " + o.price).sort().join("|") === "Beef Salat 15.69|Chicken Salat 15.69|Filetsteak Salat 18.49" && chOpt(CHD.cup, "chili", "Chili con Carne").price === 8.49 && /Kaiserstraße/.test(rawCH._meta.sources.wolt.name), true);
check("Nicht im Tracker: Veggie, Vegan und Planted Chicken (rohe Paprika & Zwiebeln ohne Werte); Korianderreis/Cilantro (Koriander); Chili Cream, Jalapeños … ohne Werte; Salsa Medium/Scharf = Mild", rawCH._meta.productNoData.length === 6 && ["Veggie Cup", "Vegan Salat", "Planted Chicken Cup"].every(n => rawCH._meta.productNoData.some(x => x.startsWith(n))) && rawCH._meta.never.some(x => /Korianderreis/.test(x)) && ["Chili Creme", "Jalapeños", "Habanero Sauce", "Tabasco", "Tortilla Strips"].every(n => rawCH._meta.noData.some(x => x.includes(n))) && rawCH._meta.sameValues.length === 2 && ![CHD.cup, CHD.salat].some(m => m.groups.some(g => g.options.some(o => /Koriander|Cilantro|Jalape|Medium|Scharf|Planted|Veggie|Vegan/.test(o.name)))), true);
check("Cup: Basis Gewürzreis/Cubes (+ „Ohne Basis“), abwählbar nur Black Beans, fest gegrillte Paprika & rote Zwiebeln/Eisbergsalat/Limette/Cheddar Jack Cheese (Käse = sauce)", chG(CHD.cup, "basis").options.map(o => o.name).join() === "Gewürzreis,Cubes" && chG(CHD.cup, "basis").none === "Ohne Basis" && chG(CHD.cup, "zutaten").options.map(o => o.name).join() === "Black Beans" && CHD.cup.fixed.map(f => f.ing).join() === "gegrilltes_gemuese,eisbergsalat,cheddar_jack_cheese,limette" && chFix(CHD.cup, "cheddar_jack_cheese").sauce === true && chFix(CHD.cup, "limette").removeName === "Ohne Limette", true);
check("Salat: Salat-Basis fest, California Dressing fest (sauce), Tortilla Strips immer abgewählt, keine Cheesesauce (Salat-Rechner ohne Wert)", CHD.salat.fixed[0].ing === "salatbasis" && CHD.salat.fixed[0].kcal === 39 && chFix(CHD.salat, "california_dressing").sauce === true && CHD.salat.removals.join() === "Ohne Tortilla Strips" && !chOpt(CHD.salat, "extras", "Cheesesauce") && !!chOpt(CHD.cup, "extras", "Cheesesauce") && !chG(CHD.salat, "basis").options.length, true);
check("Werte je Produktart laut Rechner: Chicken Cup = Chicken 116,8 kcal / 19,6 g P; Salz = Natrium × 2,5; Barbacoa Cup 144 vs. Barbacoa-Extra im Salat 177,6 kcal (Auffälligkeit dokumentiert)", chOpt(CHD.cup, "produkt", "Chicken Cup").kcal === 116.8 && chOpt(CHD.cup, "produkt", "Chicken Cup").protein === 19.6 && Math.abs(chOpt(CHD.cup, "produkt", "Chicken Cup").salt - 0.566) < 1e-9 && chOpt(CHD.cup, "produkt", "Barbacoa Cup").kcal === 144 && chOpt(CHD.salat, "extras", "Barbacoa").kcal === 177.6 && rawCH._meta.anomalies.some(a => /Cup ↔ Salat/.test(a.name)) && rawCH._meta.anomalies.some(a => /Chili con Carne/.test(a.name)), true);
check("_meta: Entscheidungen mit Datum, Koriander-Hinweise (frischer Koriander in Salsa + Guacamole), kein Schalentier", rawCH._meta.decisions.length === 8 && rawCH._meta.decisions.every(d => /^User 16[.]09[.]2026/.test(d)) && rawCH._meta.decisions.some(d => /Limette/.test(d)) && rawCH._meta.decisions.some(d => /Salsa Mild und Medium/.test(d)) && rawCH._meta.coriander.some(x => /Salsa Mild oder Medium: frischer Koriander/.test(x)) && rawCH._meta.coriander.some(x => /Guacamole: frischer Koriander/.test(x)) && /kein Baustein/.test(rawCH._meta.shellfish), true);
const stCH = T.defaultRestoState(CH);
const chSt = (extra, sw) => ({ ...stCH, extra: { ...stCH.extra, ...(extra || {}) }, sw: { ...stCH.sw, ...(sw || {}) } });
const runCH = (t, st, ex, inc, mode, p) => T.runOptimize(CH, t, mode || "macros", p || {}, st || stCH, new Set(ex || []), new Set(inc || []));
const chOpts = r => [...r.parts.map(pt => pt.opt), r.side, r.dip].filter(Boolean);
const chPrice = r => Math.round(chOpts(r).reduce((a, o) => a + o.price * 100, 0)) / 100;
const rCH = runCH(tDef);
check("Defaults: Cup & Salat, max. 5 Extras; No sauce/cheese/dips AN, Add Chili con carne AUS", stCH.extra.types.length === 0 && stCH.extra.maxExtras === 5 && stCH.sw.noSauce === true && stCH.sw.addChili === false, true);
check("Standard: genau 1 Produkt, keine Sauce/kein Käse/kein Chili, Käse und Limette abgewählt („Ohne …“), übrige Standard-Zutaten dabei, Preis = Σ", rCH.length > 0 && rCH.every(r => r.parts.filter(pt => pt.opt.group === "produkt").length === 1 && chOpts(r).every(o => !o.sauce && o.group !== "chili") && r.removed.includes("Ohne Cheddar Jack Cheese") && r.removed.includes("Ohne Limette") && !r.fixed.some(f => f.ing === "cheddar_jack_cheese" || f.ing === "limette") && r.fixed.some(f => f.ing === "gegrilltes_gemuese") && Math.abs(r.price - chPrice(r)) < 1e-9), true);
check("Limette standardmäßig raus (User 16.09.2026): Datenflag nur bei Limette; als Pflicht bleibt sie (kein „Ohne Limette“); nicht in der Ausschluss-Liste, aber als Pflicht wählbar", ["cup", "salat"].every(tp => CHD[tp].fixed.filter(f => f.defaultOff).map(f => f.ing).join() === "limette") && (() => { const r = runCH(tDef, stCH, null, ["limette"]); return r.length > 0 && r.every(x => x.fixed.some(f => f.ing === "limette") && !x.removed.includes("Ohne Limette")); })() && !T.excludablesFor(CH).some(x => x.id === "limette") && T.includablesFor(CH).some(x => x.id === "limette" && x.role === "fixed"), true);
check("Salsa Mild/Medium bei „No sauce/cheese/dips“ erlaubt (User 16.09.2026): Salsa ohne sauce-Flag, Sour Cream/Guacamole/Cheesesauce/Extra-Käse weiter gefiltert; Bestellname „Mild or Medium (your choice)“", (() => { const pass = T.switchPass(CH, stCH); const sal = chOpt(CHD.cup, "salsa", "Mild"); return pass(sal) && !sal.sauce && sal.short === "Salsa Mild/Medium" && sal.orderName === "Mild or Medium (your choice)" && ["cream", "extras"].every(g => chG(CHD.cup, g).options.filter(o => /Sour Cream|Guacamole|Cheesesauce|Cheddar/.test(o.name)).every(o => !pass(o))) && runCH(tgt(60, 70, 18)).some(r => chOpts(r).some(o => o.group === "salsa")); })(), true);
check("keine Doppel-Anordnungen (Chicken Cup + Beef = Beef Cup + Chicken): Schlüssel eindeutig, günstigste bleibt", [tDef, tgt(80, 60, 25), tgt(100, 90, 30)].every(tt => { const r = runCH(tt); return r.length > 0 && new Set(r.map(T.bowlSameKey)).size === r.length; }), true);
check("Add Chili con carne: AUS nie, AN möglich (höchstens 1×), Pflicht geht am Schalter vorbei", (() => { const tt = tgt(100, 140, 35); const off = runCH(tt), on = runCH(tt, chSt({}, { addChili: true })), pick = runCH(tDef, stCH, null, ["chili_con_carne"]); return off.every(r => !chOpts(r).some(o => o.group === "chili")) && on.some(r => chOpts(r).some(o => o.group === "chili")) && on.every(r => chOpts(r).filter(o => o.group === "chili").length <= 1) && pick.length > 0 && pick.every(r => chOpts(r).some(o => o.group === "chili")); })(), true);
check("No sauce/cheese/dips AUS: Käse (und im Salat California Dressing) bleiben Standard, Sour Cream/Salsa möglich", (() => { const r = runCH(tgt(55, 60, 40), chSt({}, { noSauce: false })); return r.length > 0 && r.every(x => x.fixed.some(f => f.ing === "cheddar_jack_cheese") && !x.removed.includes("Ohne Cheddar Jack Cheese") && (x.type !== "salat" || x.fixed.some(f => f.ing === "california_dressing"))) && r.some(x => chOpts(x).some(o => o.group === "cream" || o.group === "salsa")); })(), true);
check("Pflicht Cheddar Jack Cheese bei „No sauce“ AN: Standard-Käse bleibt (kein erzwungener Extra-Käse); Pflicht Guacamole in jeder Bestellung", (() => { const r = runCH(tDef, stCH, null, ["cheddar_jack_cheese", "guacamole"]); return r.length > 0 && r.every(x => x.fixed.some(f => f.ing === "cheddar_jack_cheese") && chOpts(x).some(o => o.ing === "guacamole")) && r.some(x => !chOpts(x).some(o => o.group === "extras" && o.ing === "cheddar_jack_cheese")); })(), true);
check("Produkt-Chip Salat: nur Salate, „Ohne California Dressing“ + „Ohne Tortilla Strips“; Pflicht Gewürzreis → nur Cups", (() => { const s1 = runCH(tDef, chSt({ types: ["salat"] })); const c1 = runCH(tDef, stCH, null, ["gewuerzreis"]); return s1.length > 0 && s1.every(x => x.type === "salat" && x.removed.includes("Ohne California Dressing") && x.removed.includes("Ohne Tortilla Strips")) && c1.length > 0 && c1.every(x => x.type === "cup" && x.side && x.side.ing === "gewuerzreis"); })(), true);
check("Ausschluss: Eisbergsalat → „Ohne Eisbergsalat“ (nur Cup); Chicken → weder Chicken Cup/Salat noch Chicken-Extra", (() => { const r = runCH(tDef, stCH, ["eisbergsalat"]); return r.length > 0 && r.every(x => x.type === "salat" || (x.removed.includes("Ohne Eisbergsalat") && !x.fixed.some(f => f.ing === "eisbergsalat"))); })() && runCH(tgt(90, 70, 25), chSt({ maxExtras: 6 }), ["chicken"]).every(r => !chOpts(r).some(o => o.ing === "chicken")), true);
check("Preislimit 20 €: Ergebnisse, keines teurer", (() => { const r = runCH({ ...tDef, maxPrice: 20 }); return r.length > 0 && r.every(x => x.price <= 20 + 1e-9); })(), true);
const selCH = { type: "cup", parts: [{ opt: chOpt(CHD.cup, "produkt", "Beef Cup"), qty: 1 }, { opt: chOpt(CHD.cup, "extras", "Chicken"), qty: 1 }, { opt: chOpt(CHD.cup, "chili", "Chili con Carne"), qty: 1 }], side: chOpt(CHD.cup, "basis", "Gewürzreis"), dip: null, fixed: CHD.cup.fixed.filter(f => f.ing !== "cheddar_jack_cheese"), removed: ["Ohne Cheddar Jack Cheese"], price: 0, nutrition: {} };
check("Order Guide: Artikel → Deine Basis → Wähle deine Zutaten („Ohne Black Beans · Ohne Cheddar Jack Cheese“) → Cream/Salsa „Ohne …“ → Extras → Snack als 2. Artikel", CH.orderSteps(selCH).map(x => x.l + ": " + x.v).join(" | ") === "Item: Beef Cup | Deine Basis: Gewürzreis | Wähle deine Zutaten: Ohne Black Beans · Ohne Cheddar Jack Cheese | Deine Cream: Ohne Creme | Deine Salsa: Ohne Salsa | Deine Extras: Chicken | Snacks (2nd item): Chili con Carne", true);
check("Order Guide Salat: ohne Basis-Schritt, „Deine Soße: Ohne Cream“, Tortilla Strips + Dressing abgewählt", (() => { const sel = { type: "salat", parts: [{ opt: chOpt(CHD.salat, "produkt", "Chicken Salat"), qty: 1 }, { opt: chOpt(CHD.salat, "zutaten", "Black Beans"), qty: 1 }], side: null, dip: null, fixed: [], removed: ["Ohne Cheddar Jack Cheese", "Ohne California Dressing", "Ohne Tortilla Strips"], price: 0, nutrition: {} }; const st1 = CH.orderSteps(sel); const v = l => (st1.find(x => x.l === l) || {}).v; return v("Deine Basis") === undefined && v("Wähle deine Zutaten") === "Ohne Cheddar Jack Cheese · Ohne Tortilla Strips · Ohne California Dressing" && v("Deine Soße") === "Ohne Cream"; })(), true);
check("Order Guide wie das Wolt-Bestellfenster (User 16.09.2026): „Ohne …“ in Fenster-Reihenfolge (Cup: Black Beans, Paprika & Zwiebeln, Eisbergsalat, Cheddar, Limette · Salat: … Limette, Tortilla Strips, California Dressing), Salsa „Mild or Medium (your choice)“", (() => {
  const cupOrder = "Ohne Black Beans,Ohne gegrillte Paprika & rote Zwiebeln,Ohne Eisbergsalat,Ohne Cheddar Jack Cheese,Ohne Limette", salOrder = "Ohne Black Beans,Ohne gegrillte Paprika & rote Zwiebeln,Ohne Cheddar Jack Cheese,Ohne Limette,Ohne Tortilla Strips,Ohne California Dressing";
  const sel = { type: "cup", parts: [{ opt: chOpt(CHD.cup, "produkt", "Chicken Cup"), qty: 1 }, { opt: chOpt(CHD.cup, "salsa", "Mild"), qty: 1 }], side: null, dip: null, fixed: [], removed: ["Ohne Limette", "Ohne Eisbergsalat", "Ohne Cheddar Jack Cheese"], price: 0, nutrition: {} };
  const st1 = CH.orderSteps(sel), v = l => (st1.find(x => x.l === l) || {}).v;
  return CHD.cup.ohneOrder.join() === cupOrder && CHD.salat.ohneOrder.join() === salOrder && v("Wähle deine Zutaten") === "Ohne Black Beans · Ohne Eisbergsalat · Ohne Cheddar Jack Cheese · Ohne Limette" && v("Deine Salsa") === "Mild or Medium (your choice)" && v("Deine Basis") === "Ohne Basis" && v("Deine Cream") === "Ohne Creme"
    && rawCH._meta.noData.some(x => x.includes("„Chili con Carne“ (Deine Extras, +1,69 €)")) && rawCH._meta.noData.some(x => x.includes("„Jalapeños“ (Deine Extras, +0,89 €)")) && rawCH._meta.noData.some(x => x.includes("„Planted Chicken“ (Deine Extras, +3,99 €)"));
})(), true);
check("Zusammenfassung + Suche + Listen: „Beef Cup + Gewürzreis + Chicken + Chili con Carne“; Suche mit Produktart; Pflicht/Ausschluss ohne Salat-Basis", T.chidobaSummary(selCH) === "Beef Cup + Gewürzreis + Chicken + Chili con Carne" && T.SEARCH_INDEX.some(x => x.resto === "Chidoba (Wolt)" && x.name === "Chicken (Cup protein)" && x.kcal === 116.8) && T.SEARCH_INDEX.some(x => x.resto === "Chidoba (Wolt)" && x.name === "Chili con Carne (Snack)") && !T.includablesFor(CH).some(x => x.id === "salatbasis") && T.includablesFor(CH).find(x => x.id === "chicken").role === "protein" && T.excludablesFor(CH).some(x => x.id === "eisbergsalat") && T.excludablesFor(CH).every(x => x.defaultOff === undefined && x.role === undefined) && new Set(T.excludablesFor(CH).map(x => x.id)).size === T.excludablesFor(CH).length, true);
check("All: Chidoba mit einem Treffer und Preis", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false); return a.filter(r => r._resto === "chidoba").length === 1 && typeof a.find(r => r._resto === "chidoba").price === "number"; })(), true);
// Exaktheit: je Produktart vorbereitetes Menü vollständig durchrechnen, Ranglisten mischen
const chRaw = (menus, tt, md, pp, oo) => T.chidobaCombos(menus, tt, md, pp, Object.assign({ maxMs: Infinity }, oo, { raw: true })).map(r => r.rawScore);
const chEx = (menus, tt, md, pp, oo) => menus.flatMap(m => exhaustiveBowl(m, tt, md, pp, Object.assign({}, oo, { include: oo.includeFor ? oo.includeFor(m) : oo.include }))).sort((a, b) => a - b).slice(0, 30);
const chPass = st => T.switchPass(CH, st);
const chCases = [[["cup", "salat"], tDef, "macros", {}, stCH, []], [["cup", "salat"], kcalT(750), "calories", { hp: true, lf: true }, chSt({}, { addChili: true }), []], [["cup"], tgt(70, 100, 40), "macros", {}, chSt({}, { noSauce: false }), ["guacamole"]], [["salat"], kcalT(550), "calories", {}, stCH, ["black_beans"]], [["cup", "salat"], tgt(90, 120, 30), "macros", {}, chSt({}, { addChili: true }), ["chili_con_carne"]]];
let exCH = 0;
for (const [types, tt, md, pp, st, inc] of chCases) {
  const picks = new Set(inc), menus = types.map(tp => T.chidobaMenu(tp, st.sw, null, picks)), pass = chPass(st);
  const oo = { cap: 1, maxExtras: 3, includeFor: m => inc.filter(id => !m.fixed.some(f => f.ing === id)), keep: x => picks.has(x.ing) || pass(x) };
  if (sameTop(chRaw(menus, tt, md, pp, oo), chEx(menus, tt, md, pp, oo))) exCH++;
}
check("Chidoba exakt: Top 30 = vollständige Durchrechnung je Produktart (Schalter, Chili, Pflicht; 5 Fälle)", exCH, chCases.length);
check("Laufzeit: Standard und mit Saucen + Chili + 6 Extras im Zeitbudget (kein approx)", !rCH.approx && !runCH(tgt(120, 170, 50), chSt({ maxExtras: 6 }, { noSauce: false, addChili: true })).approx && !runCH(kcalT(1300), chSt({ maxExtras: 6 }, { noSauce: false, addChili: true }), null, null, "calories", { hp: true }).approx, true);

// ── Lorys Gymfood (Wolt, à la carte) ──
sect("Lorys Gymfood (Wolt, à la carte)");
const LY = T.RESTO_BY_KEY.lorys, LYD = T.LORYS;
const rawLY = U.readJSON(__dirname + "/data/lorys-raw.json");
const updLY = require("./lorys-update.js"), crawlLY = require("./lorys-crawl.js");
const lyItem = name => LYD.items.find(x => x.name === name);
const lySite = name => rawLY.site.find(p => p.name === name);
check("Registry: Lorys Gymfood (Wolt) — à la carte, accurate, keine Schalter, Kategorien Bowls/Wraps/Burger/Beilagen (alle an)", !!LY && LY.kind === "ac" && LY.accurate === true && LY.platform === "Wolt" && LY.name === "Lorys Gymfood (Wolt)" && LY.switches.length === 0 && LYD.cats.map(c => c.id + ":" + c.on).join() === "bowls:true,wraps:true,burger:true,beilagen:true" && /standard choice/.test(LY.note) && /fibre, sugar, saturated fat and salt show as 0/.test(LY.note), true);
check("LORYS-Block = lorys-update.js(data/lorys-raw.json) (Block aktuell)", JSON.stringify(updLY.buildData(rawLY)) === JSON.stringify({ cats: LYD.cats, items: LYD.items }), true);
check("Website-Parser: „Kcal … | KH … | E … | F …“ in beliebiger Reihenfolge und Schreibweise; fehlende/doppelte/unbekannte Angaben → Fehler; Wolt-Beschreibung „kcal: … Kh:/C: … E:/P: … F: …“", (() => {
  const a = crawlLY.parseSiteMacros("Tortilla-Wrap\n\nKCAL 575 | KH 49 | E 42 | F 24"), b = crawlLY.parseSiteMacros("Eier\n\nKcal 470 | KH 43 | F 26 | E 24");
  return a.values.kcal === 575 && a.values.carbs === 49 && a.values.protein === 42 && a.values.fat === 24 && b.values.fat === 26 && b.values.protein === 24
    && /fehlt/.test(crawlLY.parseSiteMacros("Kcal 1 | KH 2 | E 3").error) && /doppelt/.test(crawlLY.parseSiteMacros("Kcal 1 | KH 2 | E 3 | E 4").error) && /unbekannt/.test(crawlLY.parseSiteMacros("Kcal 1 | KH 2 | E 3 | Z 4").error) && /keine/.test(crawlLY.parseSiteMacros("nur Text").error)
    && JSON.stringify(crawlLY.parseWoltMacros("… kcal: 688 C: 61 P: 30 F: 35")) === JSON.stringify({ kcal: 688, carbs: 61, protein: 30, fat: 35 }) && crawlLY.parseWoltMacros("Hausgemachter Hummus") === null;
})(), true);
check("17 Gerichte im Tracker (20 bei Wolt; Spicy Gurkensalat, Hummus, Bulking Beef Burger gesperrt) mit Wolt-Preis und Website-Werten (Standard-Auswahl): High Protein Chicken Bowl 17,90 € · 732 kcal / 60 KH / 69 E / 23 F; Chicken Wrap 11,90 €; Plant Based Protein Bowl 12,90 €", LYD.items.length === 17 && rawLY.wolt.items.length === 20 && LYD.items.every(x => typeof x.price === "number" && x.price > 0) && (() => { const b = lyItem("High Protein Chicken Bowl"); return b.price === 17.9 && b.kcal === 732 && b.carbs === 60 && b.protein === 69 && b.fat === 23; })() && lyItem("High Protein Chicken Wrap").price === 11.9 && lyItem("Plant Based Protein Bowl").price === 12.9 && LYD.items.every(x => ["kcal", "carbs", "protein", "fat"].every(k => x[k] === lySite(rawLY.wolt.items.find(w => w.name === x.name).siteName).perServing[k])), true);
check("Nicht angegeben (nur kcal/KH/E/F auf der Website): gesättigte Fettsäuren, Zucker, Ballaststoffe, Salz = 0 und dokumentiert", LYD.items.every(x => x.sat === 0 && x.sugars === 0 && x.fibre === 0 && x.salt === 0) && rawLY._meta.notDeclared.join() === "sat,sugars,fibre,salt" && /nur kcal, Kohlenhydrate, Eiweiß und Fett/.test(rawLY._meta.basis), true);
check("Pflicht-Auswahlen bei Wolt → Standard-Option im Order Guide: Chicken Bowl Sesam-Miso-Sauce, Farmers Bowl Rindfleisch 200g, alle Burger Brioche Bun; optionale Add-ons nicht vorbelegt (im Wolt-UI geprüft)", lyItem("High Protein Chicken Bowl").orderNote === "Sauce nach Wahl (Hühnchen-Bowl): Lorys Sesam-Miso-Sauce" && lyItem("Lorys Farmers Bowl").orderNote === "Proteinauswahl (Lorys Farmers Bowl): Rindfleisch 200g" && LYD.items.filter(x => x.cat === "burger").every(x => x.orderNote === "Bun Type: Brioche Bun") && LYD.items.filter(x => x.orderNote).length === 5 && rawLY._meta.checks.some(c => /Plant Based Protein Bowl.*12,90 €/.test(c)), true);
check("Zuordnung Wolt → Website: Pommes Frites = „Pommes Frites inkl. Dip“ (580 kcal), Süßkartoffelpommes = „Süßkartoffel Pommes inkl. Dip“; Hinweis „inkl. Dip“ dokumentiert", rawLY._meta.mapping["Pommes Frites"] === "Pommes Frites inkl. Dip" && rawLY._meta.mapping["Süßkartoffelpommes"] === "Süßkartoffel Pommes inkl. Dip" && lyItem("Pommes Frites").kcal === 580 && rawLY._meta.notes.length === 2 && rawLY._meta.notes.every(n => /inkl\. Dip/.test(n)), true);
check("Gesperrt (User 16./17.09.2026): Spicy Gurkensalat, Hausgemachter Hummus, Bulking Beef Burger — im Datensatz mit Grund, nicht im Block, nicht in Suche/Listen, Hinweis in der App; Auffälligkeiten bleiben dokumentiert", (() => { const names = ["Spicy Gurkensalat", "Hausgemachter Hummus", "Bulking Beef Burger"]; return names.every(n => { const w = rawLY.wolt.items.find(x => x.name === n); return !!w && /passen nicht zu/.test(w.blocked) && rawLY._meta.blocked.some(b => b.startsWith(n + " — ")) && !LYD.items.some(x => x.name === n) && !T.SEARCH_INDEX.some(x => x.name === n) && !T.includablesFor(LY).some(x => x.name === n) && LY.note.includes(n) && rawLY._meta.anomalies.some(a => a.name === n); }) && rawLY._meta.blocked.length === 3 && /101 kcal passen nicht zu 23 g Fett/.test(rawLY.wolt.items.find(x => x.name === "Spicy Gurkensalat").blocked) && rawLY._meta.decisions.some(d => /Hausgemachter Hummus und Bulking Beef Burger sperren/.test(d)); })(), true);
check("Nicht im Tracker: Breakfast, Shakes/Smoothies, Getränke (User 16.09.2026) — dokumentiert, kein solches Produkt im Block", ["BREAKFAST", "SHAKES", "Protein Shakes/Smoothies", "Alkoholfreie Getränke"].every(n => rawLY._meta.skipped.some(x => x.includes(n))) && !LYD.items.some(x => /Shake|Smoothie|Pancake|Stulle|Eggs|Kola|Wasser/i.test(x.name)) && rawLY._meta.notOnWolt.length === 0, true);
check("_meta: Entscheidungen mit Datum; Auffälligkeiten (Spicy Gurkensalat, Hummus, Bulking Beef Burger) und Wolt-Beschreibung ≠ Website bei 5 Gerichten (Farmers Bowl 1154 vs. 854 kcal); Schalentier/Koriander geprüft", rawLY._meta.decisions.length === 5 && rawLY._meta.decisions.every(d => /^User 1[67][.]09[.]2026/.test(d)) && ["Spicy Gurkensalat", "Hausgemachter Hummus", "Bulking Beef Burger"].every(n => rawLY._meta.anomalies.some(a => a.name === n)) && rawLY._meta.anomalies.some(a => a.name === "Wolt-Beschreibung ≠ Website" && /bei 5 Gerichten/.test(a.issues[0]) && /Lorys Farmers Bowl: Website 1154\/58\/91\/73 · Wolt-Beschreibung 854\/58\/49\/73/.test(a.issues[0])) && /Thunfisch, Lachs = Fisch/.test(rawLY._meta.shellfish) && /kein Tracker-Produkt/.test(rawLY._meta.dislikes), true);
const stLY = T.defaultRestoState(LY);
const runLY = (t, st, ex, inc, mode, p) => T.runOptimize(LY, t, mode || "macros", p || {}, st || stLY, new Set(ex || []), new Set(inc || []));
const rLY = runLY(tDef);
check("Standard: Ergebnisse aus allen vier Kategorien möglich, höchstens 5 Gerichte, Preis = Σ Wolt-Preise; bestes Ergebnis Chicken Wrap + Rote Beete Salat (748 kcal, 16,40 €)", rLY.length > 0 && rLY.every(r => r.items.length <= 5 && Math.abs(r.price - Math.round(r.items.reduce((a, x) => a + x.price * 100, 0)) / 100) < 1e-9) && T.summarizeResult(LY, rLY[0]) === "High Protein Chicken Wrap + Lorys Rote Beete Salat" && rLY[0].nutrition.kcal === 748 && rLY[0].price === 16.4, true);
check("Must include Pure Beef Burger: in jeder Bestellung; Ausschluss Chicken Wrap wirkt", (() => { const r = runLY(tDef, stLY, ["high_protein_chicken_wrap"], ["pure_beef_burger"]); return r.length > 0 && r.every(x => x.items.some(y => y.id === "pure_beef_burger") && !x.items.some(y => y.id === "high_protein_chicken_wrap")); })(), true);
check("Preislimit 15 €: Ergebnisse, keines teurer; Kategorie Burger aus → keine Burger", (() => { const r = runLY({ ...tDef, maxPrice: 15 }); const nb = runLY(tgt(60, 60, 45), { ...stLY, cats: { ...stLY.cats, burger: false } }); return r.length > 0 && r.every(x => x.price <= 15 + 1e-9) && nb.length > 0 && nb.every(x => x.items.every(y => y.cat !== "burger")); })(), true);
check("Order Guide mit Standard-Auswahl („1× High Protein Chicken Bowl — Sauce nach Wahl (Hühnchen-Bowl): Lorys Sesam-Miso-Sauce“), Suche + Listen + All mit Preis", (() => { const st1 = T.orderStepsFor(LY, { items: [lyItem("High Protein Chicken Bowl"), lyItem("Pure Beef Burger")] }); const a = T.optimizeAll(tDef, "macros", {}, 5, false); return st1[0].v === "High Protein Chicken Bowl — Sauce nach Wahl (Hühnchen-Bowl): Lorys Sesam-Miso-Sauce" && st1[1].v === "Pure Beef Burger — Bun Type: Brioche Bun" && T.SEARCH_INDEX.filter(x => x.resto === "Lorys Gymfood (Wolt)").length === 17 && T.includablesFor(LY).length === 17 && T.excludablesFor(LY).length === 17 && a.filter(r => r._resto === "lorys").length === 1 && typeof a.find(r => r._resto === "lorys").price === "number"; })(), true);

// ── Die gruene Kaffeebohne (Wolt, à la carte mit Varianten) ──
sect("Die gruene Kaffeebohne (Wolt, à la carte mit Varianten)");
const KB = T.RESTO_BY_KEY.kaffeebohne, KBD = T.KAFFEEBOHNE;
const rawKB = U.readJSON(__dirname + "/data/kaffeebohne-raw.json");
const updKB = require("./kaffeebohne-update.js"), crawlKB = require("./kaffeebohne-crawl.js");
const kbProd = name => rawKB.wolt.products.find(p => p.name === name);
const kbItem = id => KBD.items.find(x => x.id === id);
check("Registry: Die gruene Kaffeebohne (Wolt) — à la carte, accurate, keine Schalter, Kategorien Balance/High Protein Bowls + Bagels (alle an; Low Carb ohne Gericht → kein Chip)", !!KB && KB.kind === "ac" && KB.accurate === true && KB.platform === "Wolt" && KB.name === "Die gruene Kaffeebohne (Wolt)" && KB.switches.length === 0 && KBD.cats.map(c => c.id + ":" + c.on).join() === "balance:true,highprotein:true,bagels:true" && /low-carb salads and the Salat Mix option/.test(KB.note) && /dip, which has no values/.test(KB.note) && /Lean Super Salad, Vital Boost Bowl, Classic Bowl/.test(KB.note), true);
check("KAFFEEBOHNE-Block = kaffeebohne-update.js(data/kaffeebohne-raw.json) (Block aktuell)", JSON.stringify(updKB.buildData(rawKB)) === JSON.stringify({ cats: KBD.cats, choices: KBD.choices, items: KBD.items }), true);
check("Parser Wolt-Beschreibung: „Nährwerte: Protein … | Fett(i) … | Kohlenhydrate … | Kalorien … kcal (/) … kJ“, Empfehlung; Options-Änderungen mit Vorzeichen", (() => {
  const a = crawlKB.parseNutrition("Protein:\n50 g Feta\n\nNährwerte:\nProtein 47 g | Fetti 22 g | Kohlenhydrate 82 g | Kalorien 713 kcal 2983 kJ\nBei Empfohlenem Hühnchen mit Reis\nAllergene: Erdnüsse");
  const b = crawlKB.parseNutrition("Nährwerte:\nProtein 42 g | Fett 22 g | Kohlenhydrate 47 g | Kalorien 605 kcal\n");
  const o = crawlKB.parseOption("vegane Hünchen (200g) (-12,9 g Protein, +0,3 KH, +10,6 g Fett, +62 kcal, +259kJ)"), d = crawlKB.parseOption("Hähnchen 200g"), sm = crawlKB.parseOption("Salat Mix (80g) Low Carb (-6,4 g Protein, -68,3 KH, -0,5 g Fett, -272 kcal, -1138kJ)");
  return a.values.protein === 47 && a.values.fat === 22 && a.values.carbs === 82 && a.values.kcal === 713 && a.kJ === 2983 && a.basis === "Hühnchen mit Reis" && b.kJ === null && b.values.kcal === 605 && /keine/.test(crawlKB.parseNutrition("Low-Carb-Bagel").error)
    && o.name === "vegane Hünchen (200g)" && JSON.stringify(o.delta) === JSON.stringify({ protein: -12.9, carbs: 0.3, fat: 10.6, kcal: 62, kJ: 259 }) && d.delta === null && sm.name === "Salat Mix (80g) Low Carb" && sm.delta.kcal === -272 && crawlKB.catKey("HEIßGETRÄNKE ☕") === "HEISSGETRÄNKE";
})(), true);
check("22 Gerichte laut Wolt (20 Bowls + Lachs Bagel + Green Power Bagel), 12 gesperrt → 10 im Tracker mit 74 Varianten (Balance 36, High Protein 36, Bagels 2)", rawKB.wolt.products.length === 22 && rawKB._meta.blocked.length === 12 && new Set(KBD.items.map(x => x.product || x.id)).size === 10 && KBD.items.length === 74 && ["lowcarb:0", "balance:36", "highprotein:36", "bagels:2"].every(e => { const [c, n] = e.split(":"); return KBD.items.filter(x => x.cat === c).length === +n; }), true);
check("Gesperrt mit Grund (dem User genannt): Lean Super Salad (Fett 167,7 g), Vital Boost Bowl (kcal ≠ kJ, Quinoa 125 g), Classic Bowl (Makros), Spicy Protein Salad/Bowls (Rinderhack nicht wählbar) — nicht im Block/Suche/Listen", ["Lean Super Salad 38 g Protein – Low Carb", "Vital Boost Bowl 35 g Protein", "Classic Bowl 39 g Protein", "Spicy Protein Salad 24 g Protein - Low Carb", "Spicy Protein Bowl 31 g Protein", "Spicy Protein Bowl 45 g Protein"].every(n => { const p = kbProd(n); return !!p && typeof p.blocked === "string" && rawKB._meta.blocked.some(b => b.startsWith(n + " — ")) && !KBD.items.some(x => x.productName === n || x.name === n) && !T.SEARCH_INDEX.some(x => x.name.startsWith(n)) && !T.includablesFor(KB).some(x => x.name === n); }) && /167,7/.test(kbProd("Lean Super Salad 38 g Protein – Low Carb").blocked) && /1870 kJ/.test(kbProd("Vital Boost Bowl 35 g Protein").blocked) && /Rinderhack/.test(kbProd("Spicy Protein Bowl 45 g Protein").blocked), true);
check("Varianten-Werte = Empfehlung + Änderungen laut Wolt: Shape Bowl 62 g Protein 687 kcal / 59,5 E / 88,6 KH / 7 F · 14,90 €; mit veganen Hackbällchen + Süßkartoffel 698 / 45 / 87,4 / 11,4 · 19,90 €", (() => {
  const d = kbItem("shape_bowl_62_g_protein__haehnchen__basmati_reis"), v = kbItem("shape_bowl_62_g_protein__vegane_hackbaellchen__suesskartoffel");
  return d.name === "Shape Bowl 62 g Protein" && d.kcal === 687 && d.protein === 59.5 && d.carbs === 88.6 && d.fat === 7 && d.price === 14.9 && v.name === "Shape Bowl 62 g Protein · vegane Hackbällchen · Süßkartoffel" && v.kcal === 698 && v.protein === 45 && v.carbs === 87.4 && v.fat === 11.4 && v.price === 19.9 && KBD.items.every(x => x.sat === 0 && x.sugars === 0 && x.fibre === 0 && x.salt === 0);
})(), true);
check("User 17.09.2026: alle Low-Carb-Salate gesperrt (~44 kcal zu viel), ebenso die Option Salat Mix (kein Salat-Mix-Varianten, nicht in den Optionen); Bagels ohne Optionen; Aufpreise: Quinoa/Süßkartoffel +2,50 €, vegane 200 g +2,50 €", (() => { const salads = rawKB.wolt.products.filter(p => p.cat === "lowcarb"); const lb = kbItem("lachs_bagel_36_g_protein"); return salads.length === 8 && salads.every(p => p.blocked) && salads.filter(p => /kcal ~44/.test(p.blocked)).length === 6 && !KBD.items.some(x => x.cat === "lowcarb" || (x.choices || []).includes("salat_mix")) && !KBD.choices.some(c => c.id === "salat_mix") && rawKB._meta.blockedOptions.length === 1 && /Salat Mix/.test(rawKB._meta.blockedOptions[0]) && lb && !lb.product && !lb.orderNote && lb.kcal === 460 && lb.price === 9.5 && kbItem("shape_bowl_36_g_protein__haehnchen__suesskartoffel").price === 16.4 && kbItem("shape_bowl_36_g_protein__vegane_huehnchen__basmati_reis").price === 13.9 && kbItem("shape_bowl_62_g_protein__vegane_huehnchen__basmati_reis").price === 17.4; })(), true);
check("Order Guide je Variante: Gericht (orderName) + Wolt-Optionsnamen in Wolt-Reihenfolge + Pflicht-Dip „any (no nutrition values — leave it out)“", (() => { const st1 = T.orderStepsFor(KB, { items: [kbItem("shape_bowl_62_g_protein__vegane_huehnchen__suesskartoffel"), kbItem("lachs_bagel_36_g_protein")] }); return st1[0].v === "Shape Bowl 62 g Protein — Wähle deine Proteine aus?: vegane Hünchen (200g) · Wähle deine Kohlenhydrate?: Süßkartoffel (250g) · Wähle dein Dip?: any (no nutrition values — leave it out)" && st1[1].v === "Lachs Bagel 36 g Protein" && rawKB._meta.dips.join() === "Mango Chili,French,Honig Senf,Italian,Parmesan"; })(), true);
check("Listen: Ausschluss = 10 Gerichte + 6 Optionen (Hähnchen … Süßkartoffel, ohne Salat Mix), Pflicht = 10 Gerichte; Such-Index mit allen 74 Varianten", T.excludablesFor(KB).length === 16 && KBD.choices.map(c => c.id).join() === "haehnchen,vegane_huehnchen,vegane_hackbaellchen,basmati_reis,bunter_bio_quinoa,suesskartoffel" && T.includablesFor(KB).length === 10 && T.SEARCH_INDEX.filter(x => x.resto === "Die gruene Kaffeebohne (Wolt)").length === 74, true);
check("_meta: Entscheidungen 17.09.2026, weggelassen (Fruit Bowls, Matcha, Eierspeisen, Heißgetränke, Getränke, 4 Frühstücke), Compleat-Kontrolle (5 Optionen gleich, Salat Mix + Quinoa abweichend), Auffälligkeiten (Salat-kcal, Shape Bowl 62)", rawKB._meta.decisions.length === 5 && rawKB._meta.decisions.every(d => /^User 17[.]09[.]2026/.test(d)) && ["FRUIT BOWLS", "MATCHA & CO", "EIERSPEISEN", "HEIßGETRÄNKE", "ALKOHOLFREIE GETRÄNKE", "Frühstücksteller", "Ostend-Frühstück"].every(n => rawKB._meta.skipped.some(x => x.includes(n))) && rawKB._meta.compleatCheck.filter(x => / → gleich$/.test(x)).length === 5 && rawKB._meta.compleatCheck.some(x => /^Salat Mix .* → abweichend$/.test(x)) && rawKB._meta.compleatCheck.some(x => /^Bunter Bio Quinoa .* → abweichend$/.test(x)) && rawKB._meta.anomalies.some(a => /Garden Crunch/.test(a.name)) && rawKB._meta.anomalies.some(a => a.name === "Shape Bowl 62 g Protein" && /62 g/.test(a.issues[0])), true);
const stKB = T.defaultRestoState(KB);
const runKB = (t, st, ex, inc, mode, p) => T.runOptimize(KB, t, mode || "macros", p || {}, st || stKB, new Set(ex || []), new Set(inc || []));
const rKB = runKB(tDef);
check("Standard: höchstens 5 Gerichte, Preis = Σ Wolt-Preise inkl. Aufpreise, keine wertgleichen Doppel-Bestellungen", rKB.length > 0 && rKB.every(r => r.items.length <= 5 && Math.abs(r.price - Math.round(r.items.reduce((a, x) => a + x.price * 100, 0)) / 100) < 1e-9) && new Set(rKB.map(r => T.acVariantKey(r.items))).size === rKB.length, true);
check("Must include Shape Bowl 62 g Protein: jede Bestellung enthält eine Variante (★ im Panel über product), Optimizer wählt Protein/Kohlenhydrate", (() => { const r = runKB(tDef, stKB, null, ["shape_bowl_62_g_protein"]); return r.length > 0 && r.every(x => x.items.some(y => y.product === "shape_bowl_62_g_protein")) && r.some(x => x.items.some(y => y.product === "shape_bowl_62_g_protein" && !(y.choices || []).includes("basmati_reis"))); })(), true);
check("Ausschluss: Option Hähnchen → keine Hähnchen-Variante; Gericht Shape Bowl 36 → keine seiner Varianten; Preislimit 15 € hält", (() => { const a = runKB(tDef, stKB, ["haehnchen"]), b = runKB(tDef, stKB, ["shape_bowl_36_g_protein"]), c = runKB({ ...tDef, maxPrice: 15 }); return a.length > 0 && a.every(x => x.items.every(y => !(y.choices || []).includes("haehnchen"))) && b.length > 0 && b.every(x => x.items.every(y => y.product !== "shape_bowl_36_g_protein")) && c.length > 0 && c.every(x => x.price <= 15 + 1e-9); })(), true);
check("Kaffeebohne exakt mit Pflicht-Gericht: bestes Ergebnis = vollständige Durchrechnung (Basis + 1 bzw. + 2 Gerichte, 3 Fälle)", (() => {
  const pool = KBD.items;
  return [["jungle_power_bowl_64_g_protein", tgt(90, 120, 30)], ["gym_junkie_bowl_50_g_protein", tgt(60, 60, 25)], ["shape_bowl_36_g_protein", tgt(70, 140, 25)]].every(([prod, tt]) => [2, 3].every(maxN => {
    const vs = pool.filter(x => x.product === prod);
    let best = Infinity;
    for (const v of vs) { best = Math.min(best, T.score(T.sumN([v], 1), tt, "macros", {})); for (let i = 0; i < pool.length; i++) { best = Math.min(best, T.score(T.sumN([v, pool[i]], 1), tt, "macros", {})); if (maxN === 3) for (let j = i; j < pool.length; j++) best = Math.min(best, T.score(T.sumN([v, pool[i], pool[j]], 1), tt, "macros", {})); } }
    const r = runKB(tt, { ...stKB, maxN }, null, [prod]);
    return r.length > 0 && Math.abs(r[0].score - best) < 1e-9;
  }));
})(), true);
check("All: Kaffeebohne mit einem Treffer und Preis", (() => { const a = T.optimizeAll(tDef, "macros", {}, 5, false); return a.filter(r => r._resto === "kaffeebohne").length === 1 && typeof a.find(r => r._resto === "kaffeebohne").price === "number"; })(), true);

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
