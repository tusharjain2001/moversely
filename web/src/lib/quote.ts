// Sample figures until the pricing API and the partner list are connected.
// Shared by the quotation and payment pages so both show the same numbers.
export const PRICE_SGD = 3700;
export const TRANSIT_DAYS = "20–35 days";
export const INSURANCE_RATE = 0.03; // of the declared value
const ORIGIN_PARTNERS: Record<string, string> = { singapore: "APAC Relocation" };
export const ORIGIN_ROLE = "packing, collection, export handling and agreed freight coordination";
const DESTINATION_PARTNERS: Record<string, string> = { australia: "OSS Movers" };
export const DESTINATION_ROLE = "import coordination, delivery and agreed unpacking";

const TO_CONFIRM = "Local partner (to be confirmed)";
export const originPartner = (countrySlug: string) => ORIGIN_PARTNERS[countrySlug] ?? TO_CONFIRM;
export const destinationPartner = (countrySlug: string) => DESTINATION_PARTNERS[countrySlug] ?? TO_CONFIRM;

export const money = (sgd: number) => `SGD ${sgd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
