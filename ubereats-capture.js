// Uber Eats „Selbst zusammenstellen" (Compleat Frankfurt Nordend) erfassen → data/compleat-ubereats-menu.json
//
// Uber Eats blockt Skript-Abrufe seiner API (Cloudflare „Just a moment…"), deshalb wird das Menü im Browser gelesen:
//   1. Produktseite normal öffnen (Cookie-Banner „Reject"; eine Lieferadresse ist nicht nötig). Bei einer Bot-Prüfung abbrechen:
//      https://www.ubereats.com/de-en/store/compleat-frankfurt-nordend/eYMk_k0wVIWdpa9-gxeDhg/aabb7948-0359-5803-84b7-977f85d0c2a4/75af6782-2b0f-54a2-833f-27881b849267/04ac2ecb-2761-58c9-ae0f-7719ec443440
//   2. `node ubereats-capture.js` gibt das Snippet aus → in der Seite ausführen (Entwicklerkonsole bzw. javascript_tool):
//      `await UE_CAPTURE()` → { sha256, length, json } (kompaktes JSON; in der Chrome-Konsole zusätzlich in der Zwischenablage)
//      Prüfen, ob sich nichts geändert hat: `await UE_CAPTURE("<capturedAt der bisherigen Datei>")` → gleiche sha256 = unverändert
//   3. JSON unverändert in eine Datei schreiben, sha256 lokal vergleichen, mit `_source` davor als data/compleat-ubereats-menu.json speichern
//      (Format wie bisher: JSON.stringify(…, null, 2))
//   4. node compleat-crawl.js → node compleat-update.js → node tests.js (Ablauf: Skill compleat-aktualisieren)
// Die Seite enthält die Daten serverseitig im Script-Tag __REACT_QUERY_STATE__ (Anführungszeichen als ", Backslashes als %5C).
// Ausverkaufte Optionen blendet Uber Eats komplett aus (27.09.2026: Guacamole, Rotes Pesto, Chili Gewürz) — der Crawl übernimmt sie.
"use strict";

const CAPTURE = async function (keepCapturedAt) {
  const el = document.getElementById("__REACT_QUERY_STATE__");
  if (!el) throw new Error("__REACT_QUERY_STATE__ fehlt — ist die Produktseite „Selbst zusammenstellen“ geöffnet?");
  const dec = el.textContent.trim().replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/%5C/g, "\\");
  const data = JSON.parse(dec);
  let item = null;
  const seen = new Set();
  (function walk(o, depth) {
    if (item || !o || typeof o !== "object" || seen.has(o) || depth > 40) return;
    seen.add(o);
    if (Array.isArray(o.customizationsList) && o.title === "Selbst zusammenstellen") { item = o; return; }
    for (const k of Object.keys(o)) walk(o[k], depth + 1);
  })(data, 0);
  if (!item) throw new Error("Item „Selbst zusammenstellen“ nicht gefunden");
  const subtitle = op => ((op.subtitle || []).flatMap(s => (s.children || []).map(c => c.text || "")).join(" ") || null);
  const out = {
    capturedAt: keepCapturedAt || new Date().toISOString(),
    pageUrl: location.href,
    item: { title: item.title, uuid: item.uuid, price: item.price, isSoldOut: item.isSoldOut },
    groups: item.customizationsList.map(g => ({
      title: g.title, minPermitted: g.minPermitted, maxPermitted: g.maxPermitted,
      options: (g.options || []).map(op => ({ title: op.title, price: op.price, maxPermitted: op.maxPermitted, defaultQuantity: op.defaultQuantity, isSoldOut: op.isSoldOut, subtitle: subtitle(op) })),
    })),
  };
  const json = JSON.stringify(out);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  if (typeof copy === "function") copy(json); // Konsolen-Hilfsfunktion der Chrome-/Edge-DevTools
  return { sha256: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""), length: json.length, options: out.groups.reduce((a, g) => a + g.options.length, 0), json };
};

module.exports = { CAPTURE };
if (require.main === module) console.log("window.UE_CAPTURE = " + CAPTURE.toString() + ";\n// dann: await UE_CAPTURE()");
