"use client";

import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ChatCircleDots,
  CheckCircle,
  CircleDashed,
  Lock,
  NotePencil,
  SignOut,
  Sparkle,
  Tray,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { countryBySlug } from "@/lib/countries";
import { type Lead, adminLead, adminLeads } from "@/lib/crm";
import { MOVE_TYPES, useIsClient } from "@/lib/move";
import Logo from "@/components/Logo";

const PW_KEY = "ai-room-survey:admin";

function loadPassword(): string {
  try {
    return sessionStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}

function storePassword(pw: string) {
  try {
    if (pw) sessionStorage.setItem(PW_KEY, pw);
    else sessionStorage.removeItem(PW_KEY);
  } catch {}
}

const country = (slug: string | null) => (slug ? (countryBySlug(slug)?.name ?? slug) : "?");
const when = (iso: string) =>
  new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const moveDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "?";
const initials = (name: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const outlineButton =
  "flex h-10 items-center gap-1.5 rounded-[10px] bg-[var(--card)] px-3.5 text-sm font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]";

/** The team's view of every enquiry: homepage form and "Talk to AI" chats. */
export default function AdminApp() {
  const isClient = useIsClient();
  return isClient ? <Admin /> : <div className="min-h-dvh" />;
}

function Admin() {
  const [password, setPassword] = useState(loadPassword);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [open, setOpen] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(loadPassword()));

  const request = useCallback((pw: string) => {
    adminLeads(pw)
      .then((rows) => {
        setLeads(rows);
        setError(null);
        storePassword(pw);
      })
      .catch((e: Error & { status?: number }) => {
        setLeads(null);
        setError(e.status === 401 ? "Wrong password." : e.message);
        if (e.status === 401) storePassword("");
      })
      .finally(() => setLoading(false));
  }, []);

  const load = (pw: string) => {
    setLoading(true);
    request(pw);
  };

  // Signed in earlier in this tab: show the leads straight away.
  useEffect(() => {
    const saved = loadPassword();
    if (saved) request(saved);
  }, [request]);

  const openLead = (id: string) => {
    adminLead(password, id)
      .then(setOpen)
      .catch((e: Error) => setError(e.message));
  };

  if (leads === null)
    return <Login password={password} setPassword={setPassword} onSubmit={() => load(password)} error={error} loading={loading} />;

  const finished = leads.filter((l) => l.survey_volume_ft3 != null).length;
  const signOut = () => {
    storePassword("");
    setPassword("");
    setLeads(null);
    setOpen(null);
  };

  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-[var(--card)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1344px] items-center justify-between gap-3 pl-4 pr-3 sm:h-[68px] sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="text-[17px] sm:text-[19px]" />
            <span className="flex h-6 items-center rounded-md bg-[var(--chip)] px-2 text-xs font-extrabold text-[var(--muted)]">Team</span>
          </Link>
          <div className="flex gap-1.5 sm:gap-2">
            <button onClick={() => load(password)} aria-label="Refresh" className={`${outlineButton} max-sm:w-11 max-sm:justify-center max-sm:px-0`}>
              <ArrowClockwise size={16} weight="bold" className={loading ? "motion-safe:animate-spin" : ""} />
              <span className="max-sm:hidden">Refresh</span>
            </button>
            <button onClick={signOut} aria-label="Sign out" className={`${outlineButton} max-sm:w-11 max-sm:justify-center max-sm:px-0`}>
              <SignOut size={16} weight="bold" />
              <span className="max-sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1344px] px-3 pb-12 pt-[18px] sm:px-8 sm:pt-7">
        <section className="px-1 sm:px-0">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-[28px]">Leads</h1>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--muted)] sm:mt-1 sm:text-sm">
            {leads.length} enquir{leads.length === 1 ? "y" : "ies"} · {finished} finished the room survey
          </p>
        </section>

        {error && (
          <p role="alert" className="mt-4 flex gap-2.5 rounded-[14px] bg-[var(--bad-bg)] px-3.5 py-3 text-sm font-semibold text-[var(--bad)]">
            <WarningCircle size={18} weight="fill" className="shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-3.5 grid items-start gap-5 sm:mt-5 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className={open ? "hidden lg:block" : ""}>
            {leads.length === 0 ? (
              <div className="rounded-[18px] border-2 border-dashed border-[#c9d5e8] p-9 text-center">
                <Tray size={34} weight="duotone" className="mx-auto text-[var(--primary)]" />
                <p className="mx-auto mt-2.5 max-w-[340px] text-sm leading-relaxed text-[var(--muted)]">
                  No enquiries yet. They appear here when someone fills in the form or finishes a chat.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop: a table */}
                <div className="hidden overflow-hidden rounded-[18px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line)] lg:block">
                  <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,0.95fr)_72px_minmax(0,1.35fr)_128px] gap-3 border-b border-[var(--line)] bg-[#f8fafd] px-5 py-3 text-[11px] font-extrabold tracking-[0.08em] text-[var(--muted)]">
                    <span>NAME</span>
                    <span>ROUTE</span>
                    <span>MOVE DATE</span>
                    <span>SOURCE</span>
                    <span>ROOM SURVEY</span>
                    <span className="text-right">RECEIVED</span>
                  </div>
                  {leads.map((l) => {
                    const active = open?.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => openLead(l.id)}
                        className={`grid min-h-[60px] w-full grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,0.95fr)_72px_minmax(0,1.35fr)_128px] items-center gap-3 border-b border-[var(--chip)] px-5 text-left transition last:border-b-0 ${
                          active ? "bg-[var(--primary-50)] shadow-[inset_3px_0_0_var(--primary)]" : "bg-[var(--card)] hover:bg-[var(--paper)]"
                        }`}
                      >
                        <span className={`truncate text-sm font-extrabold ${l.name ? "" : "text-[#8c9ab3]"}`}>{l.name || "No name yet"}</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          <span className="shrink-0">{country(l.from_country)}</span>
                          <ArrowRight size={12} weight="bold" className="shrink-0 text-[var(--muted)]" />
                          <span className="truncate">{country(l.to_country)}</span>
                        </span>
                        <span className="text-sm font-semibold text-[var(--muted)]">{moveDate(l.move_date)}</span>
                        <span>
                          <SourceTag source={l.source} />
                        </span>
                        <SurveyStatus lead={l} />
                        <span className="text-right text-[13px] font-semibold text-[var(--muted)]">{when(l.created_at)}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Phones and tablets: cards */}
                <ul className="grid gap-2 lg:hidden">
                  {leads.map((l) => (
                    <li key={l.id}>
                      <button
                        onClick={() => openLead(l.id)}
                        className={`w-full rounded-2xl bg-[var(--card)] p-3.5 text-left transition ${
                          open?.id === l.id ? "shadow-[0_0_0_1.5px_var(--primary)]" : "shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1.5px_var(--primary)]"
                        }`}
                      >
                        <span className="flex justify-between gap-2.5">
                          <span className="min-w-0">
                            <span className={`block truncate text-[15px] font-extrabold ${l.name ? "" : "text-[#8c9ab3]"}`}>
                              {l.name || "No name yet"}
                            </span>
                            <span className="mt-0.5 block text-[13px] text-[var(--muted)]">
                              {country(l.from_country)} → {country(l.to_country)} · {moveDate(l.move_date)}
                            </span>
                          </span>
                          <SourceTag source={l.source} />
                        </span>
                        <span className="mt-2 flex justify-between gap-2 text-xs font-semibold text-[var(--muted)]">
                          <span className={l.survey_volume_ft3 != null ? "text-[var(--ok)]" : ""}>
                            {l.survey_volume_ft3 != null
                              ? `Survey: ${Math.round(l.survey_volume_ft3).toLocaleString()} ft³ · ${l.survey_items} items`
                              : "Survey not finished"}
                          </span>
                          <span>{when(l.created_at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {open && <LeadDetail lead={open} onBack={() => setOpen(null)} />}
        </div>
      </div>
    </div>
  );
}

function SourceTag({ source }: { source: Lead["source"] }) {
  const chat = source === "chat";
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-extrabold ${
        chat ? "bg-[var(--primary-50)] text-[var(--primary)]" : "bg-[var(--chip)] text-[var(--muted)]"
      }`}
    >
      {chat ? <Sparkle size={12} weight="bold" /> : <NotePencil size={12} weight="bold" />}
      {chat ? "Chat" : "Form"}
    </span>
  );
}

function SurveyStatus({ lead }: { lead: Lead }) {
  const done = lead.survey_volume_ft3 != null;
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] font-bold ${done ? "text-[var(--ok)]" : "text-[var(--muted)]"}`}>
      {done ? <CheckCircle size={14} weight="bold" /> : <CircleDashed size={14} weight="bold" />}
      {done ? `${Math.round(lead.survey_volume_ft3 ?? 0).toLocaleString()} ft³ · ${lead.survey_items} items` : "Not finished"}
    </span>
  );
}

function Login(props: {
  password: string;
  setPassword: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  loading: boolean;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (props.password) props.onSubmit();
  };
  const wrong = Boolean(props.error);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--paper)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[380px] rounded-[22px] bg-[var(--card)] p-7 shadow-[0_0_0_1px_var(--line),0_24px_48px_-28px_rgb(10_70_150/0.4)]"
      >
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--primary-50)] text-[var(--primary)]">
          <Lock size={24} weight="duotone" />
        </span>
        <h1 className="mt-[18px] text-[22px] font-extrabold tracking-[-0.01em]">Team access</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">See enquiries from the form and the AI chat.</p>
        <label className={`mt-5 block text-[13px] font-bold ${wrong ? "text-[var(--bad)]" : ""}`}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={props.password}
            onChange={(e) => props.setPassword(e.target.value)}
            className={`mt-1.5 h-[52px] w-full rounded-xl bg-[var(--card)] px-3.5 text-base font-semibold text-[var(--ink)] outline-none transition ${
              wrong
                ? "shadow-[inset_0_0_0_2px_var(--bad)]"
                : "shadow-[inset_0_0_0_1px_var(--line-strong)] focus:shadow-[inset_0_0_0_2px_var(--primary),0_0_0_4px_var(--primary-100)]"
            }`}
          />
        </label>
        {props.error && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--bad)]">
            <WarningCircle size={14} weight="bold" className="shrink-0" />
            {props.error}
          </p>
        )}
        <button
          disabled={!props.password || props.loading}
          className="btn-primary mt-[18px] h-[52px] w-full rounded-[14px] text-[15px] font-extrabold disabled:opacity-45"
        >
          {props.loading ? "Checking…" : "Open leads"}
        </button>
      </form>
    </div>
  );
}

