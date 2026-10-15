"use client";

import { useState } from "react";
import type { Dims, Item, Units } from "@/lib/types";
import { fieldUnit, formatDims, formatVolume, fromField, itemVolumeM3, toField } from "@/lib/units";

const BADGES: Record<Item["confidence"], { label: string; className: string; hint: string }> = {
  high: { label: "Measured", className: "bg-[var(--ok-bg)] text-[var(--ok)]", hint: "Seen clearly from several angles" },
  medium: { label: "Check size", className: "bg-[var(--warn-bg)] text-[var(--warn)]", hint: "Partly estimated — worth a quick check" },
  low: { label: "Estimate", className: "bg-[var(--bad-bg)] text-[var(--bad)]", hint: "Seen briefly — please confirm the size" },
  manual: { label: "Added", className: "bg-[var(--chip)] text-[var(--muted)]", hint: "Typical size for this item" },
};

type Props = {
  item: Item;
  units: Units;
  onChange: (fields: Partial<Item>) => void;
  onRemove: () => void;
};

export default function ItemRow({ item, units, onChange, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const badge = BADGES[item.confidence];
  const names = ["Length", "Depth", "Height"];

  const setDim = (i: number, value: string) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    const dims = [...item.dims] as Dims;
    dims[i] = fromField(v, units);
    onChange({ dims, confidence: item.confidence === "manual" ? "manual" : "high", notes: [] });
  };

  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--chip)]">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 crop from the AI, nothing to optimise
            <img src={item.thumbnail} alt={item.label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl text-[var(--muted)]">▢</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">
              {item.qty > 1 && <span className="text-[var(--muted)]">{item.qty}× </span>}
              {item.label}
            </p>
            <p className="shrink-0 text-sm font-semibold tabular-nums">{formatVolume(itemVolumeM3(item), units)}</p>
          </div>
          <p className="mt-0.5 text-sm tabular-nums text-[var(--muted)]">{formatDims(item.dims, units)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span title={badge.hint} className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
            <button onClick={() => setEditing((e) => !e)} className="text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline">
              {editing ? "Done" : "Edit"}
            </button>
          </div>
        </div>
      </div>

      {item.notes.length > 0 && !editing && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.notes.join(" · ")}</p>
      )}

      {editing && (
        <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
          <div className="grid grid-cols-3 gap-2">
            {names.map((name, i) => (
              <label key={`${name}-${units}`} className="text-xs text-[var(--muted)]">
                {name} ({fieldUnit(units)})
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  defaultValue={toField(item.dims[i], units)}
                  onBlur={(e) => setDim(i, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-2 font-mono text-base text-[var(--ink)]"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Quantity</span>
              <button
                aria-label="Decrease quantity"
                onClick={() => onChange({ qty: Math.max(1, item.qty - 1) })}
                className="h-9 w-9 rounded-full border border-[var(--line)] text-lg"
              >
                −
              </button>
              <span className="w-6 text-center font-mono tabular-nums">{item.qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => onChange({ qty: item.qty + 1 })}
                className="h-9 w-9 rounded-full border border-[var(--line)] text-lg"
              >
                +
              </button>
            </div>
            <button onClick={onRemove} className="rounded-full px-3 py-2 text-sm font-medium text-[var(--bad)] hover:bg-[var(--bad-bg)]">
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
