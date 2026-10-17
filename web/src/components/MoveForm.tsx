"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { MOVE_TYPES, type MoveDetails, loadMove, saveMove, useIsClient } from "@/lib/move";

const EMPTY: MoveDetails = { name: "", email: "", phone: "", from: "", to: "", date: "", moveType: "full" };

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-base text-[var(--ink)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25";

/** The move-details form: step 1 of the flow, shown in the landing page hero. */
export default function MoveForm() {
  const isClient = useIsClient();
  // Saved details prefill the form, so it renders on the client; the
  // placeholder keeps the hero from jumping while it loads.
  return isClient ? <Form /> : <div className="min-h-[620px] rounded-3xl border border-[var(--line)] bg-[var(--card)]" />;
}

function validate(m: MoveDetails): string | null {
  if (!m.from || !m.to) return "Choose where you are moving from and to.";
  if (m.from === m.to) return "“Moving from” and “Moving to” must be different countries.";
  if (!m.date) return "Choose your moving date.";
  if (!m.name.trim()) return "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(m.email)) return "Enter a valid email address.";
  if (m.phone.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  return null;
}

function Form() {
  const router = useRouter();
  const [move, setMove] = useState<MoveDetails>(() => loadMove() ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MoveDetails>(key: K, value: MoveDetails[K]) => setMove((m) => ({ ...m, [key]: value }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const problem = validate(move);
        setError(problem);
        if (problem) return;
        saveMove({ ...move, name: move.name.trim(), email: move.email.trim(), phone: move.phone.trim() });
        router.push("/survey");
      }}
      className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_24px_60px_-30px_rgb(22_24_29/0.35)] sm:p-7"
    >
      <h2 className="text-xl font-semibold tracking-tight">Start your move plan</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Step 1 of 3. Takes under a minute.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Moving from
          <select value={move.from} onChange={(e) => set("from", e.target.value)} className={inputClass}>
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Moving to
          <select value={move.to} onChange={(e) => set("to", e.target.value)} className={inputClass}>
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c.slug} value={c.slug} disabled={c.slug === move.from}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">What are you moving?</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
            {MOVE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={move.moveType === t.value}
                onClick={() => set("moveType", t.value)}
                className={`rounded-lg px-1 py-1.5 text-xs font-medium leading-tight transition ${
                  move.moveType === t.value ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          Moving date
          <input type="date" min={today} value={move.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Full name
          <input value={move.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            value={move.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Phone
          <input type="tel" value={move.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" className={inputClass} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}

      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90 active:scale-[0.98]">
        Next: scan your rooms <ArrowRight size={18} weight="bold" />
      </button>
    </form>
  );
}