function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const extras = lead.extras ?? {};
  const rows: [string, string][] = [
    ["Route", `${extras.from_place ?? country(lead.from_country)} → ${extras.to_place ?? country(lead.to_country)}`],
    ["Moving date", moveDate(lead.move_date)],
    ["Moving", MOVE_TYPES.find((t) => t.value === lead.move_type)?.label ?? lead.move_type ?? "?"],
    ["Email", lead.email ?? "?"],
    ["Phone", lead.phone ?? "?"],
    ...(extras.vehicle ? [["Car or motorbike", extras.vehicle === "yes" ? "Yes" : "No"] as [string, string]] : []),
    ...(extras.pets ? [["Pets", extras.pets === "yes" ? "Yes" : "No"] as [string, string]] : []),
    [
      "Room survey",
      lead.survey_volume_ft3 != null ? `${Math.round(lead.survey_volume_ft3)} ft³, ${lead.survey_items} items` : "Not finished",
    ],
    ["Received", when(lead.created_at)],
  ];
  return (
    <section className="rounded-[18px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_18px_40px_-28px_rgb(10_70_150/0.35)] lg:sticky lg:top-6">
      <div className="flex items-center gap-3.5 border-b border-[var(--line)] px-[22px] py-5">
        <button
          onClick={onBack}
          aria-label="Back to the list"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-[var(--chip)] lg:hidden"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--primary-50)] text-[15px] font-extrabold text-[var(--primary)]">
          {initials(lead.name)}
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold">
            <span className="block truncate">{lead.name || "No name yet"}</span>
          </h2>
          <p className="mt-0.5 text-[13px] font-semibold text-[var(--muted)]">From the {lead.source === "chat" ? "AI chat" : "homepage form"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 px-[22px] py-[18px] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="min-w-0 break-words font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {lead.messages && lead.messages.length > 0 && (
        <div className="border-t border-[var(--line)] px-[22px] py-[18px]">
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <ChatCircleDots size={18} weight="bold" /> Chat
          </h3>
          <div className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
            {lead.messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <p
                  className={`inline-block max-w-[85%] whitespace-pre-wrap px-3 py-[9px] text-left text-[13px] leading-normal ${
                    m.role === "user"
                      ? "rounded-[14px] rounded-br-[4px] bg-[var(--primary)] text-[var(--on-primary)]"
                      : "rounded-[14px] rounded-bl-[4px] bg-[var(--chip)]"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
