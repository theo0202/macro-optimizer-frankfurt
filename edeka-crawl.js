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
  { id: "fish", name: "Fish" },
  { id: "cottage", name: "Cottage cheese" },
  { id: "vegan", name: "Vegan protein & tofu" },
  { id: "skyr", name: "Skyr & quark" },
  { id: "herbquark", name: "Herb quark" },
  { id: "desserts", name: "Protein puddings & desserts" },
  { id: "beans", name: "Beans & chickpeas (tins)" },
  { id: "veg_tins", name: "Edamame, peas & veg (tins)" },
  { id: "fresh_veg", name: "Fresh vegetables" },
  { id: "berries", name: "Berries" },     // „Beeren“ (User 24.09.2026)
  { id: "gyoza", name: "Gyoza" },
  { id: "eh_bowls", name: "Bowls" },      // Eat Happy (User 24.09.2026)
  { id: "eh_sushi", name: "Sushi" },      // Eat Happy (User 24.09.2026)
  { id: "maultaschen", name: "Maultaschen" },
  { id: "tkmeals", name: "Frozen ready meals" },
  { id: "salads", name: "Fresh salads" },
  { id: "sandwiches", name: "Sandwiches & Wraps" },   // umbenannt, seit die Burritos dazukamen (User 24.09.2026)
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
  // 2b. Fisch (User 22.09.2026) — die Krone-Forelle mit den Werten der verlinkten Herstellerseite (MANUFACTURER)
  ["fish", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Fisch-Meeresfruechte/Krone-ASC-Forellen-Filets-100-g.html"],
  ["fish", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Fisch-Meeresfruechte/EDEKA-Bio-Raeucherlachs-100-g.html"],
  ["fish", "/Kuehlprodukte-EDEKA/Fleisch-Wurst-Fisch/Fisch-Meeresfruechte/Krone-Fisch-ASC-Mein-Lieblings-Lachs-100-g.html"],
  ["fish", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Fischkonserven/EDEKA-Herzstuecke-Thunfischfilets-in-eigenem-Saft-und-Aufguss-185-g.html"],
  ["fish", "/Nahrungsmittel-EDEKA/Konserven-Feinkost/Fischkonserven/Saupiquet-Thunfisch-Filets-Naturale-ohne-Oel-185-g.html"],
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
  // User 24.09.2026: „Mini Möhren, 200 g“ (ohne Link — im Onlineshop gibt es genau diese 200-g-Packung) und die verlinkten Mini-Pflaumentomaten
  ["fresh_veg", "/Obst-Gemuese-EDEKA/Gemuese/Wurzelgemuese/EDEKA-Bio-Moehren-Mini-Bio-Klasse-II-200g.html"],
  ["fresh_veg", "/Obst-Gemuese-EDEKA/Gemuese/Tomaten/EDEKA-Herzstuecke-Mini-Pflaumen-Tomaten-Klasse-I-250g.html"],
  // 9b. Beeren (User 24.09.2026)
  ["berries", "/Obst-Gemuese-EDEKA/Obst/Beeren-Trauben/Driscoll-s-Himbeeren-Klasse-I-125g-EDEKA.html"],
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
  "Bürger", "Driscoll's", "EDEKA Bio", "EDEKA Herzstücke", "Eat Happy", "Ehrmann", "FRoSTA", "Exquisa", "Krone Fisch", "Krone", "GERVAIS", "GUT&GÜNSTIG", "Herta Finesse", "ITA-SAN", "LAC",
  "Like MEAT", "LIKE", "Mestemacher", "MILRAM", "müller", "Müller", "planted", "Poensgen", "Rapunzel", "reis-fit", "Saupiquet",
  "Schwarzwaldmilch", "Taifun"];

// Eat Happy (Sushi-/Bowl-Theke im Markt, User 24.09.2026): Werte je 100 g, Standardgewicht und Grundpreis von eathappy.de.
// Die Werte umfassen den ganzen Boxinhalt inkl. Saucen (Eat Happy). Das Gewicht schwankt täglich → `variable` (Gramm im Tracker
// änderbar, der Boxpreis bleibt). Preis = Grundpreis je kg × Standardgewicht = der Boxpreis (8,99 €, 9,49 € …; je Abholort ggf. anders)
const EAT_HAPPY = [
  { cat: "eh_bowls", url: "https://www.eathappy.de/produkte/chicken-karaage-donburi/" },
  { cat: "eh_bowls", url: "https://www.eathappy.de/produkte/donburi-lachs-avocado/" },
  { cat: "eh_bowls", url: "https://www.eathappy.de/produkte/chicken-katsu-donburi/" },
  { cat: "eh_bowls", url: "https://www.eathappy.de/produkte/poke-bowl-lachs/" },
  { cat: "eh_bowls", url: "https://www.eathappy.de/produkte/poke-bowl-vegan/" },
  { cat: "eh_sushi", url: "https://www.eathappy.de/produkte/lachs-avocado-trio/" },
  { cat: "eh_sushi", url: "https://www.eathappy.de/produkte/futo-nigiri-box/" },
];

// Produkte aus dem EDEKA-Sortiment (edeka.de), die der Graf-Onlineshop nicht führt (User 24.09.2026: gibt es im Markt).
// Werte je 100 g aus den strukturierten Daten der Seite (schema.org Product), Packung laut „Inhalt“. Kein Preis online →
// price null + priceNote (im Tracker „price n/a“; per Label correction nachtragbar)
const EDEKA_DE = [
  { cat: "sandwiches", gtin: "4311501172391" },   // User: „Burrito Avocado und Tofu“ = Burrito Veggie Avocado
  { cat: "sandwiches", gtin: "4311501172339" },   // User: „Burrito Chicken Tex Mex“ = Burrito TexMex
  { cat: "sandwiches", gtin: "4311501172360" },   // Burrito Chicken BBQ
];

// Nährwerte von der offiziellen **Herstellerseite** statt vom Shop (User 20.09.2026: er hat die FRoSTA-Seiten verlinkt).
// Der Hersteller kennt die aktuelle Rezeptur; der Shop-Datensatz hängt teils hinterher. Preis, Packung und der Tiefkühl-
// Hinweis kommen weiter vom Markt, jede Abweichung steht in `_meta.manufacturerDiffs`.
const MANUFACTURER = {
  "FRoSTA Hähnchen Geschnetzeltes 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-geschnetzeltes/",
  "FRoSTA Hähnchen Curry 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-curry/",
  "FRoSTA Nasi Goreng 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/nasi-goreng/",
  "FRoSTA Bami Goreng 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/bami-goreng/",
  "FRoSTA Hähnchen Paella 500 g": "https://www.frosta.de/produkte/schnelle-gerichte/haehnchen-paella/",
  "Krone ASC Forellen-Filets 100 g": "https://www.krone-fisch.de/produkt/forellen-filets/",   // User 22.09.2026
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
//   · `like` = ein Produkt DIESES Shops mit derselben Ware und offiziellen Werten (steht selbst im Tracker)
//   · `refUrl` = die Produktseite eines Shop-Produkts mit derselben Ware, das nicht im Tracker steht (z.B. tiefgefrorene Himbeeren);
//     der Crawl liest ihre Nährwerttabelle bei jedem Lauf neu
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
  // User 24.09.2026 („einfach klassische Nährwerte nehmen“)
  "EDEKA Bio Möhren Mini, Bio Klasse II 200g": {
    like: "EDEKA Herzstücke Gemüse Pur Karottenstifte 250 g",
    from: "EDEKA Herzstücke Gemüse Pur Karottenstifte 250 g — dieselbe Ware (Möhren, roh), offizielle Werte des Shops",
  },
  "EDEKA Herzstücke Mini Pflaumen Tomaten Klasse I 250g": {
    // Foundation Foods: Zucker und gesättigte Fettsäuren veröffentlicht USDA für Grape Tomatoes nicht → 0 (steht in `gaps`)
    per100: { kcal: 27, fat: 0.63, sat: 0, carbs: 3.41, sugars: 0, fibre: 2.1, protein: 0.83, salt: 0.02 },
    gaps: ["sugars", "sat"],
    from: "USDA FoodData Central, Foundation #321360 „Tomatoes, grape, raw“ (Mini-/Grape-Tomaten, roh; Zucker und gesättigte Fettsäuren nennt USDA dafür nicht → 0)",
  },
  "Driscoll's Himbeeren Klasse I 125g": {
    refUrl: SHOP + "/Tiefkuehl-EDEKA/Obst-Gemuese-TK/Obst-TK/EDEKA-Herzstuecke-Himbeeren-300-g-EDEKA.html",
    from: "EDEKA Herzstücke Himbeeren 300 g (tiefgefroren) — dieselbe Frucht (Zutaten: Himbeeren), offizielle Werte des Shops",
  },
};

// Produkte, die der Markt führt, die aber weder im Onlineshop noch auf edeka.de stehen (User 24.09.2026): Werte aus einer
// benannten Referenz, kein Preis (per Label correction nachtragbar), keine Produktseite (`offline`)
const OFFLINE = [
  { cat: "berries", name: "Kulturheidelbeeren 125 g", packG: 125,
    per100: { kcal: 57, fat: 0.33, sat: 0.03, carbs: 12.09, sugars: 9.96, fibre: 2.4, protein: 0.74, salt: 0 },
    from: "USDA FoodData Central, SR Legacy #171711 „Blueberries, raw“ (Kulturheidelbeeren, roh; die gefrorenen „Heidelbeeren“ des Shops sind Wildheidelbeeren)" },
];

// Produkte ohne Ballaststoff-Angabe sind erlaubt (LMIV: freiwillig) → 0 und in _meta dokumentiert
const NO_FIBRE_OK = true;

const SHELLFISH_RE = /garnele|shrimp|scampi|gambas|prawn|krabbe|crab|krebs|hummer|lobster|langust|crayfish|muschel|mussel|clam|auster|oyster|scallop|tintenfisch|calamar|squid|sepia|oktopus|octopus|pulpo|meeresfr|surimi/i;
const SHELLFISH_ALLERGEN_RE = /krebstier|weichtier/i;
// Wortteile, die vor dem Schalentier-Test entfernt werden (wie SHELLFISH_SAFE in der App). Das Süßungsmittel
// „Cyclamat“ enthält „clam“ (Venusmuschel), „Austernpilz“ enthält „Auster“ — beides sind keine Schalentiere
const SHELLFISH_SAFE = [/(natrium-?)?cyclamat/gi, /austernpilz(e|en)?/gi, /austern-?pilz/gi, /austernseitling(e)?/gi, /oyster mushroom/gi, /muschelnudel(n)?/gi, /muschelpasta/gi];
const HERB_RE = /koriander|cilantro|minze|\bmint\b/i;
// Fisch und Thunfisch (Schalter „No fish“ / „No tuna“, User 22.09.2026): Fisch laut Allergenangabe („Fische und daraus
// hergestellte Erzeugnisse“ = enthalten, Spuren stehen dort nicht) oder laut Name; Thunfisch laut Name, Bezeichnung oder Zutaten
const FISH_ALLERGEN_RE = /\bFisch(e)?\b/i;
const FISH_NAME_RE = /lachs|forelle|thunfisch|seelachs|hering|makrele|kabeljau|sardine|dorsch|scholle|\btuna\b|\bsalmon\b/i;
const TUNA_RE = /thunfisch|\btuna\b|\btonno\b/i;
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

// Nährwerttabelle einer Herstellerseite (FRoSTA, Krone …): Werte je 100 g, Label für Label gelesen.
// Ein Label ohne Zahl (Krone lässt z.B. Kohlenhydrate/Zucker leer) → null; der Aufrufer behält dann den Shop-Wert
// und dokumentiert das. Dazu Packungsgröße und Zutaten ohne Spuren-Hinweis („Kann Spuren enthalten“ zählt NICHT).
function parseManufacturer(html, url, problems) {
  const txt = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const start = txt.search(/Energie[^\d]{0,25}[\d.,]+\s*kJ/);
  if (start < 0) { problems.push(url + ": Nährwerttabelle der Herstellerseite nicht lesbar"); return null; }
  const tab = txt.slice(start, start + 600);
  const grab = re => { const m = tab.match(re); return m ? U.parseNum(m[1], url) : null; };
  const per100 = {
    kcal: grab(/([\d.,]+)\s*kcal/),
    fat: grab(/Fett:?\s+([\d.,]+)\s*g/),
    sat: grab(/gesättigte Fettsäuren:?\s+([\d.,]+)\s*g/),
    carbs: grab(/Kohlenhydrate:?\s+([\d.,]+)\s*g/),
    sugars: grab(/davon Zucker:?\s+([\d.,]+)\s*g/),
    fibre: grab(/Ballaststoffe:?\s+([\d.,]+)\s*g/),
    protein: grab(/(?:Eiwei(?:ß|ss)|Protein):?\s+([\d.,]+)\s*g/),
    salt: grab(/Salz:?\s+([\d.,]+)\s*g/),
  };
  for (const k of ["kcal", "fat", "protein", "salt"]) if (per100[k] == null) problems.push(url + ": Herstellerseite nennt keinen Wert für " + k);
  const name = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").replace(/\s*[|–-]\s*(FRoSTA|Krone).*$/i, "").replace(/&amp;/g, "&").trim();
  const packG = (txt.match(/Packungsgröße[^\d]{0,40}(\d{3,4})\s?g/) || [])[1];
  const zi = txt.search(/Alle Zutaten/), di = txt.search(/Kann Spuren enthalten|Distributor:/);
  const ingredients = zi >= 0 && di > zi ? txt.slice(zi, di).replace(/^Alle Zutaten/, "").trim() : null;
  const traces = (txt.match(/Kann Spuren enthalten von[^.]{0,200}/) || [])[0] || null;
  return { name, per100, packG: packG ? Number(packG) : null, ingredients, traces, url };
}

// „Kann Spuren enthalten …“-Sätze zählen laut Regel nicht als enthalten → vor jedem Schalentier-/Fisch-Test entfernen
const stripTraces = s => String(s || "").replace(/kann (?:folgende )?spuren[^.]*(?:\.|$)/gi, " ");

// eathappy.de: Name (h1), Beschreibung, Gewicht, Grundpreis je kg, Werte je 100 g (inkl. Saucen), Eigenschaften, Allergene, Spuren
function parseEatHappy(html, url, problems) {
  const name = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  if (!name) { problems.push(url + ": kein Produktname"); return null; }
  const lines = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const flat = lines.join(" ");
  const gram = flat.match(/Gewicht:\s*([\d.,]+)\s*g\b/), perKg = flat.match(/Grundpreis:\s*([\d.,]+)\s*€\s*\/\s*kg/);
  if (!gram) problems.push(name + ": kein Gewicht auf eathappy.de");
  if (!perKg) problems.push(name + ": kein Grundpreis auf eathappy.de");
  const nut = parseManufacturer(html, url, problems);
  if (!nut || !gram || !perKg) return null;
  const packG = U.parseNum(gram[1], name + " Gewicht"), pricePerKg = U.parseNum(perKg[1], name + " Grundpreis");
  const pi = lines.indexOf("PRODUKTINFORMATIONEN");
  return {
    name, url, packG, pricePerKg, price: U.round(pricePerKg * packG / 1000, 2), per100: nut.per100,
    description: pi >= 0 ? lines.slice(pi + 1).join(" ").split(/\s*Gewicht:/)[0].trim() : null,
    properties: (flat.match(/Eigenschaften:\s*(.*?)\s*Allergene und Zusatzstoffe:/) || [])[1] || null,
    allergens: (flat.match(/Allergene und Zusatzstoffe:\s*(.*?)\s*Spurenhinweise:/) || [])[1] || null,
    traces: (flat.match(/Kann Spuren enthalten von:\s*(.*?)\s*(?:Zu beachten:|$)/) || [])[1] || null,
  };
}

// edeka.de/sortiment/<GTIN>: schema.org-Product (Name, Marke, GTIN, Werte je 100 g), „Inhalt: 300 g“, Zutaten, Allergene (ohne Spuren)
function parseEdekaDe(html, url, problems) {
  const prod = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => { try { return JSON.parse(m[1]); } catch (e) { return null; } }).find(o => o && o["@type"] === "Product");
  if (!prod) { problems.push(url + ": kein Product-Datensatz (schema.org)"); return null; }
  const P = Object.fromEntries((prod.additionalProperty || []).map(p => [p.propertyID, p.value]));
  const IDS = { kcal: ["energy-kcal-per-100g"], fat: ["fat-per-100g"], sat: ["saturated-fat-per-100g"], carbs: ["carbohydrates-per-100g"],
    sugars: ["sugars-per-100g"], fibre: ["fibre-per-100g", "fiber-per-100g"], protein: ["protein-per-100g"], salt: ["salt-per-100g"] };
  const per100 = {};
  let fibreDeclared = true;
  for (const [k, ids] of Object.entries(IDS)) {
    const id = ids.find(i => P[i] != null);
    if (id == null) {
      if (k === "fibre") { per100.fibre = 0; fibreDeclared = false; continue; }
      problems.push(url + ": " + k + " fehlt"); per100[k] = 0; continue;
    }
    per100[k] = U.round(Number(P[id]), 2);
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const inhalt = text.match(/Inhalt:\s*([\d.,]+)\s*(g|kg)\b/);
  if (!inhalt) { problems.push(url + ": kein „Inhalt“"); return null; }
  const packG = U.parseNum(inhalt[1], url + " Inhalt") * (inhalt[2] === "kg" ? 1000 : 1);
  const brand = (prod.brand && prod.brand.name) || null;
  const zi = text.indexOf("Zutaten:");
  const ingredients = zi >= 0 ? text.slice(zi + 8).split(/\s+Allergene\s+/)[0].trim() : null;
  const allergens = (text.slice(zi >= 0 ? zi : 0).match(/\sAllergene\s+(.*?)\s+(?:Kann folgende Spuren enthalten|$)/) || [])[1] || null;
  return { name: [brand, prod.name, packG + " g"].filter(Boolean).join(" "), brand, gtin: prod.gtin13 || null, url, packG, per100, fibreDeclared, ingredients, allergens };
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
  const unavailable = /temporär nicht verfügbar/i.test(html);
  if ((price == null || !(price > 0)) && !unavailable) problems.push(where + ": kein Preis");
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
    packG: packSize(name, problems), drainedG: drained, unavailable,
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
  const manufacturerDiffs = [], fish = [], tuna = [], unavailable = [];
  let PREV = null; try { PREV = U.readJSON(OUT); } catch (e) {}   // voriger Lauf: letzter bekannter Preis für gerade nicht verfügbare Produkte
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
    // „Der Artikel ist temporär nicht verfügbar“: die Seite nennt keinen Preis → letzter bekannter Preis, sichtbar markiert
    // Solange ein Artikel nicht verfügbar ist, blendet der Shop auch die Nährwerttabelle aus (22.09.2026, Karottenstifte)
    // → Preis UND Werte aus dem vorigen Lauf übernehmen; beides steht in _meta.unavailable
    if (d.unavailable && d.price == null) {
      const old = PREV && (PREV.items || []).find(x => x.name === d.name);
      if (old && old.price > 0) {
        d.price = old.price;
        d.priceNote = "temporarily not available in the online shop (" + fetchedAt.slice(0, 10) + ") — last known price";
        let what = "Preis " + old.price.toFixed(2) + " €";
        if (d.noData && old.per100 && !old.noData && U.KEYS.some(k => old.per100[k] > 0)) {
          d.per100 = { ...old.per100 };
          d.noData = null;
          d.fibreDeclared = !!old.fibreDeclared;
          if (old.valuesFrom) d.valuesFrom = old.valuesFrom;
          // Stand der Werte: vom Produkt selbst (valuesAsOf), sonst aus dem Hinweis des vorigen Laufs, sonst dessen Abrufdatum
          const prevNote = ((PREV._meta && PREV._meta.unavailable) || []).find(x => x.indexOf(d.name + " — ") === 0) || "";
          d.valuesAsOf = old.valuesAsOf || (prevNote.match(/Nährwerte \((\d{4}-\d{2}-\d{2})\)/) || [])[1] || (PREV._meta.fetchedAt || "").slice(0, 10) || "voriger Lauf";
          what += " und Nährwerte (" + d.valuesAsOf + ")";
        }
        unavailable.push(d.name + " — letzter bekannter " + what);
      } else problems.push(d.name + ": temporär nicht verfügbar und kein früherer Preis bekannt");
    } else d.unavailable = false;
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
        else if (src.noData || !U.KEYS.some(k => src.per100[k] > 0)) { problems.push(d.name + ": Referenzprodukt „" + fb.like + "“ hat keine Nährwerte"); per = null; }
        else per = src.per100;
      }
      if (fb.refUrl) {
        let rh = null;
        try { rh = await get(fb.refUrl); } catch (e) { problems.push(d.name + " (Referenzseite): " + e.message); }
        const rp = rh && parsePage(rh, fb.refUrl, problems);
        if (!rp || rp.noData || !U.KEYS.some(k => rp.per100[k] > 0)) { problems.push(d.name + ": Referenzseite ohne Nährwerte (" + fb.refUrl + ")"); per = null; }
        else { per = rp.per100; d.refUrl = fb.refUrl; }
      }
      if (per) {
        d.per100 = { ...per };
        d.valuesFrom = fb.from;
        d.noData = null;
        d.fibreDeclared = true;
        if (fb.gaps) d.refGaps = fb.gaps;
      }
    }
    // Nährwerte von der Herstellerseite (User 20.09.2026): Shop-Werte werden ersetzt, Abweichungen dokumentiert
    if (MANUFACTURER[d.name]) {
      let mh = null;
      try { mh = await get(MANUFACTURER[d.name]); } catch (e) { problems.push(d.name + " (Herstellerseite): " + e.message); }
      const mp = mh && parseManufacturer(mh, MANUFACTURER[d.name], problems);
      if (mp) {
        // Fehlt auf der Herstellerseite ein Wert (Krone lässt Kohlenhydrate/Zucker leer), bleibt der Shop-Wert — dokumentiert
        const gaps = U.KEYS.filter(k => mp.per100[k] == null && k !== "fibre");
        const per = Object.fromEntries(U.KEYS.map(k => [k, mp.per100[k] == null ? (d.per100[k] || 0) : mp.per100[k]]));
        const diff = U.KEYS.filter(k => mp.per100[k] != null && Math.abs((d.per100[k] || 0) - mp.per100[k]) > 0.05)
          .map(k => k + " Shop " + (d.per100[k] || 0) + " ≠ Hersteller " + mp.per100[k]);
        if (diff.length || gaps.length) manufacturerDiffs.push({ name: d.name, diffs: diff,
          gaps: gaps.map(k => k + ": Herstellerseite ohne Wert → Shop-Wert " + (d.per100[k] || 0)),
          note: "der Tracker rechnet mit den Werten der Herstellerseite" });
        if (mp.packG != null && d.packG != null && Math.abs(mp.packG - d.packG) > 1) problems.push(d.name + ": Packung Shop " + d.packG + " g ≠ Hersteller " + mp.packG + " g");
        d.per100 = per;
        d.fibreDeclared = mp.per100.fibre != null || d.fibreDeclared;
        d.valuesFrom = "offizielle Herstellerseite " + MANUFACTURER[d.name];
        d.manufacturerUrl = MANUFACTURER[d.name];
        if (mp.ingredients) d.ingredients = mp.ingredients;   // vollständige Zutatenliste des Herstellers (ohne „Kann Spuren enthalten“)
        if (mp.traces) d.traces = mp.traces;                  // nur Info: Spuren zählen laut Regel nicht als enthalten
      }
    }
    if (d.noData) noData.push(d.name + " (" + (CATS.find(c => c.id === cat) || {}).name + ", " + (d.price == null ? "?" : d.price.toFixed(2)) + " €) — " + d.noData);
    if (!d.noData && !d.fibreDeclared) noFibre.push(d.name);
    let text = stripTraces(d.name + " " + (d.legal || "") + " " + (d.ingredients || ""));
    for (const re of SHELLFISH_SAFE) text = text.replace(re, " ");
    if (SHELLFISH_RE.test(text) || SHELLFISH_ALLERGEN_RE.test(stripTraces(d.allergens || ""))) { d.shellfish = true; shellfish.push(d.name); }
    if (HERB_RE.test(text)) { d.herbs = (text.match(HERB_RE) || [])[0]; coriander.push(d.name + " (" + d.herbs + ")"); }
    if (FROZEN_RE.test(d.storage || "")) { d.frozen = true; frozen.push(d.name); }
    if (FISH_ALLERGEN_RE.test(d.allergens || "") || FISH_NAME_RE.test(d.name)) { d.fish = true; fish.push(d.name); }
    if (TUNA_RE.test(d.name + " " + (d.legal || "") + " " + (d.ingredients || ""))) { d.tuna = true; tuna.push(d.name); }

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

  // Weitere Quellen ohne Graf-Shopseite (User 24.09.2026): Eat Happy (Theke im Markt) und EDEKA-Sortiment von edeka.de.
  // Dieselben Prüfungen wie bei den Shop-Produkten; „Kann Spuren enthalten“ zählt nicht (stripTraces)
  const addExtra = d => {
    for (const k of U.KEYS) if (k !== "fibre" && d.per100[k] == null) problems.push(d.name + ": " + k + " fehlt");
    let text = stripTraces(d.name + " " + (d.description || "") + " " + (d.ingredients || ""));
    for (const re of SHELLFISH_SAFE) text = text.replace(re, " ");
    if (SHELLFISH_RE.test(text) || SHELLFISH_ALLERGEN_RE.test(stripTraces(d.allergens || ""))) { d.shellfish = true; shellfish.push(d.name); }
    if (HERB_RE.test(text)) { d.herbs = (text.match(HERB_RE) || [])[0]; coriander.push(d.name + " (" + d.herbs + ")"); }
    if (FISH_ALLERGEN_RE.test(stripTraces(d.allergens || "")) || FISH_NAME_RE.test(d.name)) { d.fish = true; fish.push(d.name); }
    if (TUNA_RE.test(text)) { d.tuna = true; tuna.push(d.name); }
    if (!d.fibreDeclared) noFibre.push(d.name);
    const issues = U.checkItem({ ...d.per100, fibre: d.per100.fibre || 0 });
    if (issues.length) anomalies.push({ name: d.name, issues });
    if (items.some(x => x.name === d.name)) { problems.push(d.name + ": doppelt"); return; }
    items.push(d);
    process.stdout.write(".");
  };
  for (const e of EAT_HAPPY) {
    if (!CATS.some(c => c.id === e.cat)) { problems.push("Unbekannte Kategorie „" + e.cat + "“ (" + e.url + ")"); continue; }
    let html;
    try { html = await get(e.url); } catch (err) { problems.push(e.url + ": " + err.message); continue; }
    const p = parseEatHappy(html, e.url, problems);
    if (!p) continue;
    const fibreDeclared = p.per100.fibre != null;
    addExtra({ name: "Eat Happy " + p.name, url: e.url, sku: null, price: p.price, pricePerKg: p.pricePerKg,
      per100: { ...p.per100, fibre: fibreDeclared ? p.per100.fibre : 0 }, basis: "je 100 g laut eathappy.de (ganzer Boxinhalt inkl. Saucen)",
      noData: null, packG: p.packG, drainedG: null, portionG: p.packG, portionNote: "Standardgewicht laut eathappy.de — schwankt täglich",
      fibreDeclared, description: p.description, properties: p.properties, allergens: p.allergens, traces: p.traces,
      ingredients: null, legal: null, storage: "bei max. 7 °C (eathappy.de)", cat: e.cat, brand: "Eat Happy",
      valuesFrom: "offizielle Herstellerseite " + e.url, manufacturerUrl: e.url, eathappy: true, variable: true });
  }
  for (const e of EDEKA_DE) {
    if (!CATS.some(c => c.id === e.cat)) { problems.push("Unbekannte Kategorie „" + e.cat + "“ (" + e.gtin + ")"); continue; }
    const url = "https://www.edeka.de/sortiment/" + e.gtin + "/";
    let html;
    try { html = await get(url); } catch (err) { problems.push(url + ": " + err.message); continue; }
    const p = parseEdekaDe(html, url, problems);
    if (!p) continue;
    addExtra({ name: p.name, url, sku: p.gtin, price: null, priceNote: "not in the EDEKA Graf online shop — no price online (enter it via Label correction)",
      per100: p.per100, basis: "je 100 g laut edeka.de (schema.org-Produktdaten)", noData: null, packG: p.packG, drainedG: null,
      portionG: p.packG, portionNote: "ganze Packung laut edeka.de", fibreDeclared: p.fibreDeclared, allergens: p.allergens,
      ingredients: p.ingredients, legal: null, storage: null, cat: e.cat, brand: p.brand,
      valuesFrom: "offizielle Produktseite " + url, manufacturerUrl: url, noOnlinePrice: true });
  }
  for (const e of OFFLINE) {
    if (!CATS.some(c => c.id === e.cat)) { problems.push("Unbekannte Kategorie „" + e.cat + "“ (" + e.name + ")"); continue; }
    addExtra({ name: e.name, url: null, sku: null, price: null, priceNote: "not in the EDEKA Graf online shop — no price online (enter it via Label correction)",
      per100: { ...e.per100 }, basis: "Referenzwerte je 100 g — " + e.from, noData: null, packG: e.packG, drainedG: null,
      portionG: e.packG, portionNote: "Packungsgröße laut User", fibreDeclared: true, allergens: null, ingredients: null, legal: null, storage: null,
      cat: e.cat, brand: null, valuesFrom: e.from, noOnlinePrice: true, offline: true });
  }
  console.log("");

  const out = {
    _meta: {
      source: "Produktseiten des EDEKA-Graf-Onlineshops " + SHOP + " (" + STORE + "): Name, Preis, Artikelnummer, Nährwerte je 100 g, Abtropfgewicht, Allergene, Zutaten",
      fetchedAt,
      basis: "Offizielle Werte **je 100 g** laut Produktseite × Menge. Die Menge ist **immer die ganze Packung** (User 19.09.2026) — bei Konserven das **Abtropfgewicht**. Ballaststoffe sind freiwillig → fehlen sie, steht 0. Frisches Obst und Gemüse ohne Nährwertangabe bekommt Referenzwerte (FALLBACK/OFFLINE, Quelle je Produkt in _meta.referenceValues)",
      rules: [
        "Produkte des Onlineshops, Namen exakt wie dort; dazu wenige, die der Markt führt, die online fehlen (Burritos von edeka.de, Kulturheidelbeeren) — ohne Preis",
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
        "User 24.09.2026: Eat Happy (Sushi-/Bowl-Theke im Markt) mit Kategorien Bowls und Sushi, Schalter „No Eat Happy“ (Default AN); Standardgewicht von eathappy.de, im Tracker änderbar (das Gewicht schwankt täglich, wie Sushi Daily im London-Tool)",
        "User 24.09.2026: drei EDEKA-Burritos (edeka.de) in „Sandwiches & Wraps“ (vorher „Sandwiches“); der Graf-Onlineshop führt sie nicht → kein Preis",
        "User 24.09.2026: neue Kategorie „Beeren“ (UI „Berries“) mit Kulturheidelbeeren 125 g (weder im Onlineshop noch auf edeka.de → USDA-Werte, kein Preis, kein Link) und Driscoll's Himbeeren 125 g (Seite ohne Nährwerte → Werte der reinen EDEKA-Himbeeren (TK) desselben Shops); frisches Gemüse dazu: EDEKA Bio Möhren Mini 200 g (Werte der Karottenstifte) und EDEKA Herzstücke Mini Pflaumen Tomaten 250 g (USDA „Tomatoes, grape, raw“)",
        "User 22.09.2026: neue Kategorie „Fisch“ (Forelle, 2× Räucherlachs, 2× Thunfisch in Dosen); Schalter „No tuna“ (Default AN) und „No fish“ (Default AUS — ausdrücklich gegen die „No …“-Regel vom 13.09.2026); die Krone-Forelle mit den Werten der verlinkten Herstellerseite",
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
      eatHappy: { source: "eathappy.de (Produktseiten)", note: "Nährwerte je 100 g für den ganzen Boxinhalt inkl. Saucen (Eat Happy); Standardgewicht schwankt täglich → im Tracker änderbar; Preis = Grundpreis je kg × Standardgewicht = Boxpreis, je Abholort ggf. anders",
        products: items.filter(x => x.eathappy).map(x => x.name + " — " + x.packG + " g, " + x.pricePerKg.toFixed(2) + " €/kg → " + x.price.toFixed(2) + " €") },
      noOnlinePrice: items.filter(x => x.noOnlinePrice).map(x => x.name),
      offline: items.filter(x => x.offline).map(x => x.name + " — weder im Onlineshop noch auf edeka.de; Werte: " + x.valuesFrom),
      referenceGaps: Object.fromEntries(items.filter(x => x.refGaps).map(x => [x.name, x.refGaps.join(", ") + " nennt die Referenz nicht → 0"])),
      drained: Object.fromEntries(items.filter(x => x.drainedG != null).map(x => [x.name, x.drainedG + " g von " + x.packG + " g"])),
      noData,
      noFibre,
      frozen: frozen.length ? frozen : "kein Produkt mit Tiefkühl-Hinweis",
      unavailable,   // im Onlineshop gerade nicht verfügbar → letzter bekannter Preis
      fish,   // Schalter „No fish“: Allergen „Fische“ oder Fisch im Namen
      tuna,   // Schalter „No tuna“
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
    console.log("  " + c.name + " (" + list.length + "): " + list.map(x => x.name + " " + x.portionG + " g · " + Math.round(x.per100.kcal * x.portionG / 100) + " kcal · " + (x.price == null ? "Preis ?" : x.price.toFixed(2) + " €")).join(" · "));
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
