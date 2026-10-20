"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { COUNTRIES, countryBySlug } from "@/lib/countries";
import { saveLead } from "@/lib/crm";
import { MOVE_TYPES, type MoveDetails, ORIGIN, loadMove, saveMove, useIsClient } from "@/lib/move";
import { type Autocomplete, type Google, describePlace, loadPlaces, placesEnabled } from "@/lib/places";

const EMPTY: MoveDetails = { name: "", email: "", phone: "", from: ORIGIN, to: "", date: "", moveType: "full" };

const inputClass =
  "mt-1.5 w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-base text-[var(--ink)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/25";

/** The move-details form: step 1 of the flow, shown in the landing page hero. */
export default function MoveForm() {
  const isClient = useIsClient();
  // Saved details prefill the form, so it renders on the client; the
  // placeholder keeps the hero from jumping while it loads.
  return isClient ? <Form /> : <div className="min-h-[620px] rounded-3xl border border-[var(--line)] bg-[var(--card)]" />;
}

function validate(m: MoveDetails): string | null {
  if (!m.to) return "Choose where you are moving to from the suggestions.";
  if (m.to === m.from) return "Choose a destination outside Singapore.";
  if (!m.date) return "Choose your moving date.";
  if (!m.name.trim()) return "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(m.email)) return "Enter a valid email address.";
  if (m.phone.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  return null;
}

function Form() {
  const router = useRouter();
  const [move, setMove] = useState<MoveDetails>(() => ({ ...EMPTY, ...loadMove(), from: ORIGIN }));
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
        const details = { ...move, name: move.name.trim(), email: move.email.trim(), phone: move.phone.trim() };
        saveMove(details);
        // Record the enquiry for the team. The visitor doesn't wait for it, and
        // the survey works even if the AI server can't be reached.
        saveLead(details)
          .then(({ lead_id }) => saveMove({ ...(loadMove() ?? details), leadId: lead_id }))
          .catch(() => {});
        router.push("/survey");
      }}
      className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgb(13_27_62/0.05),0_28px_64px_-32px_rgb(10_70_150/0.38)] sm:p-7"
    >
      <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Start your move plan</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Step 1 of 5. Takes under a minute.</p>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3.5 sm:mt-5 sm:gap-x-4 sm:gap-y-4">
        <div className="col-span-2 block min-w-0 text-sm font-medium sm:col-span-1">
          Moving from
          <div className={`${inputClass} cursor-default text-[var(--muted)]`}>Singapore</div>
        </div>
        <label className="col-span-2 block min-w-0 text-sm font-medium sm:col-span-1">
          Moving to
          <Destination move={move} setMove={setMove} />
        </label>
        <fieldset className="col-span-2">
          <legend className="text-sm font-medium">What are you moving?</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-1">
            {MOVE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={move.moveType === t.value}
                onClick={() => set("moveType", t.value)}
                className={`whitespace-nowrap rounded-lg px-1 py-2 text-sm font-medium leading-tight transition sm:py-1.5 sm:text-xs ${
                  move.moveType === t.value ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block min-w-0 text-sm font-medium">
          Moving date
          <input type="date" min={today} value={move.date} onChange={(e) => set("date", e.target.value)} className={inputClass} />
        </label>
        <label className="block min-w-0 text-sm font-medium">
          Phone
          <input type="tel" value={move.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" className={inputClass} />
        </label>
        <label className="col-span-2 block text-sm font-medium sm:col-span-1">
          Full name
          <input value={move.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={inputClass} />
        </label>
        <label className="col-span-2 block text-sm font-medium sm:col-span-1">
          Email
          <input
            type="email"
            value={move.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}

      <button className="btn-primary group mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3.5 font-semibold text-[var(--on-primary)]">
        Next: scan your rooms <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
      </button>
    </form>
  );
}

/**
 * Google search for the destination: a city, region or country. The picked
 * place's country decides which customs documents the summary shows. Without
 * Google (no key, or it failed to load) it is a plain list of our countries.
 */
function Destination({ move, setMove }: { move: MoveDetails; setMove: Dispatch<SetStateAction<MoveDetails>> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => move.toPlace ?? countryBySlug(move.to)?.name ?? move.to);
  const [failed, setFailed] = useState(!placesEnabled);

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    let google: Google | null = null;
    let ac: Autocomplete | null = null;
    loadPlaces().then((g) => {
      if (cancelled) return;
      if (!g || !inputRef.current) return setFailed(true);
      google = g;
      const box = new g.maps.places.Autocomplete(inputRef.current, { fields: ["address_components", "name"] });
      box.addListener("place_changed", () => {
        const picked = describePlace(box.getPlace());
        if (!picked) return;
        setText(picked.label);
        setMove((m) => ({ ...m, to: picked.country, toPlace: picked.label }));
      });
      ac = box;
    });
    return () => {
      cancelled = true;
      if (google && ac) google.maps.event.clearInstanceListeners(ac);
    };
  }, [failed, setMove]);

  if (failed)
    return (
      <select
        value={countryBySlug(move.to) ? move.to : ""}
        onChange={(e) => setMove((m) => ({ ...m, to: e.target.value, toPlace: undefined }))}
        className={inputClass}
      >
        <option value="">Select</option>
        {COUNTRIES.filter((c) => c.slug !== ORIGIN).map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    );
  return (
    <input
      ref={inputRef}
      value={text}
      placeholder="City or country"
      autoComplete="off"
      onChange={(e) => {
        setText(e.target.value);
        // Typed text is not a place yet: the visitor picks one from Google's list.
        setMove((m) => (m.to ? { ...m, to: "", toPlace: undefined } : m));
      }}
      // Enter picks a suggestion; it must not submit the form.
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      className={inputClass}
    />
  );
}
