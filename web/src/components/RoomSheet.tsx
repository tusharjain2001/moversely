"use client";

import {
  ArrowClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Door,
  Eye,
  Lightbulb,
  MagnifyingGlass,
  PersonSimpleWalk,
  SealCheck,
  SquaresFour,
  UploadSimple,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import catalogJson from "@/data/catalog.json";
import type { CatalogItem, Room, Units } from "@/lib/types";
import type { Survey } from "@/lib/useSurvey";
import { formatVolume, itemVolumeM3 } from "@/lib/units";
import CameraRecorder from "./CameraRecorder";
import ItemRow from "./ItemRow";

const CATALOG = (catalogJson.items as unknown as CatalogItem[])
  .filter((c) => c.inventory !== false)
  .sort((a, b) => a.label.localeCompare(b.label));

const TIPS = [
  { icon: PersonSimpleWalk, text: "Walk slowly around the room" },
  { icon: Eye, text: "Keep each item fully in view for a moment" },
  { icon: Door, text: "Include a door — it calibrates the size" },
  { icon: ArrowDown, text: "Point slightly down so the floor is visible" },
];

type Props = { room: Room; units: Units; survey: Survey; onClose: () => void };

export default function RoomSheet({ room, units, survey, onClose }: Props) {
  const [camera, setCamera] = useState(false);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stop the room list behind this sheet from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const busy = room.status === "uploading" || room.status === "processing";
  const total = room.items.reduce((s, it) => s + itemVolumeM3(it), 0);

  const onVideo = useCallback(
    (video: Blob, filename: string) => {
      setCamera(false);
      survey.scanRoom(room.id, video, filename);
    },
    [room.id, survey],
  );
  const openPicker = useCallback(() => {
    setCamera(false);
    fileRef.current?.click();
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      {/* Desktops: the sheet slides over the dimmed room list. */}
      <div aria-hidden className="absolute inset-0 hidden bg-[rgb(13_27_62/0.42)] lg:block" onClick={onClose} />
      <div className="absolute inset-0 flex flex-col bg-[var(--paper)] lg:left-auto lg:w-[640px] lg:shadow-[-30px_0_60px_-30px_rgb(13_27_62/0.5)]">
        <header className="flex min-h-16 items-center gap-2 border-b border-[var(--line)] bg-[var(--card)] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:gap-3 lg:px-6 lg:py-4">
          <button
            onClick={onClose}
            aria-label="Back"
            className="grid h-11 w-11 flex-none place-items-center rounded-full transition hover:bg-[var(--chip)] lg:bg-[var(--paper)]"
          >
            <ArrowLeft size={20} weight="bold" className="lg:hidden" />
            <X size={18} weight="bold" className="hidden lg:block" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold lg:text-[22px] lg:tracking-[-0.01em]">{room.name}</h2>
            <p className="text-xs font-semibold text-[var(--muted)] lg:mt-0.5 lg:text-[13px]">
              {room.items.length} item{room.items.length === 1 ? "" : "s"} · {formatVolume(total, units)}
            </p>
          </div>
          {room.status === "done" && (
            <button
              onClick={() => survey.resetRoom(room.id)}
              className="flex h-11 flex-none items-center gap-1.5 rounded-xl bg-[var(--card)] px-3.5 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:px-4"
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden />
              Rescan
            </button>
          )}
        </header>

        <div className="w-full flex-1 overflow-y-auto px-3 pb-10 pt-3.5 sm:px-4 lg:px-6 lg:pt-5">
          {(room.status === "empty" || room.status === "error") && (
            <section className="grid gap-2.5">
              {room.status === "error" && (
                <p
                  role="alert"
                  className="flex gap-2.5 rounded-[14px] bg-[var(--bad-bg)] p-3.5 text-sm font-semibold leading-snug text-[var(--bad)]"
                >
                  <WarningCircle size={20} weight="fill" className="flex-none" aria-hidden />
                  {room.error}
                </p>
              )}
              <button
                onClick={() => setCamera(true)}
                className="btn-primary flex w-full items-center gap-4 rounded-[20px] p-5 text-left shadow-[0_14px_28px_-16px_var(--primary)]"
              >
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-white">
                  <span className="h-[22px] w-[22px] rounded-full bg-[#e5484d]" />
                </span>
                <span>
                  <span className="block text-lg font-extrabold">Record the room</span>
                  <span className="mt-0.5 block text-sm text-[#e3eefa]">Walk around slowly for 20–60 seconds</span>
                </span>
              </button>
              <button
                onClick={openPicker}
                className="flex w-full items-center gap-4 rounded-[20px] bg-[var(--card)] p-5 text-left shadow-[0_0_0_1px_var(--line)] transition hover:shadow-[0_0_0_1.5px_var(--primary)]"
              >
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[var(--chip)] text-[var(--primary)]">
                  <UploadSimple size={24} weight="bold" aria-hidden />
                </span>
                <span>
                  <span className="block text-[17px] font-extrabold">Upload a video</span>
                  <span className="mt-0.5 block text-sm text-[var(--muted)]">From your gallery or files</span>
                </span>
              </button>
              {room.status === "empty" && (
                <div className="mt-2 rounded-[18px] bg-[var(--card)] px-4.5 py-4 shadow-[0_0_0_1px_var(--line)]">
                  <p className="label-caps text-[var(--muted)]">For the best result</p>
                  <ul className="mt-2.5 grid gap-2.5 text-sm font-semibold">
                    {TIPS.map(({ icon: TipIcon, text }) => (
                      <li key={text} className="flex gap-2.5">
                        <TipIcon size={18} weight="bold" className="flex-none text-[var(--primary)]" aria-hidden />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {busy && <Progress room={room} onClose={onClose} />}

          {room.status === "done" && room.calibration && (
            <p
              className={`mx-1 mb-3 flex items-center gap-2 text-xs font-semibold ${
                room.calibration.method === "none" ? "text-[var(--muted)]" : "text-[var(--ok)]"
              }`}
            >
              {room.calibration.method === "none" ? (
                <Lightbulb size={16} weight="fill" className="flex-none text-[var(--primary)]" aria-hidden />
              ) : (
                <SealCheck size={16} weight="fill" className="flex-none" aria-hidden />
              )}
              {room.calibration.method === "none"
                ? "Tip: include a door in the video next time. It lets the AI calibrate sizes precisely."
                : `Sizes calibrated using a ${room.calibration.method} (standard size).`}
            </p>
          )}

          {room.items.length > 0 && (
            <div className="lg:overflow-hidden lg:rounded-2xl lg:bg-[var(--card)] lg:shadow-[0_0_0_1px_var(--line)]">
              <div
                aria-hidden
                className="hidden grid-cols-[48px_minmax(0,1fr)_150px_110px_80px] gap-3.5 border-b border-[var(--line)] bg-[#f8fafd] px-4 py-2.5 text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)] lg:grid"
              >
                <span />
                <span>ITEM</span>
                <span>SIZE (L × D × H)</span>
                <span>CONFIDENCE</span>
                <span className="text-right">VOLUME</span>
              </div>
              <ul className="grid gap-2 lg:gap-0">
                {room.items.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    units={units}
                    onChange={(f) => survey.updateItem(room.id, it.id, f)}
                    onRemove={() => survey.removeItem(room.id, it.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {room.status === "done" && room.items.length === 0 && (
            <div className="rounded-[18px] border-2 border-dashed border-[#c9d5e8] px-5 py-7 text-center">
              <MagnifyingGlass size={32} weight="duotone" className="mx-auto text-[var(--primary)]" aria-hidden />
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">
                No furniture found in this video. Try recording again with better light, or add items manually.
              </p>
            </div>
          )}

          {!busy && (
            <div className="mt-2.5 lg:mt-4">
              {adding ? (
                <div className="rounded-2xl bg-[var(--card)] p-4 shadow-[0_0_0_1px_var(--line)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-extrabold">Add an item</p>
                    <button
                      onClick={() => setAdding(false)}
                      className="h-9 rounded-lg px-2.5 text-sm font-bold text-[var(--muted)] transition hover:text-[var(--ink)]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {CATALOG.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => {
                          survey.addItem(room.id, c);
                          setAdding(false);
                        }}
                        className="h-9 rounded-full bg-[var(--paper)] px-3 text-[13px] font-bold shadow-[inset_0_0_0_1px_var(--line)] transition hover:bg-[var(--card)] hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="min-h-[52px] w-full rounded-2xl border-2 border-dashed border-[#c9d5e8] px-4 text-sm font-bold text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--ink)]"
                >
                  + Add an item the camera missed (boxes, lamps…)
                </button>
              )}
            </div>
          )}
        </div>

        {room.status === "done" && (
          <nav className="border-t border-[var(--line)] bg-[var(--card)] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 lg:px-6 lg:py-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onClose}
                className="flex h-[52px] items-center gap-2 rounded-[14px] bg-[var(--card)] px-4 text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:px-4.5"
              >
                <ArrowLeft size={16} weight="bold" aria-hidden />
                All rooms
              </button>
              <Link
                href="/quotation"
                className="btn-primary flex h-[52px] flex-1 items-center justify-between gap-8 rounded-[14px] px-4.5 text-[15px] font-extrabold lg:flex-none lg:px-5.5"
              >
                Next: quotation
                <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
            </div>
          </nav>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) survey.scanRoom(room.id, f, f.name);
          e.target.value = "";
        }}
      />

      {camera && (
        <CameraRecorder roomName={room.name} onDone={onVideo} onCancel={() => setCamera(false)} onUnsupported={openPicker} />
      )}
    </div>
  );
}

function Progress({ room, onClose }: { room: Room; onClose: () => void }) {
  const uploading = room.status === "uploading";
  // Upload is the first 15% of the bar, analysis the rest.
  const pct = uploading ? room.progress * 15 : 15 + room.progress * 85;

  if (uploading)
    return (
      <section className="rounded-2xl bg-[var(--card)] p-4 shadow-[0_0_0_1px_var(--line),0_18px_40px_-28px_rgb(10_70_150/0.35)]">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-extrabold">Uploading video</p>
          <p className="text-sm font-extrabold text-[var(--muted)]">{Math.round(pct)}%</p>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded bg-[var(--primary-50)]">
          <div className="h-full rounded bg-[var(--primary)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
          <Warning size={16} weight="bold" className="flex-none text-[var(--warn)]" aria-hidden />
          Keep this page open until the upload finishes.
        </p>
      </section>
    );

  return (
    <>
      <section className="rounded-[20px] bg-[var(--card)] p-5 shadow-[0_0_0_1px_var(--line),0_18px_40px_-28px_rgb(10_70_150/0.35)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-extrabold">{room.stage || "Analysing"}</p>
          <p className="text-[15px] font-extrabold text-[var(--primary)]">{Math.round(pct)}%</p>
        </div>
        <div className="mt-3.5 grid grid-cols-[15fr_85fr] gap-1">
          <div>
            <div className="h-2 rounded bg-[var(--primary)]" />
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
              <Check size={12} weight="bold" className="text-[var(--ok)]" aria-hidden />
              Upload
            </p>
          </div>
          <div>
            <div className="h-2 overflow-hidden rounded bg-[var(--primary-50)]">
              <div
                className="h-full rounded bg-[var(--primary)] transition-[width] duration-700"
                style={{ width: `${room.progress * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-bold text-[var(--primary)]">AI analysis</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          The AI is finding each item and measuring it in 3D. You can scan another room meanwhile.
        </p>
        <button
          onClick={onClose}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-50)] text-sm font-extrabold text-[var(--primary)] transition hover:bg-[var(--primary-100)]"
        >
          <SquaresFour size={16} weight="bold" aria-hidden />
          Scan another room
        </button>
      </section>
      <p className="label-caps mx-1 mb-2.5 mt-5 text-[var(--muted)]">Items will appear here</p>
      <div className="grid gap-2" aria-hidden>
        {[
          [60, 40, ""],
          [50, 35, "opacity-70"],
          [55, 30, "opacity-40"],
        ].map(([a, b, o], i) => (
          <div key={i} className={`flex gap-3 rounded-2xl bg-[var(--card)] p-3 shadow-[0_0_0_1px_var(--line)] ${o}`}>
            <div className="h-15 w-15 flex-none rounded-xl bg-[var(--chip)]" />
            <div className="flex-1 pt-1.5">
              <div className="h-[13px] rounded-[5px] bg-[var(--chip)]" style={{ width: `${a}%` }} />
              <div className="mt-2.5 h-[11px] rounded-[5px] bg-[var(--chip)]" style={{ width: `${b}%` }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
