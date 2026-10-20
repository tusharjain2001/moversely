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
 * Brand, the 5-step progress bar shared by every page of the flow, and a way
 * back: finished steps are links, and "Back" goes to the previous step.
 * Phones show only the bars plus "Step 3 of 5 · Quotation", as five labels
 * don't fit side by side.
 */
export default function StepHeader({ step, right }: { step: 0 | 1 | 2 | 3 | 4; right?: ReactNode }) {
  const previous = step > 0 ? STEPS[step - 1] : null;
  return (
    <header className="print:hidden">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        {right}
      </div>
      <ol className="mt-5 grid grid-cols-5 gap-1.5 text-xs sm:gap-2">
        {STEPS.map((s, i) => {
          const bar = <span className={`block h-1.5 rounded-full ${i <= step ? "bg-[var(--primary)]" : "bg-[var(--line)]"}`} />;
          const label = `${i + 1}. ${s.label}`;
          return (
            <li key={s.href}>
              {i < step ? (
                <Link href={s.href} className="group block py-1 sm:py-0" aria-label={`Go back to ${s.label}`}>
                  {bar}
                  <span className="mt-1.5 hidden font-medium text-[var(--muted)] transition-colors group-hover:text-[var(--primary)] sm:block">
                    {label}
                  </span>
                </Link>
              ) : (
                <div aria-current={i === step ? "step" : undefined} className="py-1 sm:py-0">
                  {bar}
                  <span className={`mt-1.5 hidden font-medium sm:block ${i === step ? "" : "text-[var(--muted)]"}`}>{label}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-xs text-[var(--muted)] sm:hidden">
        Step {step + 1} of {STEPS.length} · <span className="font-semibold text-[var(--ink)]">{STEPS[step].label}</span>
      </p>
      {previous && (
        <Link
          href={previous.href}
          className="group mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-1.5 text-sm font-medium transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <span className="transition-transform group-hover:-translate-x-0.5" aria-hidden>
            ←
          </span>
          {previous.back}
        </Link>
      )}
    </header>
  );
}
