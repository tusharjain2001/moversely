"use client";

import {
  AirplaneTilt,
  ArrowRight,
  CalendarBlank,
  CaretUp,
  CheckCircle,
  Cube,
  HouseLine,
  ShippingContainer,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import type { Country } from "@/lib/countries";
import { type Booking, MOVE_TYPES, type MoveDetails, formatMoveDate } from "@/lib/move";
import { destinationPartner, ORIGIN_PARTNER, PRICE_SGD, TRANSIT_DAYS, money } from "@/lib/quote";
import { ORIGIN_CODE, destinationCode } from "@/lib/route";
import { M3_TO_FT3, shippingGuide } from "@/lib/units";
import Logo from "./Logo";

/** Which page the summary sits on: the price is an estimate until payment. */
export type Stage = "quote" | "pay" | "paid";

type Trip = { move: MoveDetails; from: Country; to: Country; totalM3: number };

const m3 = (v: number) => `${v.toFixed(1)} m³`;
const ft3 = (v: number) => `${Math.round(v * M3_TO_FT3).toLocaleString()} ft³`;
const moveTypeLabel = (move: MoveDetails) => MOVE_TYPES.find((t) => t.value === move.moveType)?.label ?? "Household goods";

/** SIN ──✈── SYD, like a flight. */
export function RouteLine({
  move,
  from,
  to,
  size = "md",
  tone = "light",
}: {
  move: MoveDetails;
  from: Country;
  to: Country;
  size?: "md" | "lg";
  tone?: "light" | "onPrimary";
}) {
  const big = size === "lg";
  const onPrimary = tone === "onPrimary";
  const code = `font-extrabold leading-none tracking-[-0.02em] ${big ? "text-[44px] tracking-[-0.03em]" : "text-[26px]"}`;
  const name = `mt-1.5 text-xs font-semibold ${onPrimary ? "text-[#e8f1fb]" : "text-[var(--muted)]"}`;
  const dash = onPrimary ? "border-white/55" : "border-[var(--route-dash)]";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <div className="min-w-0">
        {big && <p className={`text-xs font-semibold ${onPrimary ? "text-[#cfe2f7]" : "text-[var(--muted)]"}`}>From</p>}
        <p className={code}>{ORIGIN_CODE}</p>
        <p className={name}>{from.name}</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex w-full items-center gap-1.5">
          <span className={`flex-1 border-t-[1.5px] border-dashed ${dash}`} />
          <AirplaneTilt
            size={big ? 20 : 16}
            weight="fill"
            className={`rotate-45 ${onPrimary ? "text-white" : "text-[var(--primary)]"}`}
            aria-hidden
          />
          <span className={`flex-1 border-t-[1.5px] border-dashed ${dash}`} />
        </div>
        <p className={`whitespace-nowrap text-[11px] font-bold ${onPrimary ? "text-[#e8f1fb]" : "text-[var(--muted)]"}`}>{TRANSIT_DAYS}</p>
      </div>
      <div className="min-w-0 text-right">
        {big && <p className={`text-xs font-semibold ${onPrimary ? "text-[#cfe2f7]" : "text-[var(--muted)]"}`}>To</p>}
        <p className={code}>{destinationCode(move)}</p>
        <p className={`${name} truncate`}>{move.toPlace ?? to.name}</p>
      </div>
    </div>
  );
}

