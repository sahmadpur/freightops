/**
 * Major freight cities per country (ISO 3166-1 alpha-2), feeding the city
 * comboboxes on legs and accounts. Deliberately curated, not exhaustive — the
 * combobox stays creatable, so any city can still be typed in free-form.
 * Extend a country's list here when the desk keeps typing the same city.
 */
export const CITIES: Record<string, readonly string[]> = {
  AE: ["Dubai", "Abu Dhabi", "Sharjah", "Jebel Ali"],
  AM: ["Yerevan", "Gyumri", "Vanadzor"],
  AT: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels"],
  AZ: [
    "Baku", "Sumgait", "Ganja", "Mingachevir", "Shirvan", "Nakhchivan",
    "Lankaran", "Shaki", "Yevlakh", "Khachmaz", "Astara", "Alat",
  ],
  BE: ["Antwerp", "Brussels", "Ghent", "Zeebrugge", "Liège"],
  BG: ["Sofia", "Plovdiv", "Varna", "Burgas", "Ruse"],
  BY: ["Minsk", "Brest", "Gomel", "Vitebsk", "Grodno", "Mogilev"],
  CH: ["Zurich", "Basel", "Geneva", "Bern"],
  CN: [
    "Shanghai", "Shenzhen", "Guangzhou", "Ningbo", "Qingdao", "Tianjin",
    "Beijing", "Xi'an", "Chengdu", "Chongqing", "Yiwu", "Urumqi", "Khorgos",
  ],
  CZ: ["Prague", "Brno", "Ostrava", "Plzeň"],
  DE: [
    "Hamburg", "Berlin", "Munich", "Frankfurt", "Cologne", "Düsseldorf",
    "Stuttgart", "Bremen", "Bremerhaven", "Duisburg", "Leipzig", "Nuremberg", "Hanover",
  ],
  DK: ["Copenhagen", "Aarhus", "Aalborg", "Esbjerg"],
  EE: ["Tallinn", "Tartu", "Narva", "Pärnu"],
  ES: ["Madrid", "Barcelona", "Valencia", "Algeciras", "Bilbao", "Zaragoza", "Seville"],
  FI: ["Helsinki", "Turku", "Tampere", "Kotka", "Oulu"],
  FR: ["Paris", "Marseille", "Lyon", "Le Havre", "Lille", "Bordeaux", "Toulouse", "Strasbourg"],
  GB: ["London", "Felixstowe", "Manchester", "Birmingham", "Southampton", "Liverpool", "Leeds"],
  GE: ["Tbilisi", "Batumi", "Poti", "Kutaisi", "Rustavi", "Gori", "Zugdidi"],
  GR: ["Athens", "Thessaloniki", "Piraeus", "Patras"],
  HR: ["Zagreb", "Rijeka", "Split", "Osijek"],
  HU: ["Budapest", "Debrecen", "Szeged", "Győr", "Miskolc"],
  IE: ["Dublin", "Cork", "Limerick"],
  IR: ["Tehran", "Tabriz", "Bandar Abbas", "Isfahan", "Mashhad", "Rasht", "Astara", "Anzali"],
  IT: ["Milan", "Rome", "Genoa", "Naples", "Trieste", "Venice", "Bologna", "Turin", "Verona", "La Spezia"],
  KZ: ["Almaty", "Astana", "Shymkent", "Aktau", "Atyrau", "Karaganda", "Aktobe", "Khorgos", "Kuryk"],
  LT: ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai"],
  LV: ["Riga", "Daugavpils", "Liepāja", "Ventspils"],
  NL: ["Rotterdam", "Amsterdam", "The Hague", "Utrecht", "Eindhoven", "Venlo"],
  NO: ["Oslo", "Bergen", "Stavanger", "Trondheim"],
  PL: ["Warsaw", "Gdańsk", "Gdynia", "Łódź", "Kraków", "Wrocław", "Poznań", "Katowice", "Szczecin"],
  PT: ["Lisbon", "Porto", "Sines", "Leixões"],
  RO: ["Bucharest", "Constanța", "Cluj-Napoca", "Timișoara", "Iași"],
  RS: ["Belgrade", "Novi Sad", "Niš"],
  RU: [
    "Moscow", "Saint Petersburg", "Novorossiysk", "Rostov-on-Don", "Krasnodar",
    "Astrakhan", "Makhachkala", "Kazan", "Samara", "Yekaterinburg", "Novosibirsk", "Vladivostok",
  ],
  SE: ["Stockholm", "Gothenburg", "Malmö", "Helsingborg"],
  SI: ["Ljubljana", "Koper", "Maribor"],
  SK: ["Bratislava", "Košice", "Žilina"],
  TM: ["Ashgabat", "Turkmenbashi", "Turkmenabat", "Mary", "Dashoguz"],
  TR: [
    "Istanbul", "Mersin", "Izmir", "Ankara", "Bursa", "Gebze", "Kocaeli",
    "Gaziantep", "Trabzon", "Samsun", "Antalya", "Adana", "Kayseri", "Konya",
  ],
  UA: ["Kyiv", "Odesa", "Lviv", "Kharkiv", "Dnipro", "Chornomorsk"],
  UZ: ["Tashkent", "Samarkand", "Bukhara", "Andijan", "Namangan", "Fergana", "Navoi", "Termez"],
};

/** Cities for a country code, [] when the country has no curated list. */
export function citiesFor(code: string): readonly string[] {
  return CITIES[code] ?? [];
}
