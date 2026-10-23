"use client";

import {
  AirplaneTilt,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  PaperPlaneRight,
  PencilSimple,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { countryBySlug } from "@/lib/countries";
import { type ChatMessage, type ChatReply, type ChatWidget, chatGet, chatSend } from "@/lib/crm";
import { MOVE_TYPES, type MoveDetails, saveMove, useIsClient } from "@/lib/move";
import Logo from "./Logo";

const CHAT_KEY = "ai-room-survey:chat";

function loadChatId(): string | null {
  try {
    return localStorage.getItem(CHAT_KEY);
  } catch {
    return null;
  }
}

function storeChatId(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAT_KEY, id);
    else localStorage.removeItem(CHAT_KEY);
  } catch {}
}

const longDate = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** "Talk to AI": collects the move details in a chat, then hands over to the survey. */
export default function ChatApp() {
  const isClient = useIsClient();
  return isClient ? <Chat /> : <div className="min-h-dvh" />;
}

function Chat() {
  const router = useRouter();
  const [cid, setCid] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [widget, setWidget] = useState<ChatWidget | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const started = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apply = useCallback((reply: ChatReply, append: boolean) => {
    setCid(reply.conversation_id);
    storeChatId(reply.conversation_id);
    setMessages((prev) => (append ? [...prev, ...reply.messages] : reply.messages));
    setWidget(reply.widget);
    setLeadId(reply.lead_id);
    setError(null);
  }, []);

  const open = useCallback(
    (resumeId: string | null) => {
      (resumeId ? chatGet(resumeId).catch(() => chatSend({})) : chatSend({}))
        .then((r) => apply(r, false))
        .catch(() => setError("The assistant isn't available right now. Please try again in a moment."))
        .finally(() => setBusy(false));
    },
    [apply],
  );

  // Continue an earlier chat after a reload, or start a new one.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    open(loadChatId());
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, widget]);

  const send = (text: string, value = "", label = "") => {
    if (busy || !cid || !(text || value)) return;
    setMessages((prev) => [...prev, { role: "user", text: text || label || value }]);
    setDraft("");
    setBusy(true);
    chatSend({ conversation_id: cid, text, value })
      .then((r) => apply(r, true))
      .catch(() => setError("Your message didn't go through. Please try again."))
      .finally(() => {
        setBusy(false);
        inputRef.current?.focus();
      });
  };

  const restart = () => {
    storeChatId(null);
    setMessages([]);
    setWidget(null);
    setBusy(true);
    open(null);
  };

  const startSurvey = (move: MoveDetails) => {
    saveMove({ ...move, leadId: leadId ?? undefined });
    router.push("/survey");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft.trim());
  };

  const inputType = widget?.type === "text" ? widget.input : "text";

  return (
    <div className="flex h-dvh flex-col bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-[var(--card)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-[800px] items-center gap-1.5 px-2 py-2 sm:gap-3.5 sm:px-6 sm:py-3.5">
          <Link
            href="/"
            aria-label="Back to home"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-[var(--chip)]"
          >
            <ArrowLeft size={20} weight="bold" />
          </Link>
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] sm:h-11 sm:w-11">
            <Sparkle size={18} weight="fill" />
            <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full bg-[var(--logo-dot)] shadow-[0_0_0_2px_var(--card)]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-extrabold leading-tight sm:text-lg">
              <span className="block truncate">AI moving assistant</span>
            </h1>
            {busy ? (
              <p className="truncate text-xs font-bold text-[var(--teal-ink)] sm:text-[13px]">Typing…</p>
            ) : (
              <p className="truncate text-xs font-semibold text-[var(--muted)] sm:text-[13px]">Here to plan your move</p>
            )}
          </div>
          <Link href="/" className="mr-3 hidden sm:block">
            <Logo className="text-lg" />
          </Link>
          <button
            onClick={restart}
            disabled={busy}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--card)] px-3 text-[13px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)] disabled:opacity-40 max-[400px]:px-2.5 sm:px-3.5"
          >
            <ArrowCounterClockwise size={14} weight="bold" /> Start over
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[800px] flex-col gap-2.5 px-3.5 py-5 sm:gap-3 sm:px-6 sm:py-7">
          {messages.length > 0 && <p className="mx-auto mb-1.5 text-[11px] font-bold text-[#8c9ab3]">Today</p>}

          {busy && messages.length === 0 && !error && (
            <div
              aria-busy="true"
              aria-label="Loading the chat"
              className="grid gap-2.5 rounded-[18px] bg-[var(--card)] p-4 shadow-[0_0_0_1px_var(--line)]"
            >
              <div className="flex items-end gap-2">
                <span className="h-7 w-7 rounded-full bg-[var(--chip)]" />
                <span className="h-11 w-[70%] rounded-2xl bg-[var(--chip)] motion-safe:animate-pulse" />
              </div>
              <div className="flex justify-end">
                <span className="h-10 w-[40%] rounded-2xl bg-[#dce7f5] motion-safe:animate-pulse" />
              </div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="chat-in flex items-end gap-2 sm:gap-2.5">
                <BotAvatar />
                <p className="max-w-[82%] whitespace-pre-wrap rounded-[18px] rounded-bl-md bg-[var(--card)] px-3.5 py-3 text-[15px] leading-normal shadow-[0_0_0_1px_var(--line)] sm:max-w-[70%] sm:rounded-[20px] sm:rounded-bl-md sm:px-4 sm:py-3.5 sm:text-base">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i} className="chat-in flex justify-end">
                <p className="max-w-[82%] whitespace-pre-wrap rounded-[18px] rounded-br-md bg-[var(--primary)] px-3.5 py-3 text-[15px] leading-normal text-[var(--on-primary)] sm:max-w-[70%] sm:rounded-[20px] sm:rounded-br-md sm:px-4 sm:py-3.5 sm:text-base">
                  {m.text}
                </p>
              </div>
            ),
          )}

          {busy && messages.length > 0 && (
            <div className="flex items-end gap-2 sm:gap-2.5" aria-label="The assistant is typing">
              <BotAvatar />
              <span className="flex gap-[5px] rounded-[18px] rounded-bl-md bg-[var(--card)] px-4 py-3.5 shadow-[0_0_0_1px_var(--line)]">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 rounded-full bg-[var(--muted)] motion-safe:animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </div>
          )}

          {!busy && widget?.type === "summary" && (
            <SummaryCard move={widget.move} onStart={() => startSurvey(widget.move)} onEdit={() => send("", "edit", "Change something")} />
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--card)] pb-[max(1.125rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[800px] px-3.5 pt-3 sm:px-6 sm:pt-4">
          {error && (
            <p
              role="alert"
              className="mb-3 flex gap-2.5 rounded-[14px] bg-[var(--bad-bg)] px-3.5 py-3 text-sm font-semibold leading-snug text-[var(--bad)]"
            >
              <WarningCircle size={18} weight="fill" className="shrink-0" />
              {error}
            </p>
          )}

          {!busy && widget?.type === "chips" && (
            <div className="mb-3 flex flex-wrap gap-2">
              {widget.options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => send("", o.value, o.label)}
                  className="h-11 rounded-full bg-[var(--primary-50)] px-4 text-sm font-extrabold text-[var(--primary)] shadow-[inset_0_0_0_1.5px_var(--primary-300)] transition hover:bg-[var(--primary)] hover:text-[var(--on-primary)] active:scale-[0.97] sm:px-[18px]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {!busy && widget?.type === "date" && (
            <div className="mb-3 flex gap-2 rounded-2xl bg-[var(--paper)] p-2.5">
              <input
                type="date"
                min={widget.min}
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-xl bg-[var(--card)] px-3 text-[15px] font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] outline-none focus:shadow-[inset_0_0_0_2px_var(--primary)]"
              />
              <button
                disabled={!dateDraft}
                onClick={() => send("", dateDraft, longDate(dateDraft))}
                className="btn-primary h-12 rounded-xl px-[18px] text-sm font-extrabold disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2 sm:gap-2.5">
            <input
              ref={inputRef}
              type={inputType}
              inputMode={inputType === "tel" ? "tel" : inputType === "email" ? "email" : undefined}
              autoComplete={inputType === "email" ? "email" : inputType === "tel" ? "tel" : widget?.type === "text" ? "name" : "off"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={widget?.type === "text" ? widget.placeholder : "Type a message or ask a question…"}
              maxLength={500}
              className="h-[52px] min-w-0 flex-1 rounded-full bg-[var(--paper)] px-[18px] text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--line)] outline-none transition placeholder:font-medium placeholder:text-[#8c9ab3] focus:shadow-[inset_0_0_0_2px_var(--primary)] sm:h-14 sm:px-5 sm:text-base"
            />
            <button
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="btn-primary grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full disabled:opacity-40 sm:h-14 sm:w-14"
            >
              <PaperPlaneRight size={20} weight="fill" />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)] sm:mt-2.5 sm:text-xs">
            Your answers are sent to our team to help plan your move.
          </p>
        </div>
      </footer>
    </div>
  );
}

