"use client";

import Link from "next/link";
import { useState } from "react";
import { useIsClient } from "@/lib/move";
import type { Room, Units } from "@/lib/types";
import { useSurvey } from "@/lib/useSurvey";
import { M3_TO_FT3, formatVolume, itemVolumeM3, shippingGuide } from "@/lib/units";
import RoomSheet from "./RoomSheet";
import StepHeader from "./StepHeader";

export const roomVolume = (r: Room) => r.items.reduce((s, it) => s + itemVolumeM3(it), 0);

function downloadCsv(rooms: Room[]) {
  const rows = [["Room", "Item", "Qty", "Length (in)", "Depth (in)", "Height (in)", "Volume (ft3)", "Confidence"]];
  for (const r of rooms)
    for (const it of r.items)
      rows.push([
        r.name,
        it.label,
        String(it.qty),
        ...it.dims.map((m) => String(Math.round(m * 39.3701))),
        (itemVolumeM3(it) * M3_TO_FT3).toFixed(1),
        it.confidence,
      ]);
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "room-survey.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The survey lives in the browser (localStorage), so it renders only on the
 * client; the server sends a light placeholder.
 */
export default function SurveyApp() {
  const isClient = useIsClient();
  return isClient ? <Survey /> : <div className="min-h-dvh" />;
}

function Survey() {
  const survey = useSurvey();
  const { rooms, units, setUnits } = survey;
  const [openId, setOpenId] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState("");
  const open = rooms.find((r) => r.id === openId);

  const total = rooms.reduce((s, r) => s + roomVolume(r), 0);
  const itemCount = rooms.reduce((s, r) => s + r.items.reduce((n, it) => n + it.qty, 0), 0);
  const scanned = rooms.filter((r) => r.status === "done").length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <StepHeader step={1} right={<UnitToggle units={units} onChange={setUnits} />} />

      <section className="mt-6 night-panel rounded-3xl p-6 text-[var(--on-night)]">
        <p className="text-sm opacity-70">Estimated shipment volume</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">{formatVolume(total, units)}</p>
        <p className="mt-1 text-sm opacity-70">
          {units === "imperial" ? `${total.toFixed(1)} m³` : `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`} ·{" "}
          {itemCount} item{itemCount === 1 ? "" : "s"} · {scanned}/{rooms.length} rooms
        </p>
        <div className="mt-5 rounded-xl bg-white/15 px-4 py-3 text-white">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">Suggested shipping</p>
          <p className="font-semibold">{shippingGuide(total)}</p>
        </div>
      </section>

      {total === 0 && (
        <section className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            ["1", "Record", "a short video of each room"],
            ["2", "AI measures", "every item in 3D"],
            ["3", "Review", "and fix anything it missed"],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
              <p className="font-mono text-xs text-[var(--muted)]">{n}</p>
              <p className="mt-1 text-sm font-semibold">{t}</p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{d}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-8">
        <h1 className="text-lg font-semibold">Your rooms</h1>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {rooms.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setOpenId(r.id)}
                className="flex h-full min-h-28 w-full flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-left transition hover:border-[var(--primary)]"
              >
                <span className="font-semibold">{r.name}</span>
                <RoomStatus room={r} units={units} />
              </button>
            </li>
          ))}
          <li>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newRoom.trim()) return;
                setOpenId(survey.addRoom(newRoom));
                setNewRoom("");
              }}
              className="flex h-full min-h-28 flex-col justify-between rounded-2xl border border-dashed border-[var(--line)] p-4"
            >
              <input
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="Add a room…"
                className="w-full bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
              />
              <button disabled={!newRoom.trim()} className="self-start text-sm font-medium text-[var(--accent)] disabled:opacity-40">
                + Add
              </button>
            </form>
          </li>
        </ul>
      </section>

      {itemCount > 0 && (
        <section className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => downloadCsv(rooms)} className="rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--on-primary)]">
            Download inventory (CSV)
          </button>
          <button
            onClick={() => confirm("Start a new survey? This clears every room.") && survey.resetAll()}
            className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm"
          >
            New survey
          </button>
        </section>
      )}

      <nav className="mt-8 flex items-center justify-between gap-3">
        <Link href="/" className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium">
          ← Back
        </Link>
        <Link href="/quotation" className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]">
          Next: quotation →
        </Link>
      </nav>

      <footer className="mt-10 text-xs leading-relaxed text-[var(--muted)]">
        Sizes are AI estimates from your video. Items marked “Check size” or “Estimate” are worth a quick look before booking.
      </footer>

      {open && <RoomSheet room={open} units={units} survey={survey} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function RoomStatus({ room, units }: { room: Room; units: Units }) {
  switch (room.status) {
    case "empty":
      return <span className="text-sm text-[var(--muted)]">Tap to scan →</span>;
    case "uploading":
      return <span className="text-sm text-[var(--accent)]">Uploading {Math.round(room.progress * 100)}%</span>;
    case "processing":
      return (
        <span className="flex items-center gap-2 text-sm text-[var(--accent)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--tape)]" /> Measuring…
        </span>
      );
    case "error":
      return <span className="text-sm text-[var(--bad)]">Try again</span>;
    case "done":
      return (
        <span className="text-sm">
          <span className="font-semibold tabular-nums">{formatVolume(roomVolume(room), units)}</span>
          <span className="text-[var(--muted)]"> · {room.items.length} items</span>
        </span>
      );
  }
}

function UnitToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div className="flex rounded-full border border-[var(--line)] p-0.5 text-xs font-medium" role="group" aria-label="Units">
      {(["imperial", "metric"] as const).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          aria-pressed={units === u}
          className={`rounded-full px-3 py-1.5 ${units === u ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)]"}`}
        >
          {u === "imperial" ? "ft / in" : "m / cm"}
        </button>
      ))}
    </div>
  );
}
