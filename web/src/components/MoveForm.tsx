"use client";

import {
  AirplaneTilt,
  Armchair,
  ArrowRight,
  EnvelopeSimple,
  HouseLine,
  MagnifyingGlass,
  Package,
  Phone,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from "react";
import { COUNTRIES, countryBySlug } from "@/lib/countries";
import { saveLead } from "@/lib/crm";
import { MOVE_TYPES, type MoveDetails, type MoveType, loadMove, saveMove, useIsClient } from "@/lib/move";
import { type Autocomplete, type Google, describePlace, loadPlaces, placesEnabled } from "@/lib/places";
import { destinationCode, originCode } from "@/lib/route";

const EMPTY: MoveDetails = { name: "", email: "", phone: "", from: "", to: "", date: "", moveType: "full" };

// Fields: 52 px, labels above.
const fieldClass =
  "mt-1.5 h-[52px] w-full min-w-0 rounded-xl border border-[var(--line-strong)] bg-[var(--card)] px-3.5 text-base font-semibold text-[var(--ink)] outline-none transition placeholder:text-[#8c9ab3] hover:border-[var(--primary-300)] focus:border-[var(--primary)] focus:shadow-[0_0_0_4px_var(--primary-100)]";
// The big "To" value inside the route bar.
const routeInputClass =
  "w-full min-w-0 bg-transparent text-[19px] font-extrabold tracking-[-0.02em] text-[var(--ink)] outline-none placeholder:font-bold placeholder:text-[#8c9ab3] lg:text-[22px]";

const TYPE_ICONS: Record<MoveType, typeof HouseLine> = { full: HouseLine, partial: Armchair, boxes: Package };

/** The move-details form: step 1 of the flow, shown in the landing page hero. */
export default function MoveForm() {
  const isClient = useIsClient();
  // The server sends the empty form so it shows at once; in the browser it is
  // drawn again with any saved details filled in.
  return <Form key={isClient ? "saved" : "empty"} saved={isClient} />;
}

function validate(m: MoveDetails): string | null {
  if (!m.from) return "Choose where you are moving from, using the suggestions.";
  if (!m.to) return "Choose where you are moving to from the suggestions.";
  if (m.to === m.from) return "Choose a destination in a different country.";
  if (!m.date) return "Choose your moving date.";
  if (!m.name.trim()) return "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(m.email)) return "Enter a valid email address.";
  if (m.phone.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  return null;
}

/**
 * Laid out like a flight search. Phones: one column. Desktops: a 24-column grid,
 * with the route bar (From, To, date) on one row and the contact details and
 * the button on the next.
 */
function Form({ saved }: { saved: boolean }) {
  const router = useRouter();
  const [move, setMove] = useState<MoveDetails>(() => ({ ...EMPTY, ...(saved ? loadMove() : null) }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MoveDetails>(key: K, value: MoveDetails[K]) => setMove((m) => ({ ...m, [key]: value }));
  // Only in the browser: the server's "today" can differ from the visitor's.
  const today = saved ? new Date().toISOString().slice(0, 10) : undefined;

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
      className="grid grid-cols-2 gap-x-2.5 gap-y-3 rounded-[22px] bg-[var(--card)] px-4 pb-4 pt-[18px] shadow-float lg:grid-cols-24 lg:gap-x-3 lg:gap-y-0 lg:rounded-3xl lg:p-7"
    >
      <div className="col-span-2 lg:col-start-1 lg:col-end-11 lg:row-start-1 lg:self-center">
        <h2 className="text-[19px] font-extrabold tracking-[-0.02em] lg:text-[22px]">Start your move plan</h2>
        <p className="mt-0.5 text-[13px] text-[var(--muted)] lg:mt-1 lg:text-sm">Step 1 of 5. Takes under a minute.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="col-span-2 flex gap-2.5 rounded-xl bg-[var(--bad-bg)] px-3.5 py-3 text-sm font-semibold leading-[1.45] text-[var(--bad)] lg:col-span-full lg:row-start-2 lg:mt-4"
        >
          <WarningCircle size={18} weight="fill" className="mt-px flex-none" />
          {error}
        </p>
      )}

      {/* Route bar: From and To, each a place search. The date joins it on desktops. */}
      <div className="relative col-span-2 grid rounded-2xl border border-[var(--line-strong)] lg:col-start-1 lg:col-end-18 lg:row-start-3 lg:mt-5 lg:grid-cols-[7fr_10fr] lg:rounded-r-none">
        <label className="group block min-h-16 cursor-text rounded-t-2xl border-b border-[var(--line-strong)] px-3.5 py-2.5 transition focus-within:shadow-[inset_0_0_0_2px_var(--primary)] lg:rounded-l-2xl lg:rounded-tr-none lg:border-b-0 lg:border-r lg:py-3.5 lg:pl-5 lg:pr-8">
          <span className="text-xs font-bold text-[var(--muted)] group-focus-within:text-[var(--primary)]">From</span>
          <span className="mt-0.5 flex items-center gap-2 lg:mt-1 lg:gap-2.5">
            {!move.from && <MagnifyingGlass size={18} className="flex-none text-[#8c9ab3] lg:hidden" aria-hidden />}
            <PlaceSearch side="from" move={move} setMove={setMove} />
            {move.from && (
              <span className="flex-none text-xs font-extrabold tracking-[0.06em] text-[var(--muted)] lg:text-[13px]">
                {originCode(move)}
              </span>
            )}
          </span>
        </label>
        <span
          aria-hidden
          className="absolute right-4 top-16 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[var(--card)] text-[var(--primary)] shadow-[0_0_0_1px_var(--line-strong),0_4px_10px_-4px_rgb(13_27_62/0.2)] lg:left-[calc(7/17*100%)] lg:right-auto lg:top-1/2 lg:-translate-x-1/2"
        >
          <AirplaneTilt size={18} weight="fill" className="rotate-[135deg] lg:rotate-45" />
        </span>
        <label className="group block min-h-16 cursor-text rounded-b-2xl px-3.5 py-2.5 transition focus-within:shadow-[inset_0_0_0_2px_var(--primary)] lg:rounded-none lg:py-3.5 lg:pl-8 lg:pr-5">
          <span className="text-xs font-bold text-[var(--muted)] group-focus-within:text-[var(--primary)]">To</span>
          <span className="mt-0.5 flex items-center gap-2 lg:mt-1 lg:gap-2.5">
            {!move.to && <MagnifyingGlass size={18} className="flex-none text-[#8c9ab3] lg:hidden" aria-hidden />}
            <PlaceSearch side="to" move={move} setMove={setMove} />
            {move.to && (
              <span className="flex-none text-xs font-extrabold tracking-[0.06em] text-[var(--muted)] lg:text-[13px]">
                {destinationCode(move)}
              </span>
            )}
          </span>
        </label>
      </div>

      <fieldset className="col-span-2 lg:col-start-11 lg:col-end-25 lg:row-start-1 lg:flex lg:items-center lg:justify-end lg:gap-3">
        <legend className="mb-1.5 text-[13px] font-bold lg:float-left lg:mb-0 lg:mr-3 lg:text-[var(--muted)]">
          What are you moving?
        </legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--chip)] p-1 lg:flex">
          {MOVE_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t.value];
            const on = move.moveType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={on}
                onClick={() => set("moveType", t.value)}
                className={`flex h-12 flex-col items-center justify-center gap-px whitespace-nowrap rounded-[9px] text-[13px] transition lg:h-10 lg:flex-row lg:gap-2 lg:px-3.5 lg:text-sm ${
                  on
                    ? "bg-[var(--card)] font-extrabold text-[var(--primary)] shadow-[0_1px_2px_rgb(13_27_62/0.1),0_0_0_1.5px_var(--primary)]"
                    : "font-bold text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon size={16} weight={on ? "bold" : "regular"} aria-hidden />
                <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block min-w-0 text-[13px] font-bold lg:col-start-18 lg:col-end-25 lg:row-start-3 lg:-ml-3 lg:mt-5 lg:cursor-pointer lg:rounded-r-2xl lg:border lg:border-l-0 lg:border-[var(--line-strong)] lg:px-5 lg:py-3.5 lg:transition lg:focus-within:shadow-[inset_0_0_0_2px_var(--primary)] lg:hover:bg-[#f8fafd]">
        <span className="lg:text-xs lg:text-[var(--muted)]">Moving date</span>
        <input
          type="date"
          min={today}
          value={move.date}
          onChange={(e) => set("date", e.target.value)}
          className={`${fieldClass} lg:mt-1 lg:h-auto lg:min-h-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:text-[22px] lg:font-extrabold lg:tracking-[-0.02em] lg:focus:shadow-none`}
        />
      </label>

      <Field label="Phone" icon={<Phone size={18} />} className="lg:col-start-13 lg:col-end-18">
        <input type="tel" value={move.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" className={fieldClass} />
      </Field>
      <Field label="Full name" icon={<User size={18} />} className="col-span-2 lg:col-start-1 lg:col-end-7">
        <input value={move.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={fieldClass} />
      </Field>
      <Field label="Email" icon={<EnvelopeSimple size={18} />} className="col-span-2 lg:col-start-7 lg:col-end-13">
        <input
          type="email"
          value={move.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
          className={fieldClass}
        />
      </Field>

      <button className="btn-primary group col-span-2 mt-1 flex h-14 items-center justify-between rounded-[14px] px-5 text-base font-extrabold shadow-[0_10px_24px_-12px_var(--primary)] transition lg:col-start-18 lg:col-end-25 lg:row-start-4 lg:mt-4 lg:self-end">
        Next: scan your rooms <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
      </button>
    </form>
  );
}

/** A labelled field; on desktops it sits in the contact row with a leading icon. */
function Field({ label, icon, className, children }: { label: string; icon: ReactNode; className: string; children: ReactNode }) {
  return (
    <label className={`block min-w-0 text-[13px] font-bold lg:row-start-4 lg:mt-4 ${className}`}>
      {label}
      <span className="relative block lg:[&_input]:pl-10">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-[calc(50%+3px)] hidden -translate-y-1/2 text-[var(--muted)] lg:block">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

/**
 * Google search for where the move starts or ends: a city, region or country.
 * The picked place's country decides which customs documents the summary
 * shows. Without Google (no key, or it failed to load) it is a plain list of
 * our countries.
 */
function PlaceSearch({
  side,
  move,
  setMove,
}: {
  side: "from" | "to";
  move: MoveDetails;
  setMove: Dispatch<SetStateAction<MoveDetails>>;
}) {
  const placeKey = side === "from" ? "fromPlace" : "toPlace";
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => move[placeKey] ?? countryBySlug(move[side])?.name ?? move[side]);
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
        setMove((m) => ({ ...m, [side]: picked.country, [placeKey]: picked.label }));
      });
      ac = box;
    });
    return () => {
      cancelled = true;
      if (google && ac) google.maps.event.clearInstanceListeners(ac);
    };
  }, [failed, setMove, side, placeKey]);

  if (failed)
    return (
      <select
        value={countryBySlug(move[side]) ? move[side] : ""}
        onChange={(e) => setMove((m) => ({ ...m, [side]: e.target.value, [placeKey]: undefined }))}
        className={`${routeInputClass} cursor-pointer`}
      >
        <option value="">Select</option>
        {COUNTRIES.map((c) => (
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
        setMove((m) => (m[side] ? { ...m, [side]: "", [placeKey]: undefined } : m));
      }}
      // Enter picks a suggestion; it must not submit the form.
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      className={routeInputClass}
    />
  );
}
