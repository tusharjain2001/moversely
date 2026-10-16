import Link from "next/link";
import type { ReactNode } from "react";

const STEPS = [
  { href: "/", label: "Your move" },
  { href: "/survey", label: "AI survey" },
  { href: "/summary", label: "Documents" },
];

/** Brand plus the 3-step progress bar shared by every page of the flow. */
export default function StepHeader({ step, right }: { step: 0 | 1 | 2; right?: ReactNode }) {
  return (
    <header className="print:hidden">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="tape-mark" aria-hidden />
          <span className="font-semibold tracking-tight">AI Move Survey</span>
        </Link>
        {right}
      </div>
      <ol className="mt-5 grid grid-cols-3 gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-[var(--tape)]" : "bg-[var(--line)]"}`} />
            <span className={`mt-1.5 block font-medium ${i === step ? "" : "text-[var(--muted)]"}`}>
              {i + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>
    </header>
  );
}
