"use client";

import { Check, Cube, type Icon, Plus, Question, Ruler, Trash } from "@phosphor-icons/react";
import { createElement, useState } from "react";
import type { Dims, Item, Units } from "@/lib/types";
import { fieldUnit, formatDims, formatVolume, fromField, itemVolumeM3, toField } from "@/lib/units";

const BADGES: Record<Item["confidence"], { label: string; icon: Icon; className: string; hint: string }> = {
  high: { label: "Measured", icon: Check, className: "bg-[var(--ok-bg)] text-[var(--ok)]", hint: "Seen clearly from several angles" },
  medium: { label: "Check size", icon: Ruler, className: "bg-[var(--warn-bg)] text-[var(--warn)]", hint: "Partly estimated — worth a quick check" },
  low: { label: "Estimate", icon: Question, className: "bg-[var(--bad-bg)] text-[var(--bad)]", hint: "Seen briefly — please confirm the size" },
  manual: { label: "Added", icon: Plus, className: "bg-[var(--chip)] text-[var(--muted)]", hint: "Typical size for this item" },
};

type Props = {
  item: Item;
  units: Units;
  onChange: (fields: Partial<Item>) => void;
  onRemove: () => void;
};

/**
 * One item in a room: a card on phones, a table row in the desktop room panel
 * (the column header lives in RoomSheet). "Edit" opens sizes and quantity.
 */
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

  const badgeChip = (
    <span
      title={badge.hint}
      className={`inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11px] font-extrabold lg:h-6 lg:text-xs ${badge.className}`}
    >
      {createElement(badge.icon, { size: 12, weight: "bold", "aria-hidden": true })}
      {badge.label}
    </span>
  );
  const editButton = (
    <button
      onClick={() => setEditing((e) => !e)}
      aria-expanded={editing}
      className="-my-[5px] h-8 rounded-lg px-2.5 text-[13px] font-extrabold text-[var(--primary)] transition hover:bg-[var(--primary-50)] lg:-mx-2.5 lg:my-0 lg:h-7"
    >
      {editing ? "Done" : "Edit"}
    </button>
  );
  const volume = formatVolume(itemVolumeM3(item), units);

  return (
    <li
      className={`rounded-2xl bg-[var(--card)] p-3 transition lg:rounded-none lg:border-b lg:border-[var(--chip)] lg:px-4 lg:py-2.5 lg:shadow-none lg:last:border-b-0 lg:hover:bg-[#f8fafd] ${
        editing
          ? "shadow-[0_0_0_1.5px_var(--primary),0_12px_28px_-18px_rgb(10_70_150/0.45)] lg:bg-[#f8fafd]"
          : "shadow-[0_0_0_1px_var(--line)]"
      }`}
    >
      <div className="flex gap-3 lg:grid lg:grid-cols-[48px_minmax(0,1fr)_150px_110px_80px] lg:items-center lg:gap-3.5">
        <div className="h-15 w-15 flex-none overflow-hidden rounded-xl bg-[var(--chip)] lg:h-12 lg:w-12 lg:rounded-[10px]">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 crop from the AI, nothing to optimise
            <img src={item.thumbnail} alt={item.label} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[#8c9ab3]">
              <Cube size={26} aria-hidden />
            </div>
          )}
        </div>

        {/* Phones */}
        <div className="min-w-0 flex-1 lg:hidden">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-extrabold">
              {item.qty > 1 && <span className="text-[var(--muted)]">{item.qty}× </span>}
              {item.label}
            </p>
            <p className="flex-none text-sm font-extrabold">{volume}</p>
          </div>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--muted)]">{formatDims(item.dims, units)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {badgeChip}
            {editButton}
          </div>
        </div>

        {/* Desktop table cells */}
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[15px] font-extrabold">
            {item.qty > 1 && <span className="text-[var(--muted)]">{item.qty}× </span>}
            {item.label}
          </p>
          {editButton}
        </div>
        <p className="hidden text-sm font-semibold text-[var(--muted)] lg:block">{formatDims(item.dims, units)}</p>
        <div className="hidden lg:block">{badgeChip}</div>
        <p className="hidden text-right text-[15px] font-extrabold lg:block">{volume}</p>
      </div>

      {item.notes.length > 0 && !editing && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] lg:ml-[62px]">{item.notes.join(" · ")}</p>
      )}

      {editing && (
        <div className="mt-3 border-t border-[var(--line)] pt-3 lg:ml-[62px]">
          <div className="grid grid-cols-3 gap-2">
            {names.map((name, i) => (
              <label key={`${name}-${units}`} className="text-xs font-bold text-[var(--muted)]">
                {name} ({fieldUnit(units)})
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  defaultValue={toField(item.dims[i], units)}
                  onBlur={(e) => setDim(i, e.target.value)}
                  className="mt-1 h-12 w-full min-w-0 rounded-[10px] bg-[#f8fafd] px-3 text-base font-extrabold text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none transition focus:bg-[var(--card)] focus:shadow-[inset_0_0_0_2px_var(--primary)]"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[13px] font-bold">
              <span className="mr-1 text-[var(--muted)]">Quantity</span>
              <button
                aria-label="Decrease quantity"
                onClick={() => onChange({ qty: Math.max(1, item.qty - 1) })}
                className="h-11 w-11 rounded-full bg-[var(--card)] text-lg shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
              >
                −
              </button>
              <span className="w-6 text-center text-base font-extrabold">{item.qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => onChange({ qty: item.qty + 1 })}
                className="h-11 w-11 rounded-full bg-[var(--card)] text-lg shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
              >
                +
              </button>
            </div>
            <button
              onClick={onRemove}
              className="flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-extrabold text-[var(--bad)] transition hover:bg-[var(--bad-bg)]"
            >
              <Trash size={16} weight="bold" aria-hidden />
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
