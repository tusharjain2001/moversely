"use client";

import Link from "next/link";
import { type ReactNode, useEffect } from "react";
import { type Country, type CustomsSummary, GENERAL_DOCUMENTS, countryBySlug } from "@/lib/countries";
import { saveSurvey } from "@/lib/crm";
import { MOVE_TYPES, type MoveDetails, loadMove, useIsClient } from "@/lib/move";
import { useSurvey } from "@/lib/useSurvey";
import { M3_TO_FT3, formatVolume, shippingGuide } from "@/lib/units";
import StepHeader from "./StepHeader";
import { roomVolume } from "./SurveyApp";

export default function MoveSummary() {
  const isClient = useIsClient();
  if (!isClient) return <div className="min-h-dvh" />;
  const move = loadMove();
  const from = move && countryBySlug(move.from);
  const to = move && (countryBySlug(move.to) ?? (move.to ? otherCountry(move.to) : undefined));
  return move && from && to ? <Summary move={move} from={from} to={to} /> : <MissingMove />;
}

/** A destination we have no customs summary for yet, e.g. "Japan". */
const otherCountry = (name: string): Country => ({ slug: name, name, import: null, export: null, fidi: {} });

function MissingMove() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <StepHeader step={2} />
      <div className="mt-10 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 text-center">
        <p className="font-semibold">Tell us about your move first</p>
        <p className="mt-1 text-sm text-[var(--muted)]">We need your “moving from” and “moving to” countries to show the right documents.</p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]">
          Start here →
        </Link>
      </div>
    </div>
  );
}

function Summary({ move, from, to }: { move: MoveDetails; from: Country; to: Country }) {
  const { rooms, units } = useSurvey();
  const total = rooms.reduce((s, r) => s + roomVolume(r), 0);
  const itemCount = rooms.reduce((s, r) => s + r.items.reduce((n, it) => n + it.qty, 0), 0);
  const measuring = rooms.some((r) => r.status === "uploading" || r.status === "processing");
  const moveType = MOVE_TYPES.find((t) => t.value === move.moveType)?.label;
  const date = new Date(`${move.date}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  // Add the survey result to the team's lead once every room has finished.
  useEffect(() => {
    if (move.leadId && !measuring) saveSurvey(move.leadId, itemCount, total * M3_TO_FT3).catch(() => {});
  }, [move.leadId, measuring, itemCount, total]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <StepHeader
        step={2}
        right={
          <button onClick={() => window.print()} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium">
            Save as PDF
          </button>
        }
      />

      <section className="mt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your move summary</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {move.name} · {move.email} · {move.phone}
        </p>
      </section>

      <section className="mt-5 night-panel rounded-3xl p-6 text-[var(--on-night)]">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-semibold">
          <span>
            {from.name}
          </span>
          <span className="opacity-50">→</span>
          <span>
            {move.toPlace ?? to.name}
          </span>
        </p>
        <p className="mt-1 text-sm opacity-70">
          {moveType} · moving {date}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm opacity-70">Shipment volume</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatVolume(total, units)}</p>
            <p className="text-xs opacity-70">
              {units === "imperial" ? `${total.toFixed(1)} m³` : `${Math.round(total * M3_TO_FT3).toLocaleString()} ft³`} · {itemCount}{" "}
              item{itemCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="self-start rounded-xl bg-white/15 px-4 py-3 text-white">
            <p className="text-xs font-medium uppercase tracking-wider opacity-70">Suggested shipping</p>
            <p className="font-semibold">{shippingGuide(total)}</p>
          </div>
        </div>
        {measuring && <p className="mt-4 text-sm text-[var(--tape)]">Some rooms are still being measured. This total will update.</p>}
      </section>

      <h2 className="mt-10 text-lg font-semibold">Documents you will need</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Based on the customs rules for leaving {from.name} and arriving in {to.name}.</p>

      <DocCard title="For every international move" items={GENERAL_DOCUMENTS} />
      <CustomsCard
        title={`Leaving ${from.name}`}
        kind="export"
        country={from}
        summary={from.export}
        link={from.fidi.export}
      />
      <CustomsCard title={`Arriving in ${to.name}`} kind="import" country={to} summary={to.import} link={to.fidi.import} />

      <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/survey" className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium">
          ← Back to survey
        </Link>
        <button onClick={() => window.print()} className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]">
          Save as PDF
        </button>
      </nav>

      <footer className="mt-10 space-y-2 text-xs leading-relaxed text-[var(--muted)]">
        <p>
          These summaries are for information only. Customs rules change, so please confirm the exact requirements with your
          mover or customs broker before shipping.
        </p>
        <p>
          We provide access to the FIDI Customs Guides, developed by FIDI as an informational resource. Our company is not
          affiliated with FIDI and is not FAIM certified.
        </p>
      </footer>
    </div>
  );
}

function DocCard({ title, items, children }: { title: string; items: string[]; children?: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((d) => (
          <li key={d} className="flex gap-3 text-sm">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-[var(--line)]" aria-hidden />
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
  if (!summary)
    return (
      <section className="mt-4 rounded-3xl border border-dashed border-[var(--line)] p-5">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {countryBySlug(country.slug)
            ? `There is no FIDI ${kind} guide for ${country.name}. Usually only the documents above are needed, but check with your mover.`
            : `We don't have a customs summary for ${country.name} yet. Our team will send you the full checklist with your quote.`}
        </p>
      </section>
    );
  return (
    <DocCard title={title} items={summary.documents}>
      <Extra label="Duty-free when" items={summary.dutyFree} />
      <Extra label="Restricted or special paperwork" items={summary.restricted} />
      <Extra label="Good to know" items={summary.notes} />
      <p className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
        <span>{summary.updated && `FIDI guide updated ${summary.updated}`}</span>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] print:hidden">
            Full FIDI {kind} guide ↗
          </a>
        )}
      </p>
    </DocCard>
  );
}

function Extra({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
        {items.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
