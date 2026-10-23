import { ArrowLeft, Check, Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";

const STEPS = [
  { href: "/#start", label: "Your move", back: "Back to your move" },
  { href: "/survey", label: "AI survey", back: "Back to AI survey" },
  { href: "/quotation", label: "Quotation", back: "Back to quotation" },
  { href: "/payment", label: "Payment", back: "Back to payment" },
  { href: "/summary", label: "Documents", back: "Back to documents" },
];

/**
 * The booking flow's header, like an airline checkout: brand, a stepper with
 * the 5 steps and a way back. Finished steps are links; "Back" goes to the
 * previous step. Phones show a back arrow, "Step 3 of 5 · Quotation" and bars.
 */
export default function StepHeader({ step, right }: { step: 0 | 1 | 2 | 3 | 4; right?: ReactNode }) {
  const previous = step > 0 ? STEPS[step - 1] : null;
  const next = step < STEPS.length - 1 ? `Next: ${STEPS[step + 1].label}` : "Final step";
  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] print:hidden">
      {/* Phones */}
      <div className="px-3 pb-3.5 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
        <div className="flex h-12 items-center gap-1">
          {previous && (
            <Link
              href={previous.href}
              aria-label={previous.back}
              className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[var(--chip)]"
            >
              <ArrowLeft size={20} weight="bold" />
            </Link>
          )}
          <Link href="/" className={`flex-1 ${previous ? "pl-1.5" : "pl-1"}`}>
            <Logo className="text-lg" />
          </Link>
          {right ?? (
            <Link
              href="/chat"
              aria-label="Talk to AI"
              className="grid h-11 w-11 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--primary)]"
            >
              <Sparkle size={18} weight="fill" />
            </Link>
          )}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between px-1 text-[13px]">
          <span>
            <span className="font-semibold text-[var(--muted)]">
              Step {step + 1} of {STEPS.length} ·{" "}
            </span>
            <span className="font-extrabold">{STEPS[step].label}</span>
          </span>
          <span className="font-semibold text-[var(--muted)]">{next}</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 px-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.href} className={`h-1 rounded-sm ${i <= step ? "bg-[var(--primary)]" : "bg-[var(--line)]"}`} />
          ))}
        </div>
      </div>

      {/* Tablets and desktops */}
      <div className="hidden lg:block">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-12">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-50)]"
            >
              <Sparkle size={16} weight="fill" />
              Talk to AI
            </Link>
            {right}
          </div>
        </div>
        <div className="border-t border-[var(--chip)]">
          <div className="mx-auto flex max-w-[1280px] items-center gap-8 px-12 py-3.5">
            {previous && (
              <Link
                href={previous.href}
                className="flex h-10 flex-none items-center gap-2 rounded-[10px] border border-[var(--line)] pl-2.5 pr-3.5 text-sm font-semibold transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <ArrowLeft size={16} weight="bold" />
                {previous.back}
              </Link>
            )}
            <ol className="flex flex-1 items-center gap-3">
              {STEPS.map((s, i) => {
                const last = i === STEPS.length - 1;
                return (
                  <li key={s.href} className={`flex items-center gap-3 ${last ? "" : "flex-1"}`}>
                    {i < step ? (
                      <Link
                        href={s.href}
                        aria-label={`Go back to ${s.label}`}
                        className="flex h-10 items-center gap-2.5 pr-2 transition hover:text-[var(--primary)]"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
                          <Check size={14} weight="bold" />
                        </span>
                        <span className="whitespace-nowrap text-sm font-semibold">{s.label}</span>
                      </Link>
                    ) : i === step ? (
                      <div aria-current="step" className="flex h-10 items-center gap-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--primary-50)] text-[13px] font-extrabold text-[var(--primary)] shadow-[inset_0_0_0_2px_var(--primary)]">
                          {i + 1}
                        </span>
                        <span className="whitespace-nowrap text-sm font-extrabold">{s.label}</span>
                      </div>
                    ) : (
                      <div className="flex h-10 items-center gap-2.5 text-[var(--muted)]">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--card)] text-[13px] font-bold shadow-[inset_0_0_0_1.5px_var(--line-strong)]">
                          {i + 1}
                        </span>
                        <span className="whitespace-nowrap text-sm font-semibold">{s.label}</span>
                      </div>
                    )}
                    {!last && (
                      <span
                        aria-hidden
                        className={`h-0.5 min-w-4 flex-1 rounded-sm ${i < step ? "bg-[var(--primary)]" : "bg-[var(--line)]"}`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </header>
  );
}