function SummaryBody({
  trip,
  stage,
  premium,
  booking,
}: {
  trip: Trip;
  stage: Stage;
  premium: number;
  booking?: Booking;
}) {
  const { move, from, to, totalM3 } = trip;
  const insured = stage !== "quote";
  const total = PRICE_SGD + (insured ? premium : 0);
  const facts: [ReactNode, string, ReactNode][] = [
    [<CalendarBlank key="d" size={16} />, "Pickup", formatMoveDate(move)],
    [<HouseLine key="h" size={16} />, "Shipment", moveTypeLabel(move)],
    [
      <Cube key="c" size={16} />,
      "Volume",
      <>
        {m3(totalM3)} <span className="font-semibold text-[var(--muted)]">· {ft3(totalM3)}</span>
      </>,
    ],
    [<ShippingContainer key="s" size={16} />, "Shipping", shippingGuide(totalM3)],
  ];
  return (
    <>
      <div className="mx-6 mt-4 rounded-[14px] bg-[var(--paper)] p-4">
        <RouteLine move={move} from={from} to={to} />
      </div>
      <dl className="grid gap-3 px-6 pt-4 text-sm">
        {facts.map(([icon, label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="flex flex-none items-center gap-2 text-[var(--muted)]">
              {icon}
              {label}
            </dt>
            <dd className="text-right font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="mx-6 mt-4 grid gap-2.5 border-t border-[var(--line)] pt-3.5 text-[13px]">
        {[
          ["Origin partner", ORIGIN_PARTNER.name],
          ["Destination partner", destinationPartner(to.slug)],
          ["Contracting service provider", "Moversly"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className="text-right font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="mx-6 mt-4 grid gap-2.5 border-t border-[var(--line)] pt-3.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt>Moving services</dt>
          <dd className="font-bold">{money(PRICE_SGD)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Optional insurance</dt>
          <dd className={`font-bold ${insured ? "" : "text-[var(--muted)]"}`}>{insured ? money(premium) : "Selected at checkout"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-end justify-between gap-3 bg-[var(--primary-50)] px-6 py-4">
        <span className="min-w-0 text-[13px] font-bold leading-tight">
          {stage === "quote" ? "Estimated moving price" : stage === "paid" ? "Illustrative subtotal (paid)" : "Illustrative subtotal"}
        </span>
        <span className="flex-none whitespace-nowrap text-[26px] font-extrabold leading-none tracking-[-0.02em] text-[var(--primary)]">
          {money(booking?.total ?? total)}
        </span>
      </div>
    </>
  );
}

/** "Your booking": the fare summary beside each step on desktops. */
export function BookingPanel({
  trip,
  stage,
  premium = 0,
  booking,
}: {
  trip: Trip;
  stage: Stage;
  premium?: number;
  booking?: Booking;
}) {
  return (
    <aside className="overflow-hidden rounded-[20px] bg-[var(--card)] shadow-raised lg:sticky lg:top-6">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Your booking</h2>
        {booking && (
          <span className="rounded-md bg-[var(--ok-bg)] px-2 py-1 text-xs font-extrabold tracking-[0.06em] text-[var(--ok)]">
            {booking.ref}
          </span>
        )}
      </div>
      <SummaryBody trip={trip} stage={stage} premium={premium} booking={booking} />
      <p className="px-6 pb-5 pt-3.5 text-xs leading-relaxed text-[var(--muted)]">
        Prototype only. Partner assignments, rates and transit windows are sample configurations, not live confirmations.
      </p>
    </aside>
  );
}

/**
 * Phones: the booking pinned to the bottom of the screen (route, price and the
 * next step), opening into the full summary like a bottom sheet.
 */
export function BookingSheet({
  trip,
  stage,
  premium = 0,
  booking,
  cta,
}: {
  trip: Trip;
  stage: Stage;
  premium?: number;
  booking?: Booking;
  cta?: { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  const { move, totalM3 } = trip;
  const total = booking?.total ?? PRICE_SGD + (stage === "quote" ? 0 : premium);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const ctaButton = cta && (
    <Link
      href={cta.href}
      className="btn-primary flex h-14 w-full items-center justify-between rounded-[14px] px-5 text-base font-extrabold"
    >
      {cta.label}
      <ArrowRight size={18} weight="bold" />
    </Link>
  );

  return (
    <div className="lg:hidden print:hidden">
      {/* Keeps the page's last content clear of the pinned bar. */}
      <div aria-hidden className={cta ? "h-44" : "h-28"} />
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[20px] bg-[var(--card)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-sm bg-[var(--line-strong)]" />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <span>{ORIGIN_CODE}</span>
              <AirplaneTilt size={13} weight="fill" className="text-[var(--primary)]" aria-hidden />
              <span>{destinationCode(move)}</span>
              <span className="truncate font-semibold text-[var(--muted)]">
                · {formatMoveDate(move, true).replace(/ \d{4}$/, "")} · {m3(totalM3)}
              </span>
            </span>
            <span className="mt-0.5 block text-[22px] font-extrabold tracking-[-0.02em]">{money(total)}</span>
          </span>
          <span className="flex flex-none items-center gap-1 text-[13px] font-bold text-[var(--primary)]">
            Details
            <CaretUp size={14} weight="bold" />
          </span>
        </button>
        {ctaButton && <div className="mt-2.5">{ctaButton}</div>}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-[rgb(13_27_62/0.45)]" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your booking"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] overflow-y-auto rounded-t-[20px] bg-[var(--card)] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-sheet"
          >
            <div className="px-4 pt-2">
              <div className="mx-auto h-1 w-9 rounded-sm bg-[var(--line-strong)]" />
            </div>
            <div className="flex items-center justify-between px-6 pt-5">
              <h2 className="text-base font-extrabold tracking-[-0.01em]">Your booking</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="-my-2.5 -mr-3 grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <SummaryBody trip={trip} stage={stage} premium={premium} booking={booking} />
            {ctaButton && <div className="px-4 pt-4">{ctaButton}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** The booking confirmation, printed like a boarding pass. */
export function MovePass({ trip, booking, notch = "var(--paper)" }: { trip: Trip; booking: Booking; notch?: string }) {
  const { move, from, to, totalM3 } = trip;
  const facts: [string, ReactNode][] = [
    ["Name", move.name],
    ["Booking ref", <span key="r" className="tracking-[0.06em] text-[var(--primary)]">{booking.ref}</span>],
    ["Pickup date", formatMoveDate(move, true)],
    [
      "Volume",
      <>
        {m3(totalM3)} <span className="text-[13px] font-semibold text-[var(--muted)]">{ft3(totalM3)}</span>
      </>,
    ],
    ["Shipment", moveTypeLabel(move)],
    ["Shipping", shippingGuide(totalM3)],
  ];
  return (
    <article
      aria-label="Move Pass"
      className="w-full max-w-[440px] [filter:drop-shadow(0_1px_1px_rgb(13_27_62/0.06))_drop-shadow(0_24px_32px_rgb(10_70_150/0.22))]"
    >
      <div className="rounded-t-[20px] bg-[var(--primary)] px-6 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <Logo className="text-[17px]" onPrimary />
          <span className="text-[11px] font-extrabold tracking-[0.16em]">MOVE PASS</span>
        </div>
        <div className="mt-6">
          <RouteLine move={move} from={from} to={to} size="lg" tone="onPrimary" />
        </div>
      </div>
      <div className="bg-[var(--card)] px-6 pb-1 pt-5">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</dt>
              <dd className="mt-1 text-[15px] font-extrabold">{value}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Partners</dt>
            <dd className="mt-1 text-sm font-bold">
              {ORIGIN_PARTNER.name} <span className="font-semibold text-[var(--muted)]">→</span> {destinationPartner(to.slug)}{" "}
              <span className="font-semibold text-[var(--muted)]">· contracted by Moversly</span>
            </dd>
          </div>
        </dl>
      </div>
      <div aria-hidden className="relative flex h-8 items-center bg-[var(--card)]">
        <span className="absolute -left-3.5 h-7 w-7 rounded-full" style={{ background: notch }} />
        <span className="mx-6 flex-1 border-t-2 border-dashed border-[var(--line)]" />
        <span className="absolute -right-3.5 h-7 w-7 rounded-full" style={{ background: notch }} />
      </div>
      <div className="flex items-end justify-between gap-4 rounded-b-[20px] bg-[var(--card)] px-6 pb-6 pt-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Total</p>
          <p className="mt-1 text-[26px] font-extrabold tracking-[-0.02em]">{money(booking.total)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--ok)]">
            <CheckCircle size={15} weight="fill" />
            Confirmed · simulated payment
          </p>
        </div>
        <PassCode seed={booking.ref} />
      </div>
    </article>
  );
}

/** A QR-style pattern drawn from the booking reference (decorative, not scannable). */
function PassCode({ seed }: { seed: string }) {
  const n = 21;
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7741) || 7741;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const finder = (x: number, y: number) => {
    for (const [ox, oy] of [
      [0, 0],
      [14, 0],
      [0, 14],
    ]) {
      const dx = x - ox;
      const dy = y - oy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
    }
    return -1;
  };
  const cells: boolean[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y);
      cells.push(f === -1 ? rnd() > 0.52 : f === 1);
    }
  return (
    <div
      role="img"
      aria-label={`Booking code ${seed}`}
      className="grid h-24 w-24 flex-none grid-cols-[repeat(21,1fr)] rounded-lg p-1.5 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      {cells.map((on, i) => (
        <span key={i} className={on ? "bg-[var(--ink)]" : ""} />
      ))}
    </div>
  );
}
