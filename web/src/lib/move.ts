import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ai-room-survey:move";

export type MoveType = "full" | "partial" | "boxes";

export type MoveDetails = {
  name: string;
  email: string;
  phone: string;
  from: string; // country slug
  to: string; // country slug
  date: string; // yyyy-mm-dd
  moveType: MoveType;
};

export const MOVE_TYPES: { value: MoveType; label: string; short: string }[] = [
  { value: "full", label: "Full household", short: "Full home" },
  { value: "partial", label: "Partial household", short: "Partial" },
  { value: "boxes", label: "A few boxes", short: "Few boxes" },
];

export function loadMove(): MoveDetails | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MoveDetails) : null;
  } catch {
    return null;
  }
}

export function saveMove(move: MoveDetails) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(move));
  } catch {
    // Storage blocked (private mode): the flow still works within this visit.
  }
}

const noop = () => () => {};

/**
 * Everything in this flow is saved in the browser, so pages render only on
 * the client; the server sends a light placeholder.
 */
export const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);
