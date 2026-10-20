"use client";

import { ArrowClockwise, ArrowLeft, ChatCircleDots, Lock, SignOut } from "@phosphor-icons/react";
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">Team</span>
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => load(password)}
            className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm transition hover:border-[var(--primary)]"
          >
            <ArrowClockwise size={16} className={loading ? "motion-safe:animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={() => {
              storePassword("");
              setPassword("");
              setLeads(null);
              setOpen(null);
            }}
            className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm transition hover:border-[var(--primary)]"
          >
            <SignOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <section className="mt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {leads.length} enquir{leads.length === 1 ? "y" : "ies"} · {finished} finished the room survey
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className={`space-y-2 ${open ? "hidden lg:block" : ""}`}>
          {leads.length === 0 && (
            <li className="rounded-3xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
              No enquiries yet. They appear here when someone fills in the form or finishes a chat.
            </li>
          )}
          {leads.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => openLead(l.id)}
                className={`lift w-full rounded-2xl border bg-[var(--card)] p-4 text-left ${
                  open?.id === l.id ? "border-[var(--primary)]" : "border-[var(--line)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name || "No name yet"}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {country(l.from_country)} → {country(l.to_country)} · {moveDate(l.move_date)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      l.source === "chat" ? "bg-[var(--primary)]/12 text-[var(--primary)]" : "bg-[var(--chip)] text-[var(--muted)]"
                    }`}
                  >
                    {l.source === "chat" ? "Chat" : "Form"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>
                    {l.survey_volume_ft3 != null
                      ? `Survey: ${Math.round(l.survey_volume_ft3)} ft³ · ${l.survey_items} items`
                      : "Survey not finished"}
                  </span>
                  <span>{when(l.created_at)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {open && <LeadDetail lead={open} onBack={() => setOpen(null)} />}
      </div>
    </div>
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
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/12 text-[var(--primary)]">
          <Lock size={22} weight="duotone" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Team access</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">See enquiries from the form and the AI chat.</p>
        <label className="mt-5 block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={props.password}
            onChange={(e) => props.setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 outline-none focus:border-[var(--primary)]"
          />
        </label>
        {props.error && <p className="mt-3 text-sm text-[var(--bad)]">{props.error}</p>}
        <button
          disabled={!props.password || props.loading}
          className="btn-primary mt-5 w-full rounded-full bg-[var(--primary)] py-3 font-semibold text-[var(--on-primary)] disabled:opacity-50"
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
    ["Route", `${country(lead.from_country)} → ${extras.to_place ?? country(lead.to_country)}`],
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
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--card)] lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center gap-3 border-b border-[var(--line)] p-5">
        <button onClick={onBack} aria-label="Back to the list" className="-ml-2 rounded-full p-2 hover:bg-[var(--chip)] lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{lead.name || "No name yet"}</h2>
          <p className="text-xs text-[var(--muted)]">From the {lead.source === "chat" ? "AI chat" : "homepage form"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="min-w-0 break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {lead.messages && lead.messages.length > 0 && (
        <div className="border-t border-[var(--line)] p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ChatCircleDots size={18} /> Chat
          </h3>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {lead.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-[var(--primary)] text-[var(--on-primary)]"
                      : "rounded-bl-md bg-[var(--chip)]"
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