function BotAvatar() {
  return (
    <span className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--primary)] sm:h-8 sm:w-8">
      <Sparkle size={13} weight="fill" />
    </span>
  );
}

function SummaryCard({ move, onStart, onEdit }: { move: MoveDetails; onStart: () => void; onEdit: () => void }) {
  const rows: [string, string][] = [
    ["Route", `${countryBySlug(move.from)?.name ?? move.from} → ${countryBySlug(move.to)?.name ?? move.to}`],
    ["Moving", MOVE_TYPES.find((t) => t.value === move.moveType)?.label ?? move.moveType],
    ["Date", longDate(move.date)],
    ["Name", move.name],
    ["Email", move.email],
    ["Phone", move.phone],
  ];
  return (
    <div className="chat-in ml-9 overflow-hidden rounded-[22px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_18px_40px_-24px_rgb(10_70_150/0.4)] sm:ml-[42px] sm:max-w-md">
      <div className="bg-[var(--primary)] px-[18px] py-4 text-[var(--on-primary)]">
        <p className="text-[11px] font-extrabold tracking-[0.1em] text-[#cfe2f7]">YOUR MOVE</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 text-lg font-extrabold">
          <span>{countryBySlug(move.from)?.name ?? move.from}</span>
          <AirplaneTilt size={18} weight="fill" className="rotate-45" aria-label="to" />
          <span>{countryBySlug(move.to)?.name ?? move.to}</span>
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-[18px] py-3.5 text-sm">
        {rows.slice(1).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="min-w-0 truncate font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 border-t border-[var(--line)] px-3.5 pb-3.5 pt-3">
        <button
          onClick={onStart}
          className="btn-primary group flex h-[52px] items-center justify-between rounded-[14px] px-[18px] text-[15px] font-extrabold"
        >
          Start AI survey <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={onEdit}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[var(--card)] text-sm font-bold shadow-[inset_0_0_0_1px_var(--line-strong)] transition hover:text-[var(--primary)] hover:shadow-[inset_0_0_0_1.5px_var(--primary)]"
        >
          <PencilSimple size={16} weight="bold" /> Change something
        </button>
      </div>
    </div>
  );
}
