import type { MoveDetails } from "./move";

// Airport codes for cities customers often move to, so the route reads like
// a flight ("SIN → SYD"). Anywhere else shows the country's code.
const CITY_CODES: Record<string, string> = {
  sydney: "SYD", melbourne: "MEL", brisbane: "BNE", perth: "PER", adelaide: "ADL", canberra: "CBR",
  auckland: "AKL", wellington: "WLG", christchurch: "CHC",
  toronto: "YYZ", vancouver: "YVR", montreal: "YUL", calgary: "YYC", ottawa: "YOW",
  london: "LON", manchester: "MAN", edinburgh: "EDI", birmingham: "BHX",
  paris: "PAR", lyon: "LYS", nice: "NCE",
  berlin: "BER", munich: "MUC", frankfurt: "FRA", hamburg: "HAM",
  dubai: "DXB", "abu dhabi": "AUH",
  mumbai: "BOM", delhi: "DEL", "new delhi": "DEL", bengaluru: "BLR", bangalore: "BLR", chennai: "MAA",
  hyderabad: "HYD", pune: "PNQ", kolkata: "CCU",
  "new york": "NYC", "los angeles": "LAX", "san francisco": "SFO", seattle: "SEA", chicago: "CHI",
  boston: "BOS", houston: "HOU", austin: "AUS", dallas: "DFW", miami: "MIA",
  tokyo: "TYO", "hong kong": "HKG", "kuala lumpur": "KUL", bangkok: "BKK", jakarta: "JKT", manila: "MNL",
  singapore: "SIN", shanghai: "SHA", beijing: "BJS", seoul: "SEL", amsterdam: "AMS", zurich: "ZRH", dublin: "DUB",
};

const COUNTRY_CODES: Record<string, string> = {
  australia: "AU", canada: "CA", france: "FR", germany: "DE", india: "IN", "new-zealand": "NZ",
  singapore: "SG", uae: "AE", uk: "GB", usa: "US",
};

/** A place as a short code: city airport code, else country code. */
function placeCode(place: string | undefined, country: string): string {
  // Older saved moves have no picked place for the origin; the country's own name may be a city ("Singapore").
  const city = (place ?? country).split(",")[0].trim().toLowerCase();
  if (CITY_CODES[city]) return CITY_CODES[city];
  return COUNTRY_CODES[country] ?? country.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
}

export const originCode = (move: MoveDetails) => placeCode(move.fromPlace, move.from);
export const destinationCode = (move: MoveDetails) => placeCode(move.toPlace, move.to);
