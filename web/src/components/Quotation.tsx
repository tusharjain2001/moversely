"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { type Country, countryBySlug, countryOrOther } from "@/lib/countries";
import { MOVE_TYPES, type MoveDetails, loadMove, useIsClient } from "@/lib/move";
import { DESTINATION_ROLE, ORIGIN_PARTNER, PRICE_SGD, TRANSIT_DAYS, destinationPartner, money } from "@/lib/quote";
import { M3_TO_FT3 } from "@/lib/units";
import { useSurveyTotals } from "@/lib/useSurveyTotals";
import { MissingMove } from "./MoveSummary";
import StepHeader from "./StepHeader";

const INCLUDED =
  "origin packing and pickup, export coordination, ocean freight arrangement, destination clearance coordination, local delivery and standard unpacking.";
const EXCLUDED =
  "government duties and taxes, inspections, storage, unusual access or hoisting, parking permits, demurrage, special handling, optional insurance and other specified surcharges.";
const TERMS = [
  "This is an illustrative estimate, not a binding offer. Moversly confirms the final price in writing after reviewing your inventory.",
  "The price is based on the inventory volume shown. If the volume changes, the price is adjusted.",
  "The quotation is valid for 14 days.",
  "Transit times are estimates and depend on sailing schedules, customs clearance and capacity.",
  "Duties, taxes and any service not listed as included are charged separately if they apply.",
  "Insurance is optional and is arranged at checkout.",
];

export default function Quotation() {
  const isClient = useIsClient();
  if (!isClient) return <div className="min-h-dvh" />;
  const move = loadMove();
  const from = move && countryBySlug(move.from);
  const to = move && countryOrOther(move.to);
  return move && from && to ? <Quote move={move} from={from} to={to} /> : <MissingMove step={2} />;
}

