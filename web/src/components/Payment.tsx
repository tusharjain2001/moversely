"use client";

import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  CheckCircle,
  CreditCard,
  Files,
  LockSimple,
  PencilSimple,
  Printer,
  ShareNetwork,
  ShieldCheck,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { type Country, countryBySlug, countryOrOther } from "@/lib/countries";
import { type Booking, type MoveDetails, formatMoveDate, loadMove, saveMove, useIsClient } from "@/lib/move";
import { INSURANCE_RATE, PRICE_SGD, money } from "@/lib/quote";
import { useSurveyTotals } from "@/lib/useSurveyTotals";
import { BookingPanel, MovePass } from "./Booking";
import { MissingMove } from "./MoveSummary";
import { flatCard, pageGrid } from "./Quotation";
import StepHeader from "./StepHeader";

export default function Payment() {
  const isClient = useIsClient();
  if (!isClient) return <div className="min-h-dvh" />;
  const move = loadMove();
  const from = move && countryBySlug(move.from);
  const to = move && countryOrOther(move.to);
  return move && from && to ? <Checkout move={move} from={from} to={to} /> : <MissingMove step={3} />;
}

const secondaryBtn =
  "flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--card)] px-[18px] text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]";

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
  const ready = reviewed && understood;
  const trip = { move: booking ? { ...move, booking } : move, from, to, totalM3: total };

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

  if (booking)
    return (
      <div className="min-h-dvh">
        <StepHeader step={3} />
        <Confirmed trip={trip} booking={booking} email={move.email} />
      </div>
    );

  const initials = move.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const payButton = (className: string) => (
    <button
      onClick={confirm}
      disabled={!ready}
      className={`btn-primary flex items-center justify-center gap-2.5 rounded-[14px] font-extrabold disabled:cursor-not-allowed ${className}`}
    >
      <LockSimple size={18} weight="bold" aria-hidden />
      Simulate payment &amp; confirm booking
    </button>
  );

  return (
    <div className="min-h-dvh">
      <StepHeader step={3} />

      <div className={pageGrid}>
        <main className="grid min-w-0 gap-3 lg:gap-4">
          <div className="px-1 sm:px-0">
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em] lg:text-[34px] lg:tracking-[-0.025em]">Review &amp; book your move</h1>
            <p className="mt-1.5 text-sm leading-normal text-[var(--muted)] lg:mt-2 lg:text-[15px]">
              One payment to Moversly. Partner fulfillment coordinated behind the scenes.
            </p>
          </div>

          <section className={`grid grid-cols-[1fr_auto] items-center gap-4 p-4 lg:grid-cols-[auto_1fr_auto] lg:gap-[18px] lg:px-6 lg:py-5 ${flatCard}`}>
            <span className="hidden h-12 w-12 place-items-center rounded-full bg-[var(--primary-50)] text-base font-extrabold text-[var(--primary)] lg:grid">
              {initials}
            </span>
            <div className="min-w-0 text-sm leading-relaxed">
              <p className="break-words">
                <span className="font-extrabold">{move.name}</span> · {move.email}
              </p>
              <p className="text-[var(--muted)]">
                {from.name} → {move.toPlace ?? to.name} · <span className="tabular-nums">{volume}</span>
              </p>
              <p className="text-[var(--muted)]">Pickup requested: {formatMoveDate(move)}</p>
            </div>
            <Link
              href="/#start"
              className="flex h-10 items-center gap-1.5 self-start rounded-[10px] px-3 text-sm font-extrabold text-[var(--primary)] transition hover:bg-[var(--primary-50)] lg:self-center"
            >
              <PencilSimple size={16} weight="bold" />
              Edit
            </Link>
          </section>

          <h2 className="mx-1 mt-2 text-xs font-extrabold tracking-[0.1em] text-[var(--muted)] sm:mx-0 lg:mt-3 lg:text-[13px]">EXTRAS</h2>
          <section
            className={`rounded-[18px] bg-[var(--card)] p-4 transition-shadow lg:rounded-[20px] lg:px-6 lg:py-[22px] ${
              insured
                ? "shadow-[0_0_0_2px_var(--primary),0_18px_40px_-28px_rgb(10_70_150/0.4)]"
                : "shadow-[0_0_0_1px_var(--line)]"
            }`}
          >
            <label className="grid cursor-pointer grid-cols-[1fr_auto] items-start gap-3 lg:grid-cols-[auto_1fr_auto] lg:gap-4">
              <span className="hidden h-12 w-12 place-items-center rounded-[14px] bg-[var(--teal-50)] text-[var(--teal-ink)] lg:grid">
                <ShieldCheck size={26} weight="duotone" />
              </span>
              <span>
                <span className="hidden text-xs font-extrabold tracking-[0.08em] text-[var(--muted)] lg:block">
                  OPTIONAL SHIPMENT INSURANCE
                </span>
                <span className="flex items-center gap-2 text-[15px] font-extrabold lg:mt-1 lg:block lg:text-[17px]">
                  <ShieldCheck size={22} weight="duotone" className="flex-none text-[var(--teal-ink)] lg:hidden" />
                  Add shipment insurance at 3% of declared value
                </span>
                <span className="mt-1.5 block text-xs leading-normal text-[var(--muted)] lg:text-[13px]">
                  Opt-in only. A real purchase requires approved insurer, coverage details, exclusions, deductible, policy document
                  and any required disclosures.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={insured}
                onChange={(e) => setInsured(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`relative h-8 w-[52px] flex-none rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] ${
                  insured ? "bg-[var(--primary)]" : "bg-[var(--line-strong)]"
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_1px_3px_rgb(13_27_62/0.3)] transition-all ${
                    insured ? "left-[23px]" : "left-[3px]"
                  }`}
                />
              </span>
            </label>
            {insured && (
              <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2 lg:ml-16 lg:mt-[18px]">
                <label className="block w-full max-w-[280px] text-[13px] font-bold">
                  Declared value of your goods
                  <span className="mt-1.5 flex h-[52px] items-center gap-2 rounded-xl px-3.5 shadow-[inset_0_0_0_1px_var(--line-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--primary),0_0_0_4px_var(--primary-100)]">
                    <span className="text-[15px] font-bold text-[var(--muted)]">SGD</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={100}
                      value={declared}
                      onChange={(e) => setDeclared(e.target.value)}
                      placeholder="20000"
                      className="w-full min-w-0 bg-transparent text-[17px] font-extrabold tabular-nums outline-none placeholder:font-semibold placeholder:text-[#8c9ab3]"
                    />
                  </span>
                </label>
                <p className="mb-3.5 text-sm text-[var(--muted)]">
                  Premium <span className="font-extrabold text-[var(--ink)]">{money(premium)}</span>
                </p>
              </div>
            )}
          </section>

          <section className={`overflow-hidden ${flatCard}`}>
            <h2 className="hidden px-6 pt-5 text-[17px] font-extrabold lg:block">Price breakdown</h2>
            <dl className="grid gap-2.5 p-4 text-sm lg:gap-3 lg:px-6 lg:pb-5 lg:pt-4 lg:text-[15px]">
              <div className="flex justify-between gap-4">
                <dt>Moving services</dt>
                <dd className="font-extrabold tabular-nums">{money(PRICE_SGD)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Optional insurance premium</dt>
                <dd className="font-extrabold tabular-nums">{money(premium)}</dd>
              </div>
            </dl>
            <div className="bg-[var(--primary-50)] p-4 lg:flex lg:items-end lg:justify-between lg:gap-4 lg:px-6 lg:py-5">
              <p className="text-[13px] font-extrabold lg:text-base">Illustrative subtotal</p>
              <p className="mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em] text-[var(--primary)] lg:mt-0 lg:text-[44px]">
                {money(subtotal)}
              </p>
            </div>
            <p className="bg-[#fffbf1] px-4 py-3 text-xs leading-relaxed text-[var(--warn)] lg:px-6 lg:pb-4">
              Not a final payable total: taxes, duties and other applicable fees are not calculated. No real payment will be taken in
              this prototype.
            </p>
          </section>

          <CardPreview />

          <section className={`grid p-1.5 lg:px-3 lg:py-2 ${flatCard}`}>
            <Check_ checked={reviewed} onChange={setReviewed} attention={!reviewed && understood}>
              I have reviewed the quotation scope, exclusions, schedule estimates, cancellation terms and Moversly contractual
              responsibility.
            </Check_>
            <Check_ checked={understood} onChange={setUnderstood} attention={!understood && reviewed}>
              I understand optional cargo insurance is separate from Moversly&apos;s contractual obligations and is subject to actual
              insurer policy terms.
            </Check_>
          </section>

          <nav className="mt-2 hidden items-center justify-between gap-4 lg:flex">
            <Link href="/quotation" className={secondaryBtn}>
              <ArrowLeft size={16} weight="bold" />
              Quotation
            </Link>
            <div className="flex flex-col items-end gap-2">
              {payButton(
                `h-[60px] px-7 text-[17px] ${ready ? "shadow-[0_12px_28px_-12px_var(--primary)]" : ""}`,
              )}
              {!ready && <p className="text-xs font-bold text-[var(--warn)]">Tick both boxes above to continue.</p>}
            </div>
          </nav>
          <Link href="/quotation" className={`${secondaryBtn} lg:hidden`}>
            <ArrowLeft size={16} weight="bold" />
            Quotation
          </Link>

          <p className="mx-1 text-xs leading-relaxed text-[var(--muted)] sm:mx-0 lg:mt-2 lg:border-t lg:border-[var(--line)] lg:pt-4">
            Production checkout must use a licensed payment provider, verify live rates and capacity, and confirm payment server-side
            before creating a binding booking.
          </p>
        </main>

        <div className="hidden lg:block">
          <BookingPanel trip={trip} stage="pay" premium={premium} />
        </div>
      </div>

      {/* Phones: the subtotal and the pay button stay at the bottom of the screen. */}
      <div className="lg:hidden">
        <div aria-hidden className="h-48" />
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[20px] bg-[var(--card)] px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2 shadow-sheet">
          <div className="mx-auto mb-2.5 h-1 w-9 rounded-sm bg-[var(--line-strong)]" />
          <div className="flex min-h-11 items-center justify-between">
            <span>
              <span className="block text-xs font-bold text-[var(--muted)]">Illustrative subtotal</span>
              <span className="block text-[22px] font-extrabold tracking-[-0.02em]">{money(subtotal)}</span>
            </span>
          </div>
          {payButton("mt-2.5 h-14 w-full text-base")}
          {!ready && <p className="mt-2 text-center text-xs font-bold text-[var(--warn)]">Tick both boxes above to continue.</p>}
        </div>
      </div>
    </div>
  );
}

