import { useEffect } from "react";
import { roomVolume } from "@/components/SurveyApp";
import { saveSurvey } from "./crm";
import type { MoveDetails } from "./move";
import { M3_TO_FT3 } from "./units";
import { useSurvey } from "./useSurvey";

/**
 * The survey's totals, for the pages after the survey. Once every room has
 * finished, the result is also added to the team's lead (the server emails
 * the team only the first time).
 */
export function useSurveyTotals(move: MoveDetails) {
  const { rooms, units } = useSurvey();
  const total = rooms.reduce((s, r) => s + roomVolume(r), 0);
  const itemCount = rooms.reduce((s, r) => s + r.items.reduce((n, it) => n + it.qty, 0), 0);
  const measuring = rooms.some((r) => r.status === "uploading" || r.status === "processing");

  useEffect(() => {
    if (move.leadId && !measuring) saveSurvey(move.leadId, itemCount, total * M3_TO_FT3).catch(() => {});
  }, [move.leadId, measuring, itemCount, total]);

  return { units, total, itemCount, measuring };
}