function Quote({ move, from, to }: { move: MoveDetails; from: Country; to: Country }) {
  const { total, itemCount, measuring } = useSurveyTotals(move);
  const place = move.toPlace ?? to.name;
  const date = moveDate(move);
  const volume = `${total.toFixed(2)} m³`;
  const volumeFt3 = `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`;

  const schedule: { title: string; body: ReactNode }[] = [
    { title: "Pickup", body: date },
    { title: "Export", body: "After pickup and export clearance" },
    { title: "Transit", body: <>Approx. <span className="whitespace-nowrap">{TRANSIT_DAYS}*</span></> },
    { title: "Delivery", body: "Appointment after arrival and customs release" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <StepHeader step={2} />

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_1px_2px_rgb(13_27_62/0.05),0_24px_56px_-36px_rgb(10_70_150/0.35)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your door-to-door moving quotation</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--muted)]">
            <span>
              {from.name} → {place}
            </span>
            <span className="rounded-md bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
              Illustrative instant estimate
            </span>
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Partner label="Origin partner" name={ORIGIN_PARTNER.name} detail={`${from.name} · ${ORIGIN_PARTNER.role}`} />
            <Partner label="Destination partner" name={destinationPartner(to.slug)} detail={`${to.name} · ${DESTINATION_ROLE}`} />
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--ok)]/20 bg-[var(--ok-bg)] p-4">
            <p className="font-semibold">One contracting provider: Moversly</p>
            <p className="mt-1 text-sm leading-relaxed">
              Moversly is the proposed contracting party for the complete door-to-door service and coordinates the origin and
              destination partners, subject to the signed contract.
            </p>
          </div>

          <h2 className="mt-8 text-lg font-semibold">Shipment and delivery schedule</h2>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {schedule.map((s, i) => (
              <li key={s.title} className="rounded-xl bg-[var(--chip)] p-3">
                <p className="text-sm font-semibold">
                  {i + 1}. {s.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
            *Sample transit window only, not a confirmed schedule or delivery guarantee. Exact dates depend on sailing, customs,
            capacity and access.
          </p>

          <dl className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
            <Row label="Confirmed inventory volume (customer-edited)">
              <span className="font-semibold tabular-nums">{volume}</span>
              <span className="ml-2 text-xs text-[var(--muted)]">{volumeFt3}</span>
            </Row>
            <Row label="Illustrative door-to-door moving services">
              <span className="font-semibold tabular-nums">{money(PRICE_SGD)}</span>
            </Row>
            <Row label="Optional insurance" small>
              Selected at checkout
            </Row>
          </dl>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-2xl bg-[var(--chip)] px-4 py-4 sm:px-5">
            <p className="font-semibold">Estimated moving price</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-[var(--primary)] sm:text-4xl">{money(PRICE_SGD)}</p>
          </div>

          {measuring ? (
            <Note>Some rooms are still being measured. The volume will update.</Note>
          ) : (
            itemCount === 0 && (
              <Note>
                You haven&apos;t scanned any rooms yet, so this is a sample price.{" "}
                <Link href="/survey" className="font-semibold text-[var(--primary)] underline underline-offset-2">
                  Scan your rooms
                </Link>{" "}
                for a quotation based on your own inventory.
              </Note>
            )
          )}

          <div className="mt-5 space-y-3 rounded-2xl border border-[var(--primary)]/15 bg-[var(--primary)]/[0.04] p-4 text-sm leading-relaxed sm:p-5">
            <p>
              <span className="font-semibold">Included in this example:</span> {INCLUDED}
            </p>
            <p>
              <span className="font-semibold">Not included unless expressly quoted:</span> {EXCLUDED}
            </p>
          </div>

          <details className="group mt-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold transition-colors hover:text-[var(--primary)] [&::-webkit-details-marker]:hidden">
              <span className="text-xs transition-transform group-open:rotate-90" aria-hidden>
                ▶
              </span>
              Quotation terms and conditions
            </summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--muted)]">
              {TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>

          <nav className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <Link href="/survey" className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium transition hover:border-[var(--primary)]">
              ← Edit survey
            </Link>
            <Link
              href="/payment"
              className="btn-primary rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]"
            >
              Next: payment →
            </Link>
          </nav>
        </section>

        <MoveAside move={move} from={from} to={to} volume={volume} />
      </div>
    </div>
  );
}

export const moveDate = (move: MoveDetails) =>
  new Date(`${move.date}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** The "Your move" panel beside the quotation and payment pages. */
export function MoveAside({ move, from, to, volume }: { move: MoveDetails; from: Country; to: Country; volume: string }) {
  const moveType = MOVE_TYPES.find((t) => t.value === move.moveType)?.label ?? "Household goods";
  return (
    <aside className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 lg:sticky lg:top-6">
      <h2 className="text-lg font-semibold">Your move</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <Row label="From" small>
          <span className="font-semibold text-[var(--ink)]">{from.name}</span>
        </Row>
        <Row label="To" small>
          <span className="font-semibold text-[var(--ink)]">{move.toPlace ?? to.name}</span>
        </Row>
        <Row label="Shipment" small>
          <span className="font-semibold text-[var(--ink)]">{moveType}</span>
        </Row>
        <Row label="Move date" small>
          <span className="font-semibold text-[var(--ink)]">{moveDate(move)}</span>
        </Row>
      </dl>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-[var(--line)] pt-4">
        <span className="text-sm">Estimated inventory volume</span>
        <span className="font-semibold tabular-nums">{volume}</span>
      </div>
      <dl className="mt-4 space-y-3 border-t border-[var(--line)] pt-4 text-sm">
        <div>
          <dt className="text-xs text-[var(--muted)]">Origin partner</dt>
          <dd className="font-semibold">{ORIGIN_PARTNER.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Destination partner</dt>
          <dd className="font-semibold">{destinationPartner(to.slug)}</dd>
        </div>
        <div className="border-t border-[var(--line)] pt-3">
          <dt className="text-xs text-[var(--muted)]">Contracting service provider</dt>
          <dd className="font-semibold">Moversly</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Prototype only. Partner assignments, rates and transit windows are sample configurations, not live confirmations.
      </p>
    </aside>
  );
}

function Partner({ label, name, detail }: { label: string; name: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-semibold">{name}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{detail}</p>
    </div>
  );
}

export function Row({ label, small, children }: { label: string; small?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${small ? "text-xs text-[var(--muted)] sm:text-sm" : ""}`}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap text-right">{children}</dd>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-xl bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn)]">{children}</p>;
}