/** What the licensed provider's card field will look like. Collects nothing. */
function CardPreview() {
  const field = "flex h-12 items-center gap-2 rounded-[10px] bg-[var(--card)] px-3 text-[15px] text-[#8c9ab3] shadow-[inset_0_0_0_1px_var(--line)]";
  const badges = ["VISA", "Mastercard", "Amex"];
  return (
    <section aria-label="Card payment (coming soon)" className={`p-4 lg:px-6 lg:py-5 ${flatCard}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold lg:text-[17px]">Card payment</h2>
        <span className="hidden gap-1.5 sm:flex">
          {badges.map((b) => (
            <span
              key={b}
              className={`flex h-[26px] items-center rounded-md px-2 text-[11px] font-extrabold shadow-[inset_0_0_0_1px_var(--line)] ${
                b === "VISA" ? "text-[#1a1f71]" : ""
              }`}
            >
              {b}
            </span>
          ))}
        </span>
      </div>
      <div
        aria-hidden
        className="mt-2.5 grid select-none gap-2 rounded-xl border-[1.5px] border-dashed border-[#c9d5e8] bg-[#f8fafd] p-3 lg:mt-3.5 lg:grid-cols-[2fr_1fr_1fr] lg:gap-2.5 lg:rounded-[14px] lg:p-4"
      >
        <span className={field}>
          <CreditCard size={18} />
          Card number
        </span>
        <span className="grid grid-cols-2 gap-2 lg:contents">
          <span className={field}>MM / YY</span>
          <span className={field}>CVC</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Placeholder for the licensed payment provider&apos;s secure card field. Nothing is collected here.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-[var(--muted)] lg:mt-3">
        <span className="flex items-center gap-1.5">
          <LockSimple size={14} weight="bold" className="text-[var(--ok)]" />
          Encrypted checkout
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} weight="bold" className="text-[var(--ok)]" />
          3-D Secure
        </span>
        <span className="flex items-center gap-1.5">
          <Buildings size={14} weight="bold" className="text-[var(--ok)]" />
          One payment to Moversly
        </span>
      </div>
    </section>
  );
}

function Confirmed({
  trip,
  booking,
  email,
}: {
  trip: { move: MoveDetails; from: Country; to: Country; totalM3: number };
  booking: Booking;
  email: string;
}) {
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const share = () =>
    navigator
      .share({
        title: "My Moversly Move Pass",
        text: `Moversly booking ${booking.ref}: ${trip.from.name} → ${trip.move.toPlace ?? trip.to.name}, pickup ${formatMoveDate(trip.move)}.`,
      })
      .catch(() => {});
  const tool =
    "flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--card)] px-4 text-sm font-extrabold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]";

  return (
    <div className="mx-auto grid max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:gap-[72px] lg:px-12 lg:pb-20 lg:pt-12">
      <div className="lg:order-2 lg:pt-2">
        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-[var(--ok-bg)] px-3 text-[13px] font-extrabold text-[var(--ok)] lg:h-8">
          <CheckCircle size={16} weight="fill" />
          Booking confirmed
        </span>
        <h1 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-0.025em] lg:mt-4 lg:text-5xl lg:tracking-[-0.03em]">
          Your move is booked
        </h1>
        <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-[var(--muted)] lg:mt-3 lg:text-base">
          Simulated payment only. No money was taken. In the live version, a confirmation is sent to {email}.
        </p>

        <dl className="mt-7 hidden max-w-[520px] rounded-[18px] bg-[var(--card)] px-5 py-1.5 shadow-[0_0_0_1px_var(--line)] lg:block">
          {[
            ["Booking reference", <span key="r" className="font-extrabold tracking-[0.06em]">{booking.ref}</span>],
            ["Optional insurance premium", money(booking.insurancePremium)],
            ["Illustrative subtotal", <span key="t" className="font-extrabold text-[var(--primary)]">{money(booking.total)}</span>],
          ].map(([label, value], i) => (
            <div key={i} className={`flex justify-between py-3.5 text-[15px] ${i < 2 ? "border-b border-[var(--line)]" : ""}`}>
              <dt>{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <Tools className="mt-4 hidden lg:flex" canShare={canShare} share={share} tool={tool} />

        <div className="mt-8 hidden max-w-[620px] items-center gap-4 rounded-[18px] bg-[var(--primary-50)] p-5 lg:flex">
          <Files size={30} weight="duotone" className="flex-none text-[var(--primary)]" />
          <p className="flex-1 text-[15px] leading-relaxed">
            Next, check the documents you need for customs. Our team will contact you to confirm the final price and pickup date.
          </p>
        </div>
        <nav className="mt-7 hidden max-w-[620px] justify-between lg:flex print:hidden">
          <Link href="/quotation" className={secondaryBtn}>
            <ArrowLeft size={16} weight="bold" />
            Quotation
          </Link>
          <Link href="/summary" className="btn-primary flex h-14 items-center gap-10 rounded-[14px] px-6 text-base font-extrabold">
            Next: documents
            <ArrowRight size={18} weight="bold" />
          </Link>
        </nav>
      </div>

      <div className="mt-5 lg:order-1 lg:mt-0">
        <MovePass trip={trip} booking={booking} />
      </div>

      {/* Phones */}
      <div className="lg:hidden">
        <Tools className="mt-5 grid grid-cols-2" canShare={canShare} share={share} tool={`${tool} h-[52px] rounded-[14px]`} short />
        <p className="mt-5 text-sm leading-relaxed">
          Next, check the documents you need for customs. Our team will contact you to confirm the final price and pickup date.
        </p>
        <Link
          href="/summary"
          className="btn-primary mt-4 flex h-14 items-center justify-between rounded-[14px] px-5 text-base font-extrabold print:hidden"
        >
          Next: documents
          <ArrowRight size={18} weight="bold" />
        </Link>
        <Link
          href="/quotation"
          className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition hover:text-[var(--primary)] print:hidden"
        >
          <ArrowLeft size={16} weight="bold" />
          Quotation
        </Link>
      </div>
    </div>
  );
}

function Tools({
  className,
  canShare,
  share,
  tool,
  short,
}: {
  className: string;
  canShare: boolean;
  share: () => void;
  tool: string;
  short?: boolean;
}) {
  return (
    <div className={`gap-2 print:hidden ${className}`}>
      {canShare && (
        <button onClick={share} className={tool}>
          <ShareNetwork size={18} weight="bold" />
          {short ? "Share" : "Share Move Pass"}
        </button>
      )}
      <button onClick={() => window.print()} className={`${tool} ${canShare ? "" : "col-span-2"}`}>
        <Printer size={18} weight="bold" />
        {short ? "Print / PDF" : "Print or save PDF"}
      </button>
    </div>
  );
}

/** One agreement checkbox, styled like the design's ticked squares. */
function Check_({
  checked,
  onChange,
  attention,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  attention?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl p-3 text-[13px] leading-relaxed transition-colors hover:bg-[#f8fafd] lg:gap-3.5 lg:text-sm ${
        attention ? "bg-[#fffbf1]" : ""
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`mt-px grid h-6 w-6 flex-none place-items-center rounded-md transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] lg:h-[22px] lg:w-[22px] ${
          checked
            ? "bg-[var(--primary)] text-white"
            : attention
              ? "bg-white shadow-[inset_0_0_0_2px_#c99a3c]"
              : "bg-white shadow-[inset_0_0_0_2px_#c9d5e8]"
        }`}
      >
        {checked && <Check size={14} weight="bold" />}
      </span>
      <span>{children}</span>
    </label>
  );
}
