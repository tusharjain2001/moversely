"use client";

import {
  AirplaneLanding,
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FilePdf,
  HourglassMedium,
  IdentificationCard,
  Info,
  ListChecks,
  MapTrifold,
  Prohibit,
  SealPercent,
  ShippingContainer,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { type Country, type CustomsSummary, GENERAL_DOCUMENTS, countryBySlug, countryOrOther } from "@/lib/countries";
import { MOVE_TYPES, type MoveDetails, formatMoveDate, loadMove, useIsClient } from "@/lib/move";
import { M3_TO_FT3, formatVolume, shippingGuide } from "@/lib/units";
import { useSurveyTotals } from "@/lib/useSurveyTotals";
import { BookingPanel } from "./Booking";
import StepHeader from "./StepHeader";

export default function MoveSummary() {
  const isClient = useIsClient();
  if (!isClient) return <div className="min-h-dvh" />;
  const move = loadMove();
  const from = move && countryOrOther(move.from);
  const to = move && countryOrOther(move.to);
  return move && from && to ? <Summary move={move} from={from} to={to} /> : <MissingMove step={4} />;
}

/** Shown when a later page is opened before the move form was filled in. */
export function MissingMove({ step }: { step: 2 | 3 | 4 }) {
  return (
    <div className="min-h-dvh">
      <StepHeader step={step} />
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-12">
        <div className="rounded-[22px] bg-[var(--card)] px-5 py-7 shadow-raised sm:px-8 sm:py-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary-50)] text-[var(--primary)]">
            <MapTrifold size={28} weight="duotone" />
          </span>
          <p className="mt-4 text-lg font-extrabold">Tell us about your move first</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
            We need where you are moving to before we can show this page.
          </p>
          <Link
            href="/"
            className="btn-primary mt-5 flex h-[52px] items-center justify-between rounded-[14px] px-5 text-[15px] font-extrabold"
          >
            Start here
            <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Summary({ move, from, to }: { move: MoveDetails; from: Country; to: Country }) {
  const { units, total, itemCount, measuring } = useSurveyTotals(move);
  const moveType = MOVE_TYPES.find((t) => t.value === move.moveType)?.label;
  const date = formatMoveDate(move);
  const docCount = GENERAL_DOCUMENTS.length + (from.export?.documents.length ?? 0) + (to.import?.documents.length ?? 0);
  const otherUnit = units === "imperial" ? `${total.toFixed(1)} m³` : `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`;

  return (
    <div className="min-h-dvh">
      <StepHeader
        step={4}
        right={
          <button
            onClick={() => window.print()}
            aria-label="Save as PDF"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--card)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] lg:flex lg:h-10 lg:w-auto lg:items-center lg:gap-2 lg:rounded-[10px] lg:px-3.5 lg:text-sm lg:font-semibold"
          >
            <FilePdf size={20} className="lg:h-[18px] lg:w-[18px]" />
            <span className="hidden lg:inline">Save as PDF</span>
          </button>
        }
      />

      <div className="mx-auto grid max-w-[1280px] gap-8 px-3 pb-16 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-12 lg:pb-20 lg:pt-8">
        <main className="min-w-0">
          <h1 className="px-1 text-[26px] font-extrabold tracking-[-0.02em] sm:px-0 lg:text-[34px] lg:tracking-[-0.025em]">
            Your move summary
          </h1>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 px-1 text-[13px] font-semibold text-[var(--muted)] sm:px-0 lg:text-sm">
            {[move.name, move.email, move.phone].map((v, i) => (
              <span key={i} className="break-all">
                {v}
              </span>
            ))}
          </p>

          <section className="mt-4 rounded-[22px] bg-[var(--primary)] p-5 text-white [print-color-adjust:exact] lg:mt-5 lg:rounded-3xl lg:px-8 lg:py-7">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 lg:grid-cols-[auto_1fr_auto] lg:gap-7">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold tracking-[0.08em] text-[#cfe2f7] lg:text-xs">FROM</p>
                <p className="mt-0.5 text-lg font-extrabold lg:mt-1 lg:text-[26px]">{move.fromPlace ?? from.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden flex-1 border-t-2 border-dashed border-white/45 lg:block" />
                <AirplaneTilt size={22} weight="fill" className="rotate-45" aria-hidden />
                <span className="hidden flex-1 border-t-2 border-dashed border-white/45 lg:block" />
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-extrabold tracking-[0.08em] text-[#cfe2f7] lg:text-xs">TO</p>
                <p className="mt-0.5 text-lg font-extrabold lg:mt-1 lg:text-[26px]">{move.toPlace ?? to.name}</p>
              </div>
            </div>
            <p className="mt-2 text-[13px] font-semibold text-[#e3eefa] lg:mt-2.5 lg:text-sm">
              {moveType} · moving {date}
            </p>
            <div className="mt-4 grid gap-3 border-t border-white/[0.18] pt-4 sm:grid-cols-2 sm:items-center sm:gap-5 lg:mt-5 lg:pt-5">
              <div>
                <p className="text-xs font-bold text-[#cfe2f7] lg:text-[13px]">Shipment volume</p>
                <p className="mt-0.5 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] lg:text-[40px]">
                  {formatVolume(total, units)}
                </p>
                <p className="mt-0.5 text-xs text-[#e3eefa] lg:text-[13px]">
                  {otherUnit} · {itemCount} item{itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-[var(--ink)] lg:rounded-[14px] lg:px-4 lg:py-3.5">
                <ShippingContainer size={24} className="flex-none text-[var(--primary)]" />
                <span>
                  <span className="block text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)]">SUGGESTED SHIPPING</span>
                  <span className="block text-sm font-extrabold lg:text-base">{shippingGuide(total)}</span>
                </span>
              </div>
            </div>
            {measuring && (
              <p className="mt-4 flex gap-2.5 rounded-[14px] bg-[var(--warn-bg)] px-3.5 py-3 text-[13px] font-semibold leading-snug text-[var(--warn)]">
                <HourglassMedium size={18} weight="bold" className="flex-none" />
                Some rooms are still being measured. This total will update.
              </p>
            )}
          </section>

          <div className="mt-7 flex items-end justify-between gap-5 px-1 sm:px-0 lg:mt-9">
            <div>
              <h2 className="text-xl font-extrabold lg:text-2xl lg:tracking-[-0.02em]">Documents you will need</h2>
              <p className="mt-1 text-[13px] leading-snug text-[var(--muted)] lg:mt-1.5 lg:text-sm">
                Based on the customs rules for leaving {from.name} and arriving in {to.name}.
              </p>
            </div>
            <span className="hidden h-8 flex-none items-center gap-1.5 rounded-full bg-[var(--card)] px-3 text-[13px] font-extrabold shadow-[0_0_0_1px_var(--line)] sm:flex">
              <ListChecks size={16} weight="bold" className="text-[var(--primary)]" />
              {docCount} documents
            </span>
          </div>

          <div className="mt-3 grid gap-2.5 lg:mt-4 lg:gap-3.5">
            <DocCard
              kicker="EVERY MOVE"
              title="For every international move"
              icon={<IdentificationCard size={24} weight="duotone" />}
              items={GENERAL_DOCUMENTS}
            />
            <CustomsCard
              title={`Leaving ${from.name}`}
              kind="export"
              country={from}
              summary={from.export}
              link={from.fidi.export}
            />
            <CustomsCard title={`Arriving in ${to.name}`} kind="import" country={to} summary={to.import} link={to.fidi.import} />
          </div>

          <nav className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between lg:mt-7 print:hidden">
            <Link
              href="/payment"
              className="flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition hover:text-[var(--primary)] sm:bg-[var(--card)] sm:shadow-[inset_0_0_0_1px_var(--line-strong)] sm:hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
            >
              <ArrowLeft size={16} weight="bold" />
              Back to payment
            </Link>
            <button
              onClick={() => window.print()}
              className="btn-primary flex h-14 items-center justify-center gap-2.5 rounded-[14px] px-6 text-base font-extrabold"
            >
              <FilePdf size={18} weight="bold" />
              Save as PDF
            </button>
          </nav>

          <footer className="mt-6 grid gap-2 px-1 text-[11px] leading-relaxed text-[var(--muted)] sm:px-0 lg:mt-8 lg:text-xs">
            <p>
              These summaries are for information only. Customs rules change, so please confirm the exact requirements with your
              mover or customs broker before shipping.
            </p>
            <p>
              We provide access to the FIDI Customs Guides, developed by FIDI as an informational resource. Our company is not
              affiliated with FIDI and is not FAIM certified.
            </p>
          </footer>
        </main>

        <div className="hidden lg:block print:hidden">
          <BookingPanel
            trip={{ move, from, to, totalM3: total }}
            stage={move.booking ? "paid" : "quote"}
            premium={move.booking?.insurancePremium ?? 0}
            booking={move.booking}
          />
        </div>
      </div>
    </div>
  );
}

const countLabel = (n: number) => `${n} document${n === 1 ? "" : "s"}`;

function DocCard({
  kicker,
  title,
  icon,
  items,
  children,
}: {
  kicker: string;
  title: string;
  icon: ReactNode;
  items: string[];
  children?: ReactNode;
}) {
  return (
    <section className="break-inside-avoid overflow-hidden rounded-[18px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line)] lg:rounded-[22px]">
      <header className="flex items-center gap-3 border-b border-[var(--chip)] px-4 py-3.5 lg:gap-3.5 lg:px-6 lg:py-[18px]">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--primary-50)] text-[var(--primary)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)]">{kicker}</p>
          <h3 className="mt-0.5 text-[15px] font-extrabold lg:text-lg">{title}</h3>
        </div>
        <span className="flex-none text-xs font-bold text-[var(--muted)] lg:text-[13px]">{countLabel(items.length)}</span>
      </header>
      <ul className="grid gap-x-6 px-4 py-2 sm:grid-cols-2 lg:px-6 lg:pb-1 lg:pt-3">
        {items.map((d) => (
          <li key={d} className="flex gap-3 py-[7px] text-[13px] font-semibold leading-normal lg:py-2 lg:text-sm">
            <span className="mt-px h-[18px] w-[18px] flex-none rounded-[5px] shadow-[inset_0_0_0_2px_#c9d5e8] lg:h-5 lg:w-5" aria-hidden />
            {d}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

function CustomsCard({
  title,
  kind,
  country,
  summary,
  link,
}: {
  title: string;
  kind: "import" | "export";
  country: Country;
  summary: CustomsSummary | null;
  link?: string;
}) {
  const Icon = kind === "export" ? AirplaneTakeoff : AirplaneLanding;
  if (!summary)
    return (
      <section className="break-inside-avoid rounded-[18px] border-2 border-dashed border-[#c9d5e8] p-[18px]">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold">
          <Icon size={20} weight="duotone" className="text-[var(--muted)]" />
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          {countryBySlug(country.slug)
            ? `There is no FIDI ${kind} guide for ${country.name}. Usually only the documents above are needed, but check with your mover.`
            : `We don't have a customs summary for ${country.name} yet. Our team will send you the full checklist with your quote.`}
        </p>
      </section>
    );
  const extras = [
    { label: "Duty-free when", items: summary.dutyFree, tone: "ok" },
    { label: "Restricted or special paperwork", items: summary.restricted, tone: "bad" },
    { label: "Good to know", items: summary.notes, tone: "info" },
  ].filter((x) => x.items.length);
  return (
    <DocCard
      kicker={kind === "export" ? "EXPORT" : "IMPORT"}
      title={title}
      icon={<Icon size={24} weight="duotone" />}
      items={summary.documents}
    >
      {extras.length > 0 && (
        <div className={`mx-3 mt-1 grid gap-2 lg:mx-6 lg:mt-3 lg:gap-3 ${extras.length > 1 ? "lg:grid-cols-3" : ""}`}>
          {extras.map((x) => (
            <Extra key={x.label} {...x} />
          ))}
        </div>
      )}
      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--chip)] px-4 py-2.5 text-[11px] font-semibold text-[var(--muted)] lg:mt-4 lg:px-6 lg:py-3 lg:text-xs">
        <span>{summary.updated && `FIDI guide updated ${summary.updated}`}</span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-extrabold text-[var(--primary)] hover:text-[var(--primary-press)] print:hidden"
          >
            Full FIDI {kind} guide
            <ArrowUpRight size={14} weight="bold" />
          </a>
        )}
      </p>
    </DocCard>
  );
}

const TONES = {
  ok: { box: "bg-[var(--ok-bg)]", text: "text-[var(--ok)]", icon: SealPercent },
  bad: { box: "bg-[var(--bad-bg)]", text: "text-[var(--bad)]", icon: Prohibit },
  info: { box: "bg-[var(--chip)]", text: "text-[var(--primary)]", icon: Info },
} as const;

function Extra({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  const t = TONES[tone as keyof typeof TONES];
  const Icon = t.icon;
  return (
    <div className={`rounded-xl px-3.5 py-3 [print-color-adjust:exact] lg:rounded-[14px] lg:px-4 lg:py-3.5 ${t.box}`}>
      <p className={`flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] ${t.text}`}>
        <Icon size={14} weight="bold" />
        {label}
      </p>
      <ul className="mt-2 grid list-disc gap-[5px] pl-4 text-[13px] leading-normal">
        {items.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
