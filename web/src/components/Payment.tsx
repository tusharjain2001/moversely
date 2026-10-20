"use client";

import { CheckCircle, LockSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { type Country, countryBySlug, countryOrOther } from "@/lib/countries";
import { type Booking, type MoveDetails, loadMove, saveMove, useIsClient } from "@/lib/move";
import { INSURANCE_RATE, PRICE_SGD, money } from "@/lib/quote";
import { useSurveyTotals } from "@/lib/useSurveyTotals";
import { MissingMove } from "./MoveSummary";
import { MoveAside, Row, moveDate } from "./Quotation";
import StepHeader from "./StepHeader";

export default function Payment() {
  const isClient = useIsClient();
  if (!isClient) return <div className="min-h-dvh" />;
  const move = loadMove();
  const from = move && countryBySlug(move.from);
  const to = move && countryOrOther(move.to);
  return move && from && to ? <Checkout move={move} from={from} to={to} /> : <MissingMove step={3} />;
}

function Checkout({ move, from, to }: { move: MoveDetails; from: Country; to: Country }) {
  const { total } = useSurveyTotals(move);
  const [booking, setBooking] = useState(move.booking);
  const [insured, setInsured] = useState(false);
  const [declared, setDeclared] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const volume = `${total.toFixed(2)} m³`;
  const declaredValue = Math.max(0, Number(declared) || 0);
  const premium = insured ? Math.round(declaredValue * INSURANCE_RATE * 100) / 100 : 0;
  const subtotal = PRICE_SGD + premium;

  function confirm() {
    // No money moves here: this only records that the customer went through checkout.
    const made: Booking = {
      ref: `MV-${Date.now().toString(36).slice(-6).toUpperCase()}`,
      insurancePremium: premium,
      total: subtotal,
      at: new Date().toISOString(),
    };
    saveMove({ ...move, booking: made });
    setBooking(made);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <StepHeader step={3} />

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_1px_2px_rgb(13_27_62/0.05),0_24px_56px_-36px_rgb(10_70_150/0.35)] sm:p-8">
          {booking ? (
            <Confirmed booking={booking} email={move.email} />
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Review &amp; book your move</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                One payment to Moversly. Partner fulfillment coordinated behind the scenes.
              </p>

              <div className="mt-6 rounded-2xl border border-[var(--primary)]/15 bg-[var(--primary)]/[0.05] p-4 text-sm leading-relaxed sm:p-5">
                <p>
                  <span className="font-semibold">{move.name}</span> · {move.email}
                </p>
                <p>
                  {from.name} → {move.toPlace ?? to.name} · <span className="tabular-nums">{volume}</span>
                </p>
                <p>Pickup requested: {moveDate(move)}</p>
              </div>

              <h2 className="mt-7 text-lg font-semibold">Optional shipment insurance</h2>
              <Check checked={insured} onChange={setInsured} className="mt-3">
                <span className="font-semibold">Add shipment insurance at 3% of declared value</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                  Opt-in only. A real purchase requires approved insurer, coverage details, exclusions, deductible, policy document
                  and any required disclosures.
                </span>
              </Check>
              {insured && (
                <label className="mt-3 ml-8 block max-w-xs text-sm">
                  <span className="font-medium">Declared value of your goods</span>
                  <span className="mt-1.5 flex items-center rounded-xl border border-[var(--line)] bg-[var(--card)] focus-within:border-[var(--primary)]">
                    <span className="pl-3 text-[var(--muted)]">SGD</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={100}
                      value={declared}
                      onChange={(e) => setDeclared(e.target.value)}
                      placeholder="20000"
                      className="w-full bg-transparent px-2 py-2.5 tabular-nums outline-none"
                    />
                  </span>
                </label>
              )}

              <dl className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
                <Row label="Moving services">
                  <span className="font-semibold tabular-nums">{money(PRICE_SGD)}</span>
                </Row>
                <Row label="Optional insurance premium">
                  <span className="font-semibold tabular-nums">{money(premium)}</span>
                </Row>
              </dl>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-2xl bg-[var(--chip)] px-4 py-4 sm:px-5">
                <p className="font-semibold">Illustrative subtotal</p>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-[var(--primary)] sm:text-4xl">{money(subtotal)}</p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--warn)]">
                Not a final payable total: taxes, duties and other applicable fees are not calculated. No real payment will be taken
                in this prototype.
              </p>

              <div className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
                <Check checked={reviewed} onChange={setReviewed}>
                  I have reviewed the quotation scope, exclusions, schedule estimates, cancellation terms and Moversly contractual
                  responsibility.
                </Check>
                <Check checked={understood} onChange={setUnderstood}>
                  I understand optional cargo insurance is separate from Moversly&apos;s contractual obligations and is subject to
                  actual insurer policy terms.
                </Check>
              </div>

              <nav className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/quotation"
                  className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium transition hover:border-[var(--primary)]"
                >
                  ← Quotation
                </Link>
                <button
                  onClick={confirm}
                  disabled={!reviewed || !understood}
                  className="btn-primary inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <LockSimple size={16} weight="bold" aria-hidden />
                  Simulate payment &amp; confirm
                </button>
              </nav>
              {(!reviewed || !understood) && (
                <p className="mt-2 text-xs text-[var(--muted)]">Tick both boxes above to continue.</p>
              )}

              <p className="mt-6 border-t border-[var(--line)] pt-4 text-xs leading-relaxed text-[var(--muted)]">
                Production checkout must use a licensed payment provider, verify live rates and capacity, and confirm payment
                server-side before creating a binding booking.
              </p>
            </>
          )}
        </section>

        <MoveAside move={move} from={from} to={to} volume={volume} />
      </div>
    </div>
  );
}

function Confirmed({ booking, email }: { booking: Booking; email: string }) {
  return (
    <div>
      <CheckCircle size={44} weight="fill" className="text-[var(--ok)]" aria-hidden />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Your move is booked</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Simulated payment only. No money was taken. In the live version, a confirmation is sent to {email}.
      </p>
      <dl className="mt-6 space-y-3 rounded-2xl bg-[var(--chip)] p-4 sm:p-5">
        <Row label="Booking reference">
          <span className="font-semibold tracking-wide">{booking.ref}</span>
        </Row>
        <Row label="Optional insurance premium">
          <span className="tabular-nums">{money(booking.insurancePremium)}</span>
        </Row>
        <Row label="Illustrative subtotal">
          <span className="font-semibold tabular-nums text-[var(--primary)]">{money(booking.total)}</span>
        </Row>
      </dl>
      <p className="mt-4 text-sm leading-relaxed">
        Next, check the documents you need for customs. Our team will contact you to confirm the final price and pickup date.
      </p>
      <nav className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/quotation"
          className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-medium transition hover:border-[var(--primary)]"
        >
          ← Quotation
        </Link>
        <Link
          href="/summary"
          className="btn-primary rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)]"
        >
          Next: documents →
        </Link>
      </nav>
    </div>
  );
}

function Check({
  checked,
  onChange,
  className = "",
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer gap-3 text-sm leading-relaxed ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--primary)]"
      />
      <span>{children}</span>
    </label>
  );
}
