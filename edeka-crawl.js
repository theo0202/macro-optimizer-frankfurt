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
  { id: "desserts", name: "Protein puddings & desserts" },
  { id: "beans", name: "Beans & chickpeas (tins)" },
  { id: "veg_tins", name: "Edamame, peas & veg (tins)" },
  { id: "fresh_veg", name: "Fresh vegetables" },
  { id: "gyoza", name: "Gyoza" },
  { id: "maultaschen", name: "Maultaschen" },
  { id: "tkmeals", name: "Frozen ready meals" },
  { id: "salads", name: "Fresh salads" },
  { id: "sandwiches", name: "Sandwiches" },
  { id: "bread", name: "Bread & rolls" },
  { id: "coldcuts", name: "Chicken breast slices" },
  { id: "waffles", name: "Waffles" },
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
  // 6b. Süße Quarkspeisen / Protein-Desserts (User 19.09.2026)
  ["desserts", "/Angebote/Kuehlprodukte/Ehrmann-High-Protein-Chocolate-Pudding-200-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/mueller-Milchreis-High-Protein-Schoko-180-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/mueller-Milchreis-High-Protein-Klassik-180-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/mueller-High-Protein-Pudding-Schoko-200-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/Ehrmann-High-Protein-Chocolate-Mousse-200-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/mueller-Milchreis-High-Protein-Zimt-180-g.html"],
  ["desserts", "/Angebote/Kuehlprodukte/Ehrmann-High-Protein-Joghurt-Chocballs-Classic-200-g.html"],
  ["desserts", "/Kuehlprodukte-EDEKA/Joghurt-Desserts-Snacks/Dessert/EDEKA-Herzstuecke-High-Protein-Triple-Dessert-Pudding-200-g.html"],
  ["desserts", "/Angebote/Kuehlprodukte/Ehrmann-High-Protein-Pudding-Schokolade-mit-Topping-200-g.html"],
  ["desserts", "/Angebote/Kuehlprodukte/Ehrmann-High-Protein-Pudding-mit-Double-Choc-mit-Topping-200-g.html"],
  // 10. Gyoza
  ["gyoza", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/EDEKA-Herzstuecke-Gyoza-Haehnchen-150-g.html"],
  ["gyoza", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/EDEKA-Herzstuecke-Gyoza-Gemuese-150-g.html"],
  // 10b. Maultaschen (User 19.09.2026)
  ["maultaschen", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/Buerger-Maultaschen-mit-Haehnchenfleisch-300-g.html"],
  ["maultaschen", "/Kuehlprodukte-EDEKA/Convenience/Pasta-Schupfnudeln-Kartoffeln/Buerger-Protein-Maultaschen-300-g.html"],
  // 10c. TK-Fertiggerichte (User 20.09.2026, FRoSTA — Nährwerte von der Herstellerseite, siehe MANUFACTURER)
  ["tkmeals", "/Tiefkuehl-EDEKA/Fertiggerichte-TK/Nudel-Reisgerichte-TK/FRoSTA-Haehnchen-Geschnetzeltes-500-g.html"],
  ["tkmeals", "/Tiefkuehl-EDEKA/Fertiggerichte-TK/Nudel-Reisgerichte-TK/FRoSTA-Haehnchen-Curry-500-g.html"],
  ["tkmeals", "/Tiefkuehl-EDEKA/Fertiggerichte-TK/Nudel-Reisgerichte-TK/FRoSTA-Nasi-Goreng-500-g.html"],
  ["tkmeals", "/Tiefkuehl-EDEKA/Fertiggerichte-TK/Nudel-Reisgerichte-TK/FRoSTA-Bami-Goreng-500-g.html"],
  ["tkmeals", "/Tiefkuehl-EDEKA/Fertiggerichte-TK/Nudel-Reisgerichte-TK/FRoSTA-Haehnchen-Paella-500-g.html"],
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
  // 15. Waffeln (User 19.09.2026)
  ["waffles", "/Suesswaren-Gebaeck-EDEKA/Knabberartikel/Popcorn-Puffreis/EDEKA-Bio-High-Protein-Linsen-Waffeln-90-g.html"],
  ["waffles", "/Suesswaren-Gebaeck-EDEKA/Knabberartikel/Popcorn-Puffreis/EDEKA-Bio-High-Protein-Kichererbsen-Waffel-100-g.html"],
  ["waffles", "/Suesswaren-Gebaeck-EDEKA/Knabberartikel/Popcorn-Puffreis/Alnatura-Bio-Dinkel-Waffeln-natur-100-g.html"],
  ["waffles", "/Suesswaren-Gebaeck-EDEKA/Knabberartikel/Popcorn-Puffreis/Alnatura-Bio-Kichererbsenwaffeln-100-g.html"],
];

// Marken (längster Treffer am Namensanfang gewinnt) — für „Marke · Produkt“ in der Einkaufsliste
const BRANDS = ["Alnatura", "Andechser Natur", "Arla", "Ben's Original", "Bernard Matthews Oldenburg", "Bioasia", "Bonduelle",
  "Bürger", "EDEKA Bio", "EDEKA Herzstücke", "Ehrmann", "FRoSTA", "Exquisa", "GERVAIS", "GUT&GÜNSTIG", "Herta Finesse", "ITA-SAN", "LAC",
  "Like MEAT", "LIKE", "Mestemacher", "MILRAM", "müller", "Müller", "planted", "Poensgen", "Rapunzel", "reis-fit",
  "Schwarzwaldmilch", "Taifun"];

// Nährwerte von der offiziellen **Herstellerseite** statt vom Shop (User 20.09.2026: er hat die FRoSTA-Seiten verlinkt).
// Der Hersteller kennt die aktuelle Rezeptur; der Shop-Datensatz hängt teils hinterher. Preis, Packung und der Tiefkühl-
// Hinweis kommen weiter vom Markt, jede Abweichung steht in `_meta.manufacturerDiffs`.
const MANUFACTURER = {
  "FRoSTA Hähnchen Geschnetzeltes 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-geschnetzeltes/",
  "FRoSTA Hähnchen Curry 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-curry/",
  "FRoSTA Nasi Goreng 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/nasi-goreng/",
  "FRoSTA Bami Goreng 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/bami-goreng/",
  "FRoSTA Hähnchen Paella 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-paella/",
};

// Gerichte, die dieser Markt (noch) nicht listet: alles von der Herstellerseite, Preis ausdrücklich als Annahme markiert
const MANUFACTURER_ONLY = [
  { cat: "tkmeals", name: "FRoSTA High Protein Hähnchen mit Reis & Brokkoli 500 g", brand: "FRoSTA",
    url: "https://www.frosta.de/produkte/schnelle-gerichte/high-protein-haehnchen-mit-reis-brokkoli/",
    price: 4.79, priceNote: "not sold in this store — price assumed from the 4,79 € the market charges for every other FRoSTA ready meal",
    frozen: true },
];

// Vom User verlinkt, aber nicht im Tracker (mit Grund) — steht in `_meta.notInTracker`
const NOT_IN_TRACKER = [
  { name: "FRoSTA ASC Paella 450 g", url: "https://www.frosta.de/produkte/schnelle-gerichte/paella/",
    reason: "enthält laut Zutatenverzeichnis Krustentierfond mit GARNELEN → Krebstier (Allergie des Users, 13.09.2026). Statt ihrer ist die FRoSTA Hähnchen Paella 500 g im Tracker, die keine Krebs-/Weichtiere enthält" },
];

// Produkte, deren Seite keine Nährwerte nennt (unverarbeitetes Obst/Gemüse braucht keine Kennzeichnung) — User 19.09.2026:
// „nimm doch einfach jeweils die Nährwerte des jeweiligen Gemüses“. Quelle je Produkt benannt, nichts geschätzt:
//   · `like` = ein Produkt DIESES Shops mit derselben Ware und offiziellen Werten
//   · `per100` = USDA FoodData Central (staatliche Referenzdatenbank), Kohlenhydrate „by difference“ minus Ballaststoffe (EU-Konvention), Salz = Natrium × 2,5
const FALLBACK = {
  "EDEKA Herzstücke Gemüsenudeln Karotte 250 g": {
    like: "EDEKA Herzstücke Gemüse Pur Karottenstifte 250 g",
    from: "EDEKA Herzstücke Gemüse Pur Karottenstifte 250 g — dieselbe Ware (Zutaten: Karotten, geschält, roh), offizielle Werte des Shops",
  },
  "EDEKA Herzstücke Gemüsenudeln Zucchini 250 g": {
    per100: { kcal: 17, fat: 0.32, sat: 0.08, carbs: 2.11, sugars: 2.5, fibre: 1, protein: 1.21, salt: 0.02 },
    from: "USDA FoodData Central, SR Legacy #169291 „Squash, summer, zucchini, includes skin, raw“ (rohe Zucchini mit Schale)",
  },
  "EDEKA Herzstücke Minigurken Klasse I 230g": {
    per100: { kcal: 15, fat: 0.11, sat: 0.04, carbs: 3.13, sugars: 1.67, fibre: 0.5, protein: 0.65, salt: 0.01 },
    from: "USDA FoodData Central, SR Legacy #168409 „Cucumber, with peel, raw“ (rohe Gurke mit Schale)",
  },
};

// Produkte ohne Ballaststoff-Angabe sind erlaubt (LMIV: freiwillig) → 0 und in _meta dokumentiert
const NO_FIBRE_OK = true;

const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebs|hummer|lobster|langust|crayfish|muschel|mussel|clam|auster|oyster|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|surimi/i;
const SHELLFISH_ALLERGEN_RE = /krebstier|weichtier/i;
// Wortteile, die vor dem Schalentier-Test entfernt werden (wie SHELLFISH_SAFE in der App). Das Süßungsmittel
// „Cyclamat“ enthält „clam“ (Venusmuschel), „Austernpilz“ enthält „Auster“ — beides sind keine Schalentiere
const SHELLFISH_SAFE = [/(natrium-?)?cyclamat/gi, /austernpilz(e|en)?/gi, /austern-?pilz/gi, /austernseitling(e)?/gi, /oyster mushroom/gi, /muschelnudel(n)?/gi, /muschelpasta/gi];
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

// Nährwerttabelle einer FRoSTA-Produktseite (Werte je 100 g Packungsinhalt) + Packungsgröße + Zutaten ohne Spuren-Hinweis
function parseManufacturer(html, url, problems) {
  const txt = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = txt.match(/Energie ([\d.,]+) kJ \/ ([\d.,]+) kcal Fett ([\d.,]+) g davon ges[^\d]*([\d.,]+) g Kohlenhydrate ([\d.,]+) g davon Zucker ([\d.,]+) g Ballaststoffe ([\d.,]+) g Eiwei[^\d]*([\d.,]+) g Salz ([\d.,]+) g/);
  if (!m) { problems.push(url + ": Nährwerttabelle der Herstellerseite nicht lesbar"); return null; }
  const v = i => U.parseNum(m[i], url);
  const per100 = { kcal: v(2), fat: v(3), sat: v(4), carbs: v(5), sugars: v(6), fibre: v(7), protein: v(8), salt: v(9) };
  const name = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").replace(/\s*[|-]\s*FRoSTA.*$/i, "").replace(/&amp;/g, "&").trim();
  const packG = (txt.match(/Packungsgröße[^\d]{0,40}(\d{3,4})\s?g/) || [])[1];
  // Zutaten bis zum Spuren-Hinweis („Kann Spuren enthalten von …“ zählt laut Regel NICHT als enthalten)
  const zi = txt.search(/Alle Zutaten/), di = txt.search(/Kann Spuren enthalten|Distributor:/);
  const ingredients = zi >= 0 && di > zi ? txt.slice(zi, di).replace(/^Alle Zutaten/, "").trim() : null;
  const traces = (txt.match(/Kann Spuren enthalten von[^.]{0,200}/) || [])[0] || null;
  return { name, per100, packG: packG ? Number(packG) : null, ingredients, traces, url };
}

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
  const manufacturerDiffs = [];
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

    // Menge im Tracker (User 19.09.2026: IMMER die ganze Packung): Abtropfgewicht der Konserve, sonst die Packungsmenge laut Name
    d.portionG = d.drainedG != null ? d.drainedG : d.packG;
    d.portionNote = d.drainedG != null ? "Abtropfgewicht laut Produktseite (ganze Dose)" : "ganze Packung laut Produktname";
    if (!d.noData && !(d.portionG > 0)) problems.push(d.name + ": keine Menge bestimmbar");

    // Keine Werte auf der Seite → Referenzwerte laut FALLBACK (Quelle wird am Produkt vermerkt)
    if (d.noData && FALLBACK[d.name]) {
      const fb = FALLBACK[d.name];
      let per = fb.per100;
      if (fb.like) {
        const src = items.find(x => x.name === fb.like);
        if (!src) { problems.push(d.name + ": Referenzprodukt „" + fb.like + "“ steht nicht (davor) in PRODUCTS"); }
        else per = src.per100;
      }
      if (per) {
        d.per100 = { ...per };
        d.valuesFrom = fb.from;
        d.noData = null;
        d.fibreDeclared = true;
      }
    }
    // Nährwerte von der Herstellerseite (User 20.09.2026): Shop-Werte werden ersetzt, Abweichungen dokumentiert
    if (MANUFACTURER[d.name]) {
      let mh = null;
      try { mh = await get(MANUFACTURER[d.name]); } catch (e) { problems.push(d.name + " (Herstellerseite): " + e.message); }
      const mp = mh && parseManufacturer(mh, MANUFACTURER[d.name], problems);
      if (mp) {
        const diff = U.KEYS.filter(k => Math.abs((d.per100[k] || 0) - mp.per100[k]) > 0.05)
          .map(k => k + " Shop " + (d.per100[k] || 0) + " ≠ Hersteller " + mp.per100[k]);
        if (diff.length) manufacturerDiffs.push({ name: d.name, diffs: diff, note: "der Tracker rechnet mit den Werten der Herstellerseite" });
        if (mp.packG != null && d.packG != null && Math.abs(mp.packG - d.packG) > 1) problems.push(d.name + ": Packung Shop " + d.packG + " g ≠ Hersteller " + mp.packG + " g");
        d.per100 = mp.per100;
        d.fibreDeclared = true;
        d.valuesFrom = "offizielle Herstellerseite " + MANUFACTURER[d.name];
        d.manufacturerUrl = MANUFACTURER[d.name];
        if (mp.ingredients) d.ingredients = mp.ingredients;   // vollständige Zutatenliste des Herstellers (ohne „Kann Spuren enthalten“)
        if (mp.traces) d.traces = mp.traces;                  // nur Info: Spuren zählen laut Regel nicht als enthalten
      }
    }
    if (d.noData) noData.push(d.name + " (" + (CATS.find(c => c.id === cat) || {}).name + ", " + (d.price == null ? "?" : d.price.toFixed(2)) + " €) — " + d.noData);
    if (!d.noData && !d.fibreDeclared) noFibre.push(d.name);
    let text = d.name + " " + (d.legal || "") + " " + (d.ingredients || "");
    for (const re of SHELLFISH_SAFE) text = text.replace(re, " ");
    if (SHELLFISH_RE.test(text) || SHELLFISH_ALLERGEN_RE.test(d.allergens || "")) { d.shellfish = true; shellfish.push(d.name); }
    if (HERB_RE.test(text)) { d.herbs = (text.match(HERB_RE) || [])[0]; coriander.push(d.name + " (" + d.herbs + ")"); }
    if (FROZEN_RE.test(d.storage || "")) { d.frozen = true; frozen.push(d.name); }

    if (!d.noData) { const issues = U.checkItem({ ...d.per100, fibre: d.per100.fibre || 0 }); if (issues.length) anomalies.push({ name: d.name, issues }); }
    items.push(d);
    process.stdout.write(".");
  }

  // Gerichte, die dieser Markt nicht führt: alles von der Herstellerseite, Preis als Annahme markiert (User 20.09.2026)
  for (const p of MANUFACTURER_ONLY) {
    if (!CATS.some(c => c.id === p.cat)) { problems.push("Unbekannte Kategorie „" + p.cat + "“ (" + p.name + ")"); continue; }
    let mh = null;
    try { mh = await get(p.url); } catch (e) { problems.push(p.name + ": " + e.message); continue; }
    const mp = parseManufacturer(mh, p.url, problems);
    if (!mp) continue;
    const packG = packSize(p.name, problems);
    if (mp.packG != null && packG != null && Math.abs(mp.packG - packG) > 1) problems.push(p.name + ": Packung laut Name " + packG + " g ≠ Herstellerseite " + mp.packG + " g");
    const d = { name: p.name, url: p.url, sku: null, price: p.price, per100: mp.per100, basis: "je 100 g Packungsinhalt (Herstellerseite)",
      noData: null, packG, drainedG: null, portionG: packG, portionNote: "ganze Packung laut Herstellerseite",
      fibreDeclared: true, allergens: null, ingredients: mp.ingredients, traces: mp.traces, legal: null, storage: null, company: null,
      cat: p.cat, brand: p.brand, frozen: !!p.frozen, valuesFrom: "offizielle Herstellerseite " + p.url, manufacturerUrl: p.url,
      priceNote: p.priceNote, notInStore: true };
    if (!d.brand) problems.push(d.name + ": Marke fehlt");
    if (!(d.portionG > 0)) problems.push(d.name + ": keine Menge bestimmbar");
    let text2 = d.name + " " + (d.ingredients || "");
    for (const re of SHELLFISH_SAFE) text2 = text2.replace(re, " ");
    if (SHELLFISH_RE.test(text2)) { d.shellfish = true; shellfish.push(d.name); }
    if (HERB_RE.test(text2)) { d.herbs = (text2.match(HERB_RE) || [])[0]; coriander.push(d.name + " (" + d.herbs + ")"); }
    if (d.frozen) frozen.push(d.name);
    const issues2 = U.checkItem({ ...d.per100, fibre: d.per100.fibre || 0 });
    if (issues2.length) anomalies.push({ name: d.name, issues: issues2 });
    items.push(d);
    process.stdout.write(".");
  }
  console.log("");

  const out = {
    _meta: {
      source: "Produktseiten des EDEKA-Graf-Onlineshops " + SHOP + " (" + STORE + "): Name, Preis, Artikelnummer, Nährwerte je 100 g, Abtropfgewicht, Allergene, Zutaten",
      fetchedAt,
      basis: "Offizielle Werte **je 100 g** laut Produktseite × Menge. Die Menge ist **immer die ganze Packung** (User 19.09.2026) — bei Konserven das **Abtropfgewicht**. Ballaststoffe sind freiwillig → fehlen sie, steht 0. Drei Produkte ohne Nährwertangabe bekommen Referenzwerte (FALLBACK, Quelle je Produkt in _meta.referenceValues)",
      rules: [
        "Nur Produkte, die der Markt im Onlineshop führt; Namen exakt wie dort",
        "Der Tracker rechnet mit Gramm: jedes Produkt startet mit seiner Portion, das Gramm ist im Warenkorb änderbar",
        "Preise = Onlineshop-Preise des Marktes (im Laden können sie abweichen, Angebote wechseln)",
      ],
      decisions: [
        "User 19.09.2026: Supermarkt-Tracker „Edeka Graf (In-Store)“ nach dem Muster des Waitrose-Tabs im London-Tool (Build order + Track basket, Kategorien, Max products, eigene Picks sperren, Must include / Exclude)",
        "User 19.09.2026: Schalter „No frozen food“ (Default AN) — aktuell trägt kein Produkt der Liste einen Tiefkühl-Hinweis",
        "User 19.09.2026: falls relevant immer das Abtropfgewicht rechnen",
        "User 19.09.2026: immer die ganze Packung rechnen (auch 500-g-Becher und Brötchen-Packs)",
        "User 19.09.2026: Gemüse ohne Nährwertangabe bekommt die Werte des jeweiligen Gemüses (gleiches Shop-Produkt bzw. USDA-Referenz), Quelle je Produkt dokumentiert",
        "User 19.09.2026: jedes Produkt verlinkt seine Produktseite (Bild + Wiederfinden im Laden)",
        "User 20.09.2026: TK-Fertiggerichte von FRoSTA als eigene Kategorie; Nährwerte von den verlinkten Herstellerseiten (frosta.de), Preis und Packung vom Markt",
        "User 20.09.2026 (Folge der Allergie-Regel vom 13.09.2026): die verlinkte FRoSTA Paella enthält GARNELEN → nicht im Tracker, stattdessen die FRoSTA Hähnchen Paella ohne Krebs-/Weichtiere",
      ],
      store: STORE,
      shop: SHOP,
      cats: CATS,
      referenceValues: Object.fromEntries(items.filter(x => x.valuesFrom && !x.manufacturerUrl).map(x => [x.name, x.valuesFrom])),
      manufacturer: Object.fromEntries(items.filter(x => x.manufacturerUrl).map(x => [x.name, x.manufacturerUrl])),
      manufacturerDiffs: manufacturerDiffs.length ? manufacturerDiffs : "keine Abweichung zwischen Shop- und Herstellerangaben",
      notInStore: Object.fromEntries(items.filter(x => x.notInStore).map(x => [x.name, x.priceNote])),
      notInTracker: NOT_IN_TRACKER,
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
  console.log("Referenzwerte (" + Object.keys(out._meta.referenceValues).length + "):\n  " + Object.entries(out._meta.referenceValues).map(([k, v]) => k + " ← " + v).join("\n  "));
  console.log("Ohne Nährwerte auf der Seite (" + noData.length + "): " + (noData.join(" · ") || "keine"));
  console.log("Ohne Ballaststoff-Angabe (" + noFibre.length + "): " + (noFibre.join(" · ") || "keine"));
  if (Array.isArray(out._meta.manufacturerDiffs)) console.log("Shop ≠ Hersteller (" + out._meta.manufacturerDiffs.length + "):\n  " + out._meta.manufacturerDiffs.map(d => d.name + ": " + d.diffs.join(", ")).join("\n  "));
  if (Object.keys(out._meta.notInStore).length) console.log("Nicht im Markt gelistet: " + Object.keys(out._meta.notInStore).join(" · "));
  console.log("Nicht im Tracker: " + NOT_IN_TRACKER.map(x => x.name + " — " + x.reason).join(" · "));
  console.log("Tiefkühl: " + (Array.isArray(out._meta.frozen) ? out._meta.frozen.join(" · ") : out._meta.frozen));
  console.log("Schalentier: " + (Array.isArray(out._meta.shellfish) ? out._meta.shellfish.join(" · ") : out._meta.shellfish));
  console.log("Koriander/Minze: " + (Array.isArray(out._meta.coriander) ? out._meta.coriander.join(" · ") : out._meta.coriander));
  console.log("Auffälligkeiten (" + anomalies.length + "):" + (anomalies.length ? "\n  " + anomalies.map(a => a.name + ": " + a.issues.join("; ")).join("\n  ") : " keine"));
  if (infos.length) console.log("Hinweise:\n  " + infos.join("\n  "));
}

main().catch(e => { console.error(e); process.exit(1); });
