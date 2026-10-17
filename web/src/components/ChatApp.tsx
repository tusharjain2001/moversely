"use client";

import { ArrowCounterClockwise, ArrowLeft, ArrowRight, PaperPlaneRight, PencilSimple, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { countryBySlug } from "@/lib/countries";
import { type ChatMessage, type ChatReply, type ChatWidget, chatGet, chatSend } from "@/lib/crm";
import { MOVE_TYPES, type MoveDetails, saveMove, useIsClient } from "@/lib/move";

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
      <header className="border-b border-[var(--line)] bg-[var(--card)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href="/" aria-label="Back to home" className="-ml-2 rounded-full p-2 transition hover:bg-[var(--chip)]">
            <ArrowLeft size={20} />
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
            <Sparkle size={18} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold leading-tight">AI moving assistant</h1>
            <p className="truncate text-xs text-[var(--muted)]">Here to plan your move</p>
          </div>
          <button
            onClick={restart}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--primary)] disabled:opacity-40"
          >
            <ArrowCounterClockwise size={14} /> Start over
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="chat-in flex items-end gap-2">
                <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
                  <Sparkle size={14} weight="fill" />
                </span>
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 leading-relaxed">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i} className="chat-in flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--primary)] px-4 py-2.5 leading-relaxed text-[var(--on-primary)]">
                  {m.text}
                </p>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-end gap-2" aria-label="The assistant is typing">
              <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
                <Sparkle size={14} weight="fill" />
              </span>
              <span className="flex gap-1 rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--card)] px-4 py-3.5">
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

      <footer className="border-t border-[var(--line)] bg-[var(--card)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl px-4 pt-3">
          {error && <p className="mb-2 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</p>}

          {!busy && widget?.type === "chips" && (
            <div className="mb-3 flex flex-wrap gap-2">
              {widget.options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => send("", o.value, o.label)}
                  className="rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/5 px-3.5 py-1.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-[var(--on-primary)] active:scale-[0.97]"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {!busy && widget?.type === "date" && (
            <div className="mb-3 flex gap-2">
              <input
                type="date"
                min={widget.min}
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 outline-none focus:border-[var(--primary)]"
              />
              <button
                disabled={!dateDraft}
                onClick={() => send("", dateDraft, longDate(dateDraft))}
                className="btn-primary rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type={inputType}
              inputMode={inputType === "tel" ? "tel" : inputType === "email" ? "email" : undefined}
              autoComplete={inputType === "email" ? "email" : inputType === "tel" ? "tel" : widget?.type === "text" ? "name" : "off"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={widget?.type === "text" ? widget.placeholder : "Type a message or ask a question…"}
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-3 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
            <button
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="btn-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] disabled:opacity-40"
            >
              <PaperPlaneRight size={20} weight="fill" />
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            This chat is saved so our team can help plan your move.
          </p>
        </div>
      </footer>
    </div>
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
    <div className="chat-in ml-9 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)]">
      <div className="night-panel px-5 py-4 text-[var(--on-night)]">
        <p className="text-xs uppercase tracking-wider opacity-70">Your move</p>
        <p className="mt-0.5 text-lg font-semibold">{rows[0][1]}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-sm">
        {rows.slice(1).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--muted)]">{k}</dt>
            <dd className="min-w-0 truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-5 py-4">
        <button
          onClick={onStart}
          className="btn-primary group flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)]"
        >
          Start AI survey <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium transition hover:border-[var(--primary)]"
        >
          <PencilSimple size={16} /> Change something
        </button>
      </div>
    </div>
  );
}
