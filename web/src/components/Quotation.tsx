"use client";

import {
  AirplaneLanding,
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  Boat,
  CaretDown,
  CheckCircle,
  HourglassMedium,
  HouseLine,
  Info,
  MinusCircle,
  ShieldCheck,
  Stamp,
  Truck,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { type Country, countryBySlug, countryOrOther } from "@/lib/countries";
import { type MoveDetails, formatMoveDate, loadMove, useIsClient } from "@/lib/move";
import { DESTINATION_ROLE, ORIGIN_PARTNER, PRICE_SGD, TRANSIT_DAYS, destinationPartner, money } from "@/lib/quote";
import { ORIGIN_CODE, destinationCode } from "@/lib/route";
import { M3_TO_FT3 } from "@/lib/units";
import { useSurveyTotals } from "@/lib/useSurveyTotals";
import { BookingPanel, BookingSheet } from "./Booking";
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

/** Shared page frame for the booking steps: header, then content beside the booking summary. */
export const pageGrid =
  "mx-auto grid max-w-[1280px] gap-8 px-3 pb-16 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-12 lg:pb-[72px] lg:pt-8";

/** Flat white card with a hairline edge. */
export const flatCard = "rounded-[18px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line)] lg:rounded-[20px]";

function Quote({ move, from, to }: { move: MoveDetails; from: Country; to: Country }) {
  const { total, itemCount, measuring } = useSurveyTotals(move);
  const place = move.toPlace ?? to.name;
  const date = formatMoveDate(move);
  const volume = `${total.toFixed(2)} m³`;
  const volumeFt3 = `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`;
  const trip = { move, from, to, totalM3: total };

  const schedule: { title: string; body: ReactNode; icon: ReactNode }[] = [
    { title: "Pickup", body: date, icon: <Truck size={18} weight="bold" /> },
    { title: "Export", body: "After pickup and export clearance", icon: <Stamp size={18} weight="bold" /> },
    {
      title: "Transit",
      body: (
        <>
          Approx. <span className="whitespace-nowrap">{TRANSIT_DAYS}*</span>
        </>
      ),
      icon: <Boat size={18} weight="bold" />,
    },
    { title: "Delivery", body: "Appointment after arrival and customs release", icon: <HouseLine size={18} weight="bold" /> },
  ];

  return (
    <div className="min-h-dvh">
      <StepHeader step={2} />

      <div className={pageGrid}>
        <main className="grid min-w-0 gap-3 lg:gap-4">
          <div className="px-1 sm:px-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] lg:text-[34px] lg:tracking-[-0.025em]">
              Your door-to-door moving quotation
            </h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-semibold text-[var(--muted)]">
              <span className="hidden lg:inline">
                {from.name} → {place}
              </span>
              <span className="inline-flex h-[26px] items-center rounded-[7px] bg-[var(--primary-50)] px-2.5 text-xs font-extrabold text-[var(--primary)]">
                Illustrative instant estimate
              </span>
            </p>
          </div>

          {measuring ? (
            <Note icon={<HourglassMedium size={18} weight="bold" />}>Some rooms are still being measured. The volume will update.</Note>
          ) : (
            itemCount === 0 && (
              <Note icon={<Info size={18} weight="bold" />}>
                <span>
                  You haven&apos;t scanned any rooms yet, so this is a sample price.{" "}
                  <Link href="/survey" className="font-extrabold text-[var(--primary)] underline underline-offset-2">
                    Scan your rooms
                  </Link>{" "}
                  for a quotation based on your own inventory.
                </span>
              </Note>
            )
          )}

          {/* Itinerary */}
          <section className="overflow-hidden rounded-[20px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_18px_40px_-28px_rgb(10_70_150/0.35)] lg:rounded-[22px]">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--line)] p-[18px] lg:gap-7 lg:px-7 lg:py-6">
              <div className="min-w-0">
                <p className="hidden text-xs font-bold text-[var(--muted)] lg:block">Pickup · {formatMoveDate(move, true)}</p>
                <p className="text-[30px] font-extrabold leading-none tracking-[-0.03em] lg:mt-0.5 lg:text-[40px] lg:leading-[1.05]">
                  {ORIGIN_CODE}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)] lg:mt-0 lg:text-sm">{from.name}</p>
              </div>
              <div className="flex flex-col items-center gap-1 lg:gap-1.5">
                <span className="hidden text-[13px] font-extrabold lg:block">Approx. {TRANSIT_DAYS}*</span>
                <div className="flex w-full items-center gap-1.5 lg:gap-2">
                  <span className="hidden h-2 w-2 flex-none rounded-full shadow-[inset_0_0_0_2px_var(--primary)] lg:block" />
                  <span className="flex-1 border-t-2 border-dashed border-[var(--route-dash)]" />
                  <AirplaneTilt size={22} weight="fill" className="rotate-45 text-[var(--primary)]" aria-hidden />
                  <span className="flex-1 border-t-2 border-dashed border-[var(--route-dash)]" />
                  <span className="hidden h-2 w-2 flex-none rounded-full bg-[var(--primary)] lg:block" />
                </div>
                <span className="text-[11px] font-extrabold text-[var(--muted)] lg:hidden">{TRANSIT_DAYS}*</span>
                <span className="hidden text-xs font-bold text-[var(--muted)] lg:block">Door to door · ocean freight</span>
              </div>
              <div className="min-w-0 text-right">
                <p className="hidden text-xs font-bold text-[var(--muted)] lg:block">Delivery after release</p>
                <p className="text-[30px] font-extrabold leading-none tracking-[-0.03em] lg:mt-0.5 lg:text-[40px] lg:leading-[1.05]">
                  {destinationCode(move)}
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-[var(--muted)] lg:mt-0 lg:text-sm">{place}</p>
              </div>
            </div>

            <div className="p-[18px] lg:px-7 lg:py-6">
              <h2 className="text-[15px] font-extrabold lg:text-[17px]">Shipment and delivery schedule</h2>
              <ol className="relative mt-3.5 grid lg:mt-[18px] lg:grid-cols-4">
                <span
                  aria-hidden
                  className="absolute bottom-[30px] left-[15px] top-4 border-l-2 border-[#bbd0ea] lg:bottom-auto lg:left-[18px] lg:right-[calc(25%-18px)] lg:top-[17px] lg:border-l-0 lg:border-t-2"
                />
                {schedule.map((s, i) => (
                  <li
                    key={s.title}
                    className={`relative grid grid-cols-[32px_1fr] gap-3.5 lg:block ${i < schedule.length - 1 ? "pb-4 lg:pb-0 lg:pr-4" : ""}`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full lg:h-9 lg:w-9 ${
                        i === 0
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--card)] text-[var(--primary)] shadow-[inset_0_0_0_2px_var(--primary)]"
                      }`}
                    >
                      {s.icon}
                    </span>
                    <div>
                      <p className="hidden text-xs font-extrabold text-[var(--muted)] lg:mt-3 lg:block">{i + 1}</p>
                      <p className="text-[15px] font-extrabold lg:text-base">
                        <span className="lg:hidden">{i + 1}. </span>
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-normal text-[var(--muted)] lg:mt-1 lg:text-sm">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3.5 text-[11px] leading-relaxed text-[var(--muted)] lg:mt-[18px] lg:text-xs">
                *Sample transit window only, not a confirmed schedule or delivery guarantee. Exact dates depend on sailing, customs,
                capacity and access.
              </p>
            </div>
          </section>

          {/* Partners */}
          <div className={`grid gap-3.5 p-4 lg:grid-cols-2 lg:gap-4 lg:bg-transparent lg:p-0 lg:shadow-none ${flatCard}`}>
            <Partner
              icon={<AirplaneTakeoff size={22} weight="bold" />}
              label="ORIGIN PARTNER"
              name={ORIGIN_PARTNER.name}
              detail={`${from.name} · ${ORIGIN_PARTNER.role}`}
            />
            <Partner
              icon={<AirplaneLanding size={22} weight="bold" />}
              label="DESTINATION PARTNER"
              name={destinationPartner(to.slug)}
              detail={`${to.name} · ${DESTINATION_ROLE}`}
              divided
            />
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-[var(--teal-50)] px-4 py-3.5 text-[#0b4f4a] lg:gap-3.5 lg:rounded-[18px] lg:px-5 lg:py-4">
            <ShieldCheck size={24} weight="fill" className="flex-none text-[var(--teal-ink)]" />
            <div>
              <p className="text-sm font-extrabold lg:text-[15px]">One contracting provider: Moversly</p>
              <p className="mt-1 text-[13px] leading-relaxed lg:text-sm">
                Moversly is the proposed contracting party for the complete door-to-door service and coordinates the origin and
                destination partners, subject to the signed contract.
              </p>
            </div>
          </div>

          {/* Price */}
          <section className={`overflow-hidden ${flatCard} lg:rounded-[22px]`}>
            <dl className="grid gap-2.5 p-4 text-sm lg:gap-3.5 lg:px-7 lg:py-[22px] lg:text-[15px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0">Confirmed inventory volume (customer-edited)</dt>
                <dd className="flex-none whitespace-nowrap font-extrabold tabular-nums">
                  {volume}
                  <span className="ml-2 hidden text-[13px] font-semibold text-[var(--muted)] sm:inline">{volumeFt3}</span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0">Illustrative door-to-door moving services</dt>
                <dd className="flex-none whitespace-nowrap font-extrabold tabular-nums">{money(PRICE_SGD)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 text-[13px] text-[var(--muted)] lg:text-sm">
                <dt>Optional insurance</dt>
                <dd className="flex-none whitespace-nowrap">Selected at checkout</dd>
              </div>
            </dl>
            <div className="bg-[var(--primary-50)] p-4 lg:flex lg:items-end lg:justify-between lg:gap-4 lg:px-7 lg:py-[22px]">
              <p className="text-[13px] font-extrabold lg:text-base">Estimated moving price</p>
              <p className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em] text-[var(--primary)] lg:mt-0 lg:text-[44px]">
                {money(PRICE_SGD)}
              </p>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            <Scope icon={<CheckCircle size={18} weight="bold" className="text-[var(--ok)]" />} title="Included in this example:">
              {INCLUDED}
            </Scope>
            <Scope
              icon={<MinusCircle size={18} weight="bold" className="text-[var(--warn)]" />}
              title="Not included unless expressly quoted:"
            >
              {EXCLUDED}
            </Scope>
          </div>

          <details className={`group ${flatCard}`}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-extrabold transition-colors hover:text-[var(--primary)] lg:px-5 lg:text-[15px] [&::-webkit-details-marker]:hidden">
              Quotation terms and conditions
              <CaretDown size={16} weight="bold" className="flex-none transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid list-disc gap-1.5 pb-5 pl-9 pr-4 text-sm leading-relaxed text-[var(--muted)] lg:pl-10 lg:pr-5">
              {TERMS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>

          <nav className="mt-2 flex items-center justify-between gap-3">
            <Link
              href="/survey"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--card)] px-[18px] text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)] lg:flex-none"
            >
              <ArrowLeft size={16} weight="bold" />
              Edit survey
            </Link>
            <Link
              href="/payment"
              className="btn-primary hidden h-14 items-center gap-10 rounded-[14px] px-6 text-base font-extrabold lg:flex"
            >
              Next: payment
              <ArrowRight size={18} weight="bold" />
            </Link>
          </nav>
        </main>

        <div className="hidden lg:block">
          <BookingPanel trip={trip} stage="quote" />
        </div>
      </div>

      <BookingSheet trip={trip} stage="quote" cta={{ label: "Next: payment", href: "/payment" }} />
    </div>
  );
}

function Partner({
  icon,
  label,
  name,
  detail,
  divided,
}: {
  icon: ReactNode;
  label: string;
  name: string;
  detail: string;
  divided?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 lg:gap-3.5 lg:rounded-[20px] lg:bg-[var(--card)] lg:p-5 lg:shadow-[0_0_0_1px_var(--line)] ${
        divided ? "border-t border-[var(--line)] pt-3.5 lg:border-t-0" : ""
      }`}
    >
      <span className="flex-none text-[var(--primary)] lg:grid lg:h-11 lg:w-11 lg:place-items-center lg:rounded-xl lg:bg-[var(--primary-50)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)]">{label}</p>
        <p className="mt-0.5 text-[15px] font-extrabold lg:mt-1 lg:text-[17px]">{name}</p>
        <p className="mt-0.5 text-xs leading-normal text-[var(--muted)] lg:mt-1 lg:text-[13px]">{detail}</p>
      </div>
    </div>
  );
}

function Scope({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className={`p-4 lg:p-5 ${flatCard}`}>
      <p className="flex items-center gap-2 text-sm font-extrabold lg:text-[15px]">
        {icon}
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)] lg:text-sm">{children}</p>
    </div>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex gap-2.5 rounded-[14px] bg-[var(--warn-bg)] px-3.5 py-3 text-sm font-semibold leading-snug text-[var(--warn)]">
      <span className="mt-px flex-none">{icon}</span>
      {children}
    </p>
  );
}
