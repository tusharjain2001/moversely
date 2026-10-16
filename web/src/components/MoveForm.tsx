"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { MOVE_TYPES, type MoveDetails, loadMove, saveMove, useIsClient } from "@/lib/move";
import StepHeader from "./StepHeader";

const EMPTY: MoveDetails = { name: "", email: "", phone: "", from: "", to: "", date: "", moveType: "full" };

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-3 text-base outline-none focus:border-[var(--ink)]";

export default function MoveForm() {
  const isClient = useIsClient();
  return isClient ? <Form /> : <div className="min-h-dvh" />;
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
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <StepHeader step={0} />

      <section className="mt-8">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Plan your international move in three steps
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Tell us about your move, scan your rooms with your phone camera, and get your shipment volume plus the customs
          documents you need for your route.
        </p>
      </section>

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
        className="mt-8 space-y-5 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Moving from
            <select value={move.from} onChange={(e) => set("from", e.target.value)} className={inputClass}>
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.flag} {c.name}
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
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Moving date
            <input type="date" min={today} value={move.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">What are you moving?</legend>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] p-1">
              {MOVE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={move.moveType === t.value}
                  onClick={() => set("moveType", t.value)}
                  className={`rounded-lg px-1 py-2 text-xs font-medium leading-tight ${
                    move.moveType === t.value ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="block text-sm font-medium">
          Full name
          <input value={move.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <input
              type="tel"
              value={move.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
              className={inputClass}
            />
          </label>
        </div>

        {error && <p className="rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}

        <button className="w-full rounded-full bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--paper)]">
          Next: scan your rooms →
        </button>
      </form>

      <section className="mt-8 grid grid-cols-3 gap-2 text-center">
        {[
          ["1", "Your move", "route, date and contact"],
          ["2", "AI survey", "a short video of each room"],
          ["3", "Documents", "volume and customs checklist"],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
            <p className="font-mono text-xs text-[var(--muted)]">{n}</p>
            <p className="mt-1 text-sm font-semibold">{t}</p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
