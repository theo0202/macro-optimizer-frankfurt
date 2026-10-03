// Compleat-Shop „Selbst zusammenstellen“: jede Zutat EINZELN auswählen und die Nährwert-Anzeige des Shops ablesen
// → data/compleat-shop-anzeige.json (Kontrollquelle; Abgleich gegen die API-Werte: node verify-compleat-shop.js)
//
// Ablauf (User 27.09.2026: „dadurch, dass du sie einzeln auswählst … die Nährwerte der einzelnen Zutat“):
//   1. Shop-Seite im Browser öffnen (es wird nichts bestellt, nichts in den Warenkorb gelegt):
//      https://compleat.vmos.io/store/bb51e8b9-3301-4bee-bb33-e063fac5ec64/menu/category/bae2cbce-c348-4807-9988-4c52556d68b2/bundle/afaa6fe6-4785-4bd7-b6e0-0ea9d4f12c22/bundleCustomization?menuUUID=9a7bd18b-9542-4768-b85a-c48740da87e9
//   2. `node compleat-shop-capture.js` gibt das Snippet aus → in der Seite ausführen, in Portionen (Werkzeug-Zeitlimit):
//      await CAPTURE(0, 20); await CAPTURE(20, 20); … bis „fertig“ — die Ergebnisse sammeln sich in window.__compleatShop
//   3. window.__compleatShopJSON() liefert { json, sha256 } → JSON als data/compleat-shop-anzeige.json speichern und die
//      Prüfsumme lokal vergleichen (sha256 des kompakten JSON)
// Je Karte: Häkchen anklicken (Menge 1) → warten, bis die Anzeige „Nutrition facts per serving“ Zahlen zeigt → ablesen →
// „Remove …“ (decrease-quantity-btn) → warten, bis die Anzeige wieder „--“ zeigt (sonst liest die nächste Karte veraltete Werte).
// Ausverkaufte Karten (Overlay „Ausverkauft“, Häkchen gesperrt) lassen sich nicht wählen → soldOut, ohne Werte.
"use strict";

const CAPTURE = async function (from, count) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const LBL = { "Energie (kcal)": "kcal", "Energie (kJ)": "kj", "Fett": "fat", "Kohlenhydrate": "carbs", "davon gesättigt": "sat", "davon Zucker": "sugars", "Eiweiß": "protein", "Ballaststoffe": "fibre", "Salz": "salt" };
  const VALUE = /^(--|-?\d+(?:[.,]\d+)?\s*(?:g|kcal|kJ)?)$/;
  const tab = [...document.querySelectorAll("[role=tab]")].find(b => /Nährwerte/.test(b.textContent));
  if (!tab) throw new Error("Reiter „Nährwerte“ fehlt — ist die Seite „Selbst zusammenstellen“ geöffnet?");
  if (tab.getAttribute("aria-selected") !== "true") { tab.click(); await sleep(500); }
  const read = () => {
    const p = document.querySelector("[role=tabpanel]");
    const lines = (p ? p.innerText : "").split("\n").map(s => s.trim()).filter(Boolean), out = {};
    for (let i = 0; i + 1 < lines.length; i++) { const k = LBL[lines[i]]; if (k && out[k] == null && VALUE.test(lines[i + 1])) out[k] = lines[i + 1].replace(/\s*(g|kcal|kJ)$/, ""); }
    return out;
  };
  const waitFor = async (ok, what) => { for (let t = 0; t < 60; t++) { if (ok(read())) return read(); await sleep(100); } throw new Error("Zeitüberschreitung: " + what); };
  const cards = [...document.querySelectorAll("li[data-test^='card-']")].filter(li => /^card-\d+-[0-9a-f-]{36}$/.test(li.getAttribute("data-test") || ""));
  const groupOf = li => { const ul = li.closest("ul"); let h = ul && ul.previousElementSibling; while (h && !/\S/.test(h.textContent)) h = h.previousElementSibling; return h ? h.textContent.trim().split(" - ")[0] : null; };
  if (read().kcal !== "--") throw new Error("Es ist schon etwas ausgewählt — Seite neu laden");
  window.__compleatShop = window.__compleatShop || [];
  const done = new Set(window.__compleatShop.map(x => x.uuid));
  const todo = cards.slice(from, from + count);
  for (const li of todo) {
    const name = (li.querySelector("[data-test='item-name']") || {}).textContent || "";
    const uuid = li.getAttribute("data-test").replace(/^card-\d+-/, "");
    if (done.has(uuid) || /^ohne /i.test(name)) continue;
    const input = li.querySelector("input");
    const overlay = (document.getElementById(li.id + "-overlay-text") || {}).textContent || "";
    if (!input || input.disabled) { window.__compleatShop.push({ name, uuid, group: groupOf(li), soldOut: true, overlay: overlay.trim() || null }); continue; }
    input.click();
    const v = await waitFor(r => r.kcal && r.kcal !== "--", name + " auswählen");
    const qty = (document.getElementById(li.id + "-quantity") || {}).textContent;
    const rm = li.querySelector("[data-test='decrease-quantity-btn']");
    if (!rm) throw new Error("Kein „Remove“-Knopf bei " + name);
    rm.click();
    await waitFor(r => r.kcal === "--", name + " abwählen");
    window.__compleatShop.push({ name, uuid, group: groupOf(li), qty: qty == null ? null : Number(qty), shown: v });
  }
  const next = from + count;
  return next < cards.length ? "weiter mit CAPTURE(" + next + ", " + count + ") — bisher " + window.__compleatShop.length + " Karten" : "fertig: " + window.__compleatShop.length + " Karten";
};

// Kompaktes JSON + Prüfsumme für die Übertragung aus dem Browser
const EXPORT = async function () {
  const out = { readAt: new Date().toISOString(), page: location.href.split("&fromRoute")[0], items: window.__compleatShop || [] };
  const json = JSON.stringify(out);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return { sha256: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""), length: json.length, json };
};

module.exports = { CAPTURE, EXPORT };
if (require.main === module) console.log("window.CAPTURE = " + CAPTURE.toString() + ";\nwindow.__compleatShopJSON = " + EXPORT.toString() + ";\n// dann: await CAPTURE(0, 20) …");
