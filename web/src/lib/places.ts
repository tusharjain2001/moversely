/**
 * Google Places search for the "Moving to" field.
 *
 * The key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (web/.env.local; it is
 * built into the page, so restrict it to the site's domain in Google Cloud).
 * It needs the Maps JavaScript API and Places API enabled. Without a key the
 * form falls back to a plain list of countries.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type AddressComponent = { long_name: string; short_name: string; types: string[] };
export type PlaceResult = { address_components?: AddressComponent[]; name?: string };
export type Autocomplete = { addListener(event: string, fn: () => void): unknown; getPlace(): PlaceResult };
export type Google = {
  maps: {
    places: { Autocomplete: new (input: HTMLInputElement, options: object) => Autocomplete };
    event: { clearInstanceListeners(instance: unknown): void };
  };
};

export const placesEnabled = Boolean(KEY);

let loading: Promise<Google | null> | null = null;

/** Loads the Maps script once; resolves to null if there is no key or it fails. */
export function loadPlaces(): Promise<Google | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const w = window as unknown as { google?: Google };
    if (w.google?.maps?.places) return resolve(w.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(w.google?.maps?.places ? w.google : null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loading;
}

// ISO country codes of the countries we have customs summaries for.
const SLUGS: Record<string, string> = {
  AU: "australia",
  CA: "canada",
  FR: "france",
  DE: "germany",
  IN: "india",
  NZ: "new-zealand",
  SG: "singapore",
  AE: "uae",
  GB: "uk",
  US: "usa",
};

/**
 * "Toronto, Canada", plus the country: our slug when we have its customs
 * summary, otherwise its name ("Japan"). Null when Google returns no country.
 */
export function describePlace(place: PlaceResult): { label: string; country: string } | null {
  const comps = place.address_components ?? [];
  const get = (type: string) => comps.find((c) => c.types.includes(type));
  const country = get("country");
  if (!country) return null;
  const city = get("locality") ?? get("postal_town") ?? get("administrative_area_level_1");
  const label = city && city.long_name !== country.long_name ? `${city.long_name}, ${country.long_name}` : country.long_name;
  return { label, country: SLUGS[country.short_name] ?? country.long_name };
}
