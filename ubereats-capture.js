// Uber Eats „Selbst zusammenstellen" (Compleat Frankfurt Nordend) erfassen → data/compleat-ubereats-menu.json
//
// Uber Eats blockt Skript-Abrufe seiner API (Cloudflare „Just a moment…"), deshalb wird das Menü im Browser gelesen:
//   1. Produktseite normal öffnen (Cookie-Banner „Reject"; eine Lieferadresse ist nicht nötig):
//      https://www.ubereats.com/de-en/store/compleat-frankfurt-nordend/eYMk_k0wVIWdpa9-gxeDhg/aabb7948-0359-5803-84b7-977f85d0c2a4/75af6782-2b0f-54a2-833f-27881b849267/04ac2ecb-2761-58c9-ae0f-7719ec443440
//   2. `node ubereats-capture.js` gibt das Snippet aus → in der Entwicklerkonsole der Seite ausführen
//   3. Das JSON (liegt in der Zwischenablage) als data/compleat-ubereats-menu.json speichern
//   4. node compleat-crawl.js → node compleat-update.js → node tests.js
// Die Seite enthält die Daten serverseitig im Script-Tag __REACT_QUERY_STATE__ (Anführungszeichen als ", Backslashes als %5C).
"use strict";

const CAPTURE = function () {
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
    _source: "Uber Eats „Selbst zusammenstellen“ (Compleat Frankfurt Nordend), im Browser von der geöffneten Produktseite gelesen (__REACT_QUERY_STATE__ → customizationsList; Preise in Cent, maxPermitted = Stepper-Maximum je Option, subtitle = kcal-Angabe von Uber Eats). Skript-Abrufe der Uber-Eats-API blockt Cloudflare → bei Menüänderungen mit ubereats-capture.js neu erfassen. Nicht von Hand ändern.",
    capturedAt: new Date().toISOString(),
    pageUrl: location.href,
    item: { title: item.title, uuid: item.uuid, sectionUuid: item.sectionUuid, subsectionUuid: item.subsectionUuid, price: item.price, itemDescription: item.itemDescription, isSoldOut: item.isSoldOut },
    groups: item.customizationsList.map(g => ({
      title: g.title, uuid: g.uuid, minPermitted: g.minPermitted, maxPermitted: g.maxPermitted, minPermittedUnique: g.minPermittedUnique, maxPermittedUnique: g.maxPermittedUnique,
      options: (g.options || []).map(op => ({ title: op.title, uuid: op.uuid, price: op.price, minPermitted: op.minPermitted, maxPermitted: op.maxPermitted, defaultQuantity: op.defaultQuantity, isSoldOut: op.isSoldOut, subtitle: subtitle(op), children: (op.childCustomizationList || []).length })),
    })),
  };
  const json = JSON.stringify(out, null, 2);
  if (typeof copy === "function") copy(json); // Konsolen-Hilfsfunktion der Chrome-/Edge-DevTools
  console.log(json);
  return out.groups.reduce((a, g) => a + g.options.length, 0) + " Optionen erfasst" + (typeof copy === "function" ? " (JSON in der Zwischenablage)" : "");
};

module.exports = { CAPTURE };
if (require.main === module) console.log("(" + CAPTURE.toString() + ")()");
