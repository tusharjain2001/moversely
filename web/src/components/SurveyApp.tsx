"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bathtub,
  Bed,
  Camera,
  Check,
  CircleDashed,
  CookingPot,
  Couch,
  Cpu,
  Desk,
  DownloadSimple,
  ForkKnife,
  Garage,
  House,
  type Icon,
  Plus,
  ShippingContainer,
  UploadSimple,
  Warning,
  ArrowClockwise,
} from "@phosphor-icons/react";
import Link from "next/link";
import { createElement, useState } from "react";
import { countryBySlug, countryOrOther } from "@/lib/countries";
import { loadMove, useIsClient } from "@/lib/move";
import type { Room, Units } from "@/lib/types";
import { useSurvey } from "@/lib/useSurvey";
import { M3_TO_FT3, formatVolume, itemVolumeM3, shippingGuide } from "@/lib/units";
import { BookingPanel, BookingSheet } from "./Booking";
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
 * client; the server sends a skeleton of the page.
 */
export default function SurveyApp() {
  const isClient = useIsClient();
  return isClient ? <Survey /> : <SurveySkeleton />;
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

  // The booking summary needs the move from step 1; the survey works without it.
  const move = loadMove();
  const from = move && countryBySlug(move.from);
  const to = move && countryOrOther(move.to);
  const trip = move && from && to ? { move, from, to, totalM3: total } : null;

  const otherUnit = units === "imperial" ? `${total.toFixed(1)} m³` : `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`;
  const summaryLine = `${otherUnit} · ${itemCount} item${itemCount === 1 ? "" : "s"} · ${scanned}/${rooms.length} rooms`;

  const actions = itemCount > 0 && (
    <>
      <button
        onClick={() => downloadCsv(rooms)}
        className="flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--card)] px-3.5 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:h-11 lg:flex-none lg:justify-start lg:px-3 lg:text-[13px] lg:bg-white/15 lg:text-white lg:shadow-none lg:hover:bg-white/25 lg:hover:shadow-none"
      >
        <DownloadSimple size={16} weight="bold" aria-hidden />
        Download inventory (CSV)
      </button>
      <button
        onClick={() => confirm("Start a new survey? This clears every room.") && survey.resetAll()}
        className="h-12 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--ink)] lg:h-11 lg:px-3 lg:text-[13px] lg:text-[#e3eefa] lg:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.3)] lg:hover:bg-white/10 lg:hover:text-white"
      >
        New survey
      </button>
    </>
  );

  return (
    <div className="min-h-dvh">
      <StepHeader step={1} right={<UnitToggle units={units} onChange={setUnits} />} />

      <div
        className={`mx-auto max-w-[1280px] px-3 pb-16 pt-4 sm:px-6 lg:px-12 lg:pt-8 ${
          trip ? "lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8" : ""
        }`}
      >
        <main>
          {/* Volume hero */}
          <section className="rounded-[22px] bg-[var(--primary)] p-5 text-white lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end lg:gap-8 lg:rounded-3xl lg:px-8 lg:py-7">
            <div>
              <p className="text-[13px] font-bold text-[#cfe2f7] lg:text-sm">Estimated shipment volume</p>
              <p
                className={`mt-1 text-[52px] font-extrabold leading-none tracking-[-0.04em] lg:mt-1.5 lg:text-[72px] ${
                  total === 0 ? "text-[var(--primary-200)]" : ""
                }`}
              >
                {formatVolume(total, units)}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#e3eefa] lg:mt-2.5 lg:text-[15px]">{summaryLine}</p>
              {total > 0 && (
                <div
                  className="mt-3.5 grid max-w-[420px] gap-[3px] lg:mt-4.5 lg:gap-1"
                  style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(0, 1fr))` }}
                  aria-hidden
                >
                  {rooms.map((r) => (
                    <span key={r.id} title={r.name} className={`h-[5px] rounded-sm lg:h-1.5 ${SEGMENT[r.status]}`} />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-2.5 lg:mt-0">
              {total > 0 ? (
                <div className="flex items-center gap-3 rounded-[14px] bg-[var(--card)] px-3.5 py-3 text-[var(--ink)] lg:gap-3.5 lg:rounded-2xl lg:px-4.5 lg:py-4">
                  <span className="grid flex-none place-items-center text-[var(--primary)] lg:h-11 lg:w-11 lg:rounded-xl lg:bg-[var(--primary-50)]">
                    <ShippingContainer size={24} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)]">SUGGESTED SHIPPING</span>
                    <span className="mt-0.5 block text-[15px] font-extrabold lg:text-[17px]">{shippingGuide(total)}</span>
                  </span>
                </div>
              ) : (
                <div className="rounded-[14px] bg-white/12 px-3.5 py-3 lg:rounded-2xl lg:px-4.5 lg:py-4">
                  <span className="block text-[11px] font-extrabold tracking-[0.08em] text-[#cfe2f7]">SUGGESTED SHIPPING</span>
                  <span className="block text-[15px] font-extrabold">{shippingGuide(total)}</span>
                </div>
              )}
              {actions && <div className="hidden gap-2 lg:grid lg:grid-cols-[1fr_auto]">{actions}</div>}
            </div>
          </section>

          {total === 0 && (
            <ol className="mt-3 grid grid-cols-3 gap-2 lg:mt-4 lg:gap-3">
              {[
                ["1", "Record", "a short video of each room"],
                ["2", "AI measures", "every item in 3D"],
                ["3", "Review", "and fix anything it missed"],
              ].map(([n, t, d]) => (
                <li key={n} className="rounded-2xl bg-[var(--card)] p-3 shadow-[0_0_0_1px_var(--line)] lg:flex lg:items-center lg:gap-3 lg:p-4">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--primary-50)] text-xs font-extrabold text-[var(--primary)]">
                    {n}
                  </span>
                  <span className="block">
                    <span className="mt-2.5 block text-sm font-extrabold lg:mt-0">{t}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <section className="mt-6 lg:mt-8">
            <div className="flex items-end justify-between px-1 lg:px-0">
              <h1 className="text-[19px] font-extrabold tracking-[-0.02em] lg:text-[22px]">Your rooms</h1>
              <span className="hidden text-[13px] font-semibold text-[var(--muted)] sm:inline">Tap a room to scan or review it</span>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:mt-3.5 lg:gap-3.5">
              {rooms.map((r) => (
                <li key={r.id}>
                  <RoomCard room={r} units={units} onOpen={() => setOpenId(r.id)} />
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
                  className="flex h-full min-h-[164px] flex-col justify-between gap-3 rounded-[18px] border-2 border-dashed border-[#c9d5e8] p-3.5 transition focus-within:border-[var(--primary)] lg:min-h-[184px] lg:p-4"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px] border-dashed border-[var(--route-dash)] text-[var(--primary)] lg:h-12 lg:w-12 lg:rounded-[14px]">
                    <Plus size={22} weight="bold" aria-hidden />
                  </span>
                  <span className="block">
                    <input
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      placeholder="Add a room…"
                      aria-label="Room name"
                      className="h-11 w-full min-w-0 rounded-[11px] bg-[var(--card)] px-3 text-[15px] font-bold shadow-[0_0_0_1px_var(--line)] outline-none placeholder:font-bold placeholder:text-[#8c9ab3] focus:shadow-[0_0_0_2px_var(--primary)]"
                    />
                    <button
                      disabled={!newRoom.trim()}
                      className="mt-2 inline-flex h-10 items-center rounded-[11px] px-3.5 text-[13px] font-extrabold text-[var(--primary)] shadow-[inset_0_0_0_1.5px_var(--primary)] transition hover:bg-[var(--primary-50)] disabled:pointer-events-none disabled:opacity-45 lg:text-sm"
                    >
                      + Add room
                    </button>
                  </span>
                </form>
              </li>
            </ul>
          </section>

          {actions && <div className="mt-4 flex gap-2 lg:hidden">{actions}</div>}

          <nav
            className={`mt-5 items-center justify-between gap-2 lg:mt-7 lg:border-t lg:border-[var(--line)] lg:pt-6 ${
              trip ? "hidden lg:flex" : "flex"
            }`}
          >
            <Link
              href="/"
              className="flex h-[52px] items-center gap-2 rounded-[14px] bg-[var(--card)] px-4.5 text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:h-12 lg:rounded-xl"
            >
              <ArrowLeft size={16} weight="bold" aria-hidden />
              Back
            </Link>
            <Link
              href="/quotation"
              className="btn-primary flex h-[52px] flex-1 items-center justify-between gap-10 rounded-[14px] px-4.5 text-[15px] font-extrabold lg:h-14 lg:flex-none lg:px-6 lg:text-base"
            >
              Next: quotation
              <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          </nav>

          <footer className="mt-5 px-1 text-xs leading-relaxed text-[var(--muted)] lg:mt-6 lg:px-0 lg:text-[13px]">
            Sizes are AI estimates from your video. Items marked “Check size” or “Estimate” are worth a quick look before booking.
          </footer>
        </main>

        {trip && (
          <>
            <div className="hidden lg:block">
              <BookingPanel trip={trip} stage="quote" />
            </div>
            <BookingSheet trip={trip} stage="quote" cta={{ label: "Next: quotation", href: "/quotation" }} />
          </>
        )}
      </div>

      {open && <RoomSheet room={open} units={units} survey={survey} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Shown while the browser loads the saved survey. */
function SurveySkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true">
      <StepHeader step={1} />
      <div className="mx-auto max-w-[1280px] px-3 pt-4 sm:px-6 lg:px-12 lg:pt-8">
        <div className="h-[178px] rounded-[22px] bg-[#dce7f5] lg:h-[220px] lg:rounded-3xl" />
        <div className="ml-1 mt-7 h-[18px] w-[120px] rounded-md bg-[var(--line)]" />
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-3.5">
          {[70, 60, 65, 55, 62, 50].map((w, i) => (
            <div key={i} className="h-[150px] rounded-[18px] bg-[var(--card)] p-3.5 shadow-[0_0_0_1px_var(--line)] lg:h-[184px]">
              <div className="h-11 w-11 rounded-xl bg-[var(--chip)]" />
              <div className="mt-11 h-3.5 rounded-[5px] bg-[var(--chip)]" style={{ width: `${w}%` }} />
              <div className="mt-2.5 h-3 w-[45%] rounded-[5px] bg-[var(--chip)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROOM_ICONS: [RegExp, Icon][] = [
  [/living|lounge|family/i, Couch],
  [/bed|guest|kid|nursery/i, Bed],
  [/kitchen/i, CookingPot],
  [/dining/i, ForkKnife],
  [/office|study/i, Desk],
  [/garage|store|shed/i, Garage],
  [/bath/i, Bathtub],
];
const roomIcon = (name: string) => ROOM_ICONS.find(([re]) => re.test(name))?.[1] ?? House;

// Progress segments in the volume hero, one per room.
const SEGMENT: Record<Room["status"], string> = {
  done: "bg-white",
  processing: "bg-[#7fb2e8]",
  uploading: "bg-[#7fb2e8]",
  error: "bg-[#f59e94]",
  empty: "bg-white/22",
};

const STATUS: Record<Room["status"], { chip: string; icon: Icon; chipClass: string; tileClass: string; ring: string }> = {
  done: {
    chip: "Done",
    icon: Check,
    chipClass: "bg-[var(--ok-bg)] text-[var(--ok)]",
    tileClass: "bg-[var(--ok-bg)] text-[var(--ok)]",
    ring: "shadow-[0_0_0_1px_#bfe3cb]",
  },
  processing: {
    chip: "Measuring",
    icon: Cpu,
    chipClass: "bg-[var(--primary-50)] text-[var(--primary)]",
    tileClass: "bg-[var(--primary-50)] text-[var(--primary)]",
    ring: "shadow-[0_0_0_1.5px_var(--primary-300)]",
  },
  uploading: {
    chip: "Uploading",
    icon: UploadSimple,
    chipClass: "bg-[var(--primary-50)] text-[var(--primary)]",
    tileClass: "bg-[var(--primary-50)] text-[var(--primary)]",
    ring: "shadow-[0_0_0_1.5px_var(--primary-300)]",
  },
  error: {
    chip: "Failed",
    icon: Warning,
    chipClass: "bg-[var(--bad-bg)] text-[var(--bad)]",
    tileClass: "bg-[var(--bad-bg)] text-[var(--bad)]",
    ring: "shadow-[0_0_0_1px_#f2c4bf]",
  },
  empty: {
    chip: "Not scanned",
    icon: CircleDashed,
    chipClass: "bg-[var(--chip)] text-[var(--muted)]",
    tileClass: "bg-[var(--chip)] text-[var(--primary)]",
    ring: "shadow-[0_0_0_1px_var(--line)]",
  },
};

function RoomCard({ room, units, onOpen }: { room: Room; units: Units; onOpen: () => void }) {
  const s = STATUS[room.status];
  return (
    <button
      onClick={onOpen}
      className={`group flex h-full min-h-[164px] w-full flex-col justify-between gap-3 rounded-[18px] bg-[var(--card)] p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1.5px_var(--primary),0_18px_36px_-22px_rgb(10_70_150/0.45)] active:translate-y-0 lg:min-h-[184px] lg:gap-4 lg:p-4.5 ${s.ring}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={`grid h-11 w-11 place-items-center rounded-xl lg:h-12 lg:w-12 lg:rounded-[14px] ${s.tileClass}`}>
          {createElement(roomIcon(room.name), { size: 26, weight: "duotone", "aria-hidden": true })}
        </span>
        <span
          className={`inline-flex h-[26px] min-w-[26px] items-center justify-center gap-[5px] rounded-full text-xs font-extrabold sm:px-[9px] ${s.chipClass}`}
          aria-label={s.chip}
        >
          {createElement(s.icon, { size: 13, weight: "bold", "aria-hidden": true })}
          <span className="hidden sm:inline">{s.chip}</span>
        </span>
      </span>
      <span className="block">
        <span className="block text-[15px] font-extrabold lg:text-[17px]">{room.name}</span>
        <RoomStatus room={room} units={units} />
      </span>
    </button>
  );
}

