// Sample figures until the pricing API and the partner list are connected.
// Shared by the quotation and payment pages so both show the same numbers.
export const PRICE_SGD = 3700;
export const TRANSIT_DAYS = "20–35 days";
export const INSURANCE_RATE = 0.03; // of the declared value
export const ORIGIN_PARTNER = { name: "APAC Relocation", role: "packing, collection, export handling and agreed freight coordination" };
const DESTINATION_PARTNERS: Record<string, string> = { australia: "OSS Movers" };
export const DESTINATION_ROLE = "import coordination, delivery and agreed unpacking";

export const destinationPartner = (countrySlug: string) => DESTINATION_PARTNERS[countrySlug] ?? "Local partner (to be confirmed)";

export const money = (sgd: number) => `SGD ${sgd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
