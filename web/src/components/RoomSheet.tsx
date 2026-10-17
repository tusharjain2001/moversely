"use client";

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

type Props = { room: Room; units: Units; survey: Survey; onClose: () => void };

export default function RoomSheet({ room, units, survey, onClose }: Props) {
  const [camera, setCamera] = useState(false);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stop the room list behind this full-screen sheet from scrolling.
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
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--paper)]">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Back" className="-ml-2 rounded-full p-2 text-xl leading-none">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{room.name}</h2>
          <p className="text-xs text-[var(--muted)]">
            {room.items.length} item{room.items.length === 1 ? "" : "s"} · {formatVolume(total, units)}
          </p>
        </div>
        {room.status === "done" && (
          <button
            onClick={() => survey.resetRoom(room.id)}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Rescan
          </button>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-10 pt-4">
        {(room.status === "empty" || room.status === "error") && (
          <section className="space-y-3">
            {room.status === "error" && (
              <p className="rounded-xl bg-[var(--bad-bg)] p-3 text-sm text-[var(--bad)]">{room.error}</p>
            )}
            <button
              onClick={() => setCamera(true)}
              className="flex w-full items-center gap-4 rounded-2xl bg-[var(--primary)] p-5 text-left text-[var(--on-primary)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--tape)] text-2xl text-black">
                ●
              </span>
              <span>
                <span className="block text-lg font-semibold">Record the room</span>
                <span className="block text-sm opacity-70">Walk around slowly for 20–60 seconds</span>
              </span>
            </button>
            <button
              onClick={openPicker}
              className="flex w-full items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--chip)] text-xl">↑</span>
              <span>
                <span className="block font-semibold">Upload a video</span>
                <span className="block text-sm text-[var(--muted)]">From your gallery or files</span>
              </span>
            </button>
          </section>
        )}

        {busy && <Progress room={room} />}

        {room.status === "done" && room.calibration && (
          <p className="mb-3 text-xs text-[var(--muted)]">
            {room.calibration.method === "none"
              ? "Tip: include a door in the video next time. It lets the AI calibrate sizes precisely."
              : `Sizes calibrated using a ${room.calibration.method} (standard size).`}
          </p>
        )}

        {room.items.length > 0 && (
          <ul className="space-y-2">
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
        )}

        {room.status === "done" && room.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
            No furniture found in this video. Try recording again with better light, or add items manually.
          </p>
        )}

        {!busy && (
          <div className="mt-4">
            {adding ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Add an item</p>
                  <button onClick={() => setAdding(false)} className="text-sm text-[var(--muted)]">
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATALOG.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => {
                        survey.addItem(room.id, c);
                        setAdding(false);
                      }}
                      className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm hover:border-[var(--primary)]"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--ink)]"
              >
                + Add an item the camera missed (boxes, lamps…)
              </button>
            )}
          </div>
        )}
      </div>

      {room.status === "done" && (
        <nav className="border-t border-[var(--line)] bg-[var(--paper)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <button onClick={onClose} className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium">
              ← All rooms
            </button>
            <Link href="/summary" className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]">
              Next: documents →
            </Link>
          </div>
        </nav>
      )}

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

function Progress({ room }: { room: Room }) {
  const uploading = room.status === "uploading";
  // Upload is the first 15% of the bar, analysis the rest.
  const pct = uploading ? room.progress * 15 : 15 + room.progress * 85;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{uploading ? "Uploading video" : room.stage || "Analysing"}</p>
        <p className="font-mono text-sm tabular-nums text-[var(--muted)]">{Math.round(pct)}%</p>
      </div>
      <div className="tape mt-3 h-3 overflow-hidden rounded-full bg-[var(--chip)]">
        <div className="h-full rounded-full bg-[var(--tape)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {uploading
          ? "Keep this page open until the upload finishes."
          : "The AI is finding each item and measuring it in 3D. You can scan another room meanwhile."}
      </p>
    </section>
  );
}