function RoomStatus({ room, units }: { room: Room; units: Units }) {
  switch (room.status) {
    case "empty":
      return (
        <span className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-[11px] bg-[var(--primary)] px-3 text-[13px] font-extrabold text-[var(--on-primary)] transition group-hover:bg-[var(--primary-hover)] lg:mt-2.5 lg:gap-2 lg:px-3.5 lg:text-sm">
          <Camera size={16} weight="bold" aria-hidden /> Scan room
        </span>
      );
    case "uploading":
    case "processing": {
      const pct = Math.round(room.progress * 100);
      return (
        <span className="mt-1.5 block lg:mt-2">
          <span className="flex justify-between text-xs font-bold text-[var(--primary)] lg:text-[13px]">
            <span>{room.status === "uploading" ? "Uploading" : "Measuring…"}</span>
            <span>{pct}%</span>
          </span>
          <span className="mt-[5px] block h-[5px] overflow-hidden rounded-sm bg-[var(--primary-50)] lg:mt-1.5 lg:h-1.5">
            <span className="block h-full rounded-sm bg-[var(--primary)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </span>
        </span>
      );
    }
    case "error":
      return (
        <span className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-[11px] px-3 text-[13px] font-extrabold text-[var(--bad)] shadow-[inset_0_0_0_1.5px_#e8a39c] lg:mt-2.5 lg:gap-2 lg:px-3.5 lg:text-sm">
          <ArrowClockwise size={16} weight="bold" aria-hidden /> Try again
        </span>
      );
    case "done":
      return (
        <span className="mt-1 block text-[13px] lg:mt-1.5 lg:text-sm">
          <span className="font-extrabold">{formatVolume(roomVolume(room), units)}</span>
          <span className="font-semibold text-[var(--muted)]"> · {room.items.length} items</span>
        </span>
      );
  }
}

function UnitToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div className="flex rounded-[10px] bg-[var(--chip)] p-[3px] text-xs font-bold lg:text-[13px] lg:font-semibold" role="group" aria-label="Units">
      {(["imperial", "metric"] as const).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          aria-pressed={units === u}
          className={`h-[38px] rounded-lg px-2.5 transition lg:h-[34px] lg:px-3 ${
            units === u ? "bg-[var(--card)] text-[var(--ink)] shadow-[0_1px_2px_rgb(13_27_62/0.12)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {u === "imperial" ? "ft / in" : "m / cm"}
        </button>
      ))}
    </div>
  );
}
