import type { Dims, Item, Units } from "./types";

export const M3_TO_FT3 = 35.3147;
const M_TO_IN = 39.3701;

export function itemVolumeM3(item: Item): number {
  const [l, w, h] = item.dims;
  return l * w * h * item.qty;
}

export function formatVolume(m3: number, units: Units): string {
  return units === "imperial"
    ? `${Math.round(m3 * M3_TO_FT3).toLocaleString()} ft³`
    : `${m3.toFixed(m3 < 10 ? 2 : 1)} m³`;
}

export function formatDims(dims: Dims, units: Units): string {
  return units === "imperial"
    ? dims.map((m) => `${Math.round(m * M_TO_IN)}″`).join(" × ")
    : dims.map((m) => `${Math.round(m * 100)}`).join(" × ") + " cm";
}

/** Value shown in an edit field: inches or centimetres. */
export function toField(m: number, units: Units): number {
  return Math.round(units === "imperial" ? m * M_TO_IN : m * 100);
}

export function fromField(v: number, units: Units): number {
  return units === "imperial" ? v / M_TO_IN : v / 100;
}

export const fieldUnit = (units: Units) => (units === "imperial" ? "in" : "cm");

/**
 * Rough shipping guide for an international move. Usable space is less than
 * the container's nominal volume because furniture never packs perfectly.
 */
export function shippingGuide(totalM3: number): string {
  const ft3 = totalM3 * M3_TO_FT3;
  if (ft3 === 0) return "Scan a room to get an estimate";
  if (ft3 < 350) return "Shared container (LCL) or air freight";
  if (ft3 < 1000) return "20 ft container";
  if (ft3 < 2000) return "40 ft container";
  if (ft3 < 2400) return "40 ft high-cube container";
  return `${Math.ceil(ft3 / 2200)} × 40 ft high-cube containers`;
}
