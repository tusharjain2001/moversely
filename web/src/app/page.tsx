import {
  AirplaneLanding,
  AirplaneTakeoff,
  ArrowRight,
  CaretDown,
  Cube,
  DeviceMobile,
  DownloadSimple,
  FileText,
  IdentificationCard,
  Package,
  PencilSimple,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import Link from "next/link";
import MoveForm from "@/components/MoveForm";
import { COUNTRIES } from "@/lib/countries";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#documents", label: "Documents" },
  { href: "#faq", label: "FAQ" },
];

const STEPS = [
  {
    title: "Tell us about your move",
    body: "Pick the countries you are moving between, your date, and how much you are taking.",
  },
  {
    title: "Scan each room",
    body: "Walk slowly around the room while your phone records. Twenty to sixty seconds is enough.",
  },
  {
    title: "Get your moving plan",
    body: "See every item with its size, your total volume, the right container, and your customs checklist.",
  },
];

const FAQ = [
  {
    q: "Do I need to download an app?",
    a: "No. Everything runs in your phone's web browser, on any recent iPhone or Android phone.",
  },
  {
    q: "How accurate are the sizes?",
    a: "They are AI estimates. In our testing so far, a room's total volume lands within about 20 to 25 percent. You can correct any item before you book.",
  },
  {
    q: "How long does it take?",
    a: "Recording takes under a minute per room. The AI then needs a couple of minutes to measure each room, and you can keep scanning while it works.",
  },
  {
    q: "Which countries are covered?",
    a: `Customs checklists are ready for ${COUNTRIES.map((c) => c.name).join(", ")}. More countries are being added.`,
  },
  {
    q: "Where do the document checklists come from?",
    a: "They are short summaries written by us from the FIDI Customs Guides, with a link to each full guide. Rules change, so always confirm the final list with your mover.",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="tape-mark" aria-hidden />
            <span className="font-semibold tracking-tight">AI Move Survey</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="link-underline transition hover:text-[var(--ink)]">
                {n.label}
              </a>
            ))}
            <Link href="/chat" className="link-underline flex items-center gap-1.5 font-medium text-[var(--primary)]">
              <Sparkle size={16} weight="fill" /> Talk to AI
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/chat"
              aria-label="Talk to AI"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--primary)]/40 text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-[var(--on-primary)] md:hidden"
            >
              <Sparkle size={18} weight="fill" />
            </Link>
            <a
              href="#start"
              className="btn-primary rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: the client wants the form on the first screen. */}
        <div className="hero-glow">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_minmax(0,480px)] lg:items-center lg:gap-16 lg:pt-16">
          <div className="fade-up">
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl lg:text-6xl">
              Measure your home <span className="text-[var(--primary)]">with your phone.</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[var(--muted)]">
              Record each room on your phone. AI measures your furniture and lists the customs documents for your route.
            </p>
            <Link
              href="/chat"
              className="group mt-8 inline-flex items-center gap-2 font-semibold underline decoration-[var(--tape)] decoration-2 underline-offset-[6px] transition hover:decoration-[var(--ink)]"
            >
              Prefer to chat? Talk to our AI assistant{" "}
              <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div id="start" className="fade-up scroll-mt-24 [animation-delay:120ms]">
            <MoveForm />
          </div>
        </section>
        </div>

        <section aria-label="Countries covered" className="border-y border-[var(--line)] bg-[var(--card)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:gap-8">
            <p className="shrink-0 text-sm font-medium text-[var(--muted)]">Customs checklists for</p>
            <ul className="flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <li key={c.slug} className="cursor-default rounded-full border border-[var(--line)] px-3 py-1 text-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)]">
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28">
          <h2 className="reveal max-w-[22ch] text-3xl font-semibold tracking-tight sm:text-4xl">
            From a short video to a full moving plan
          </h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <span className="absolute left-[18px] top-2 h-[calc(100%-6rem)] w-px bg-[var(--line)] md:left-0 md:top-[18px] md:h-px md:w-full" aria-hidden />
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal group relative grid grid-cols-[auto_1fr] gap-4 md:block">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tape)] font-mono text-sm font-semibold text-black ring-4 ring-[var(--paper)] transition duration-300 group-hover:scale-110">
                  {i + 1}
                </span>
                <div className="md:mt-6">
                  <h3 className="text-lg font-semibold transition-colors group-hover:text-[var(--primary)]">{s.title}</h3>
                  <p className="mt-1.5 max-w-[36ch] text-[var(--muted)]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
          <h2 className="reveal max-w-[20ch] text-3xl font-semibold tracking-tight sm:text-4xl">No home visit. No tape measure. No guesswork.</h2>
          <div className="mt-10 grid gap-3 md:grid-cols-6">
            <div className="reveal lift sheen group flex min-h-64 flex-col justify-between rounded-3xl night-panel p-7 text-[var(--on-night)] md:col-span-4">
              <Cube size={32} weight="duotone" className="transition duration-500 group-hover:rotate-[20deg] group-hover:scale-110" />
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Measured in 3D, not guessed</h3>
                <p className="mt-2 max-w-[48ch] opacity-70">
                  The AI finds each piece of furniture, works out how far away it is, and measures its length, width and height.
                </p>
              </div>
            </div>
            <div className="reveal lift tape group flex flex-col justify-between rounded-3xl bg-[var(--tape)] p-7 text-black md:col-span-2">
              <DeviceMobile size={32} weight="duotone" className="transition duration-300 group-hover:-rotate-12 group-hover:scale-110" />
              <div className="mt-10">
                <h3 className="text-xl font-semibold tracking-tight">No app to install</h3>
                <p className="mt-2 text-black/70">Works in the browser on any iPhone or Android.</p>
              </div>
            </div>
            <Tile icon={<PencilSimple size={28} weight="duotone" />} title="You stay in control">
              Change a size, remove an item, or add one the AI missed.
            </Tile>
            <Tile icon={<Package size={28} weight="duotone" />} title="The right container">
              Your total volume points to a shared container, a 20 ft or a 40 ft.
            </Tile>
            <Tile icon={<DownloadSimple size={28} weight="duotone" />} title="An inventory for your mover">
              Download the full item list as a spreadsheet.
            </Tile>
          </div>
        </section>

        <section id="documents" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--card)]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:items-center md:gap-16 md:py-28">
            <div>
              <FileText size={32} weight="duotone" className="reveal text-[var(--accent)]" />
              <h2 className="reveal mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Know your paperwork before you pack</h2>
              <p className="reveal mt-4 max-w-[48ch] text-lg leading-relaxed text-[var(--muted)]">
                Your summary lists the documents for leaving one country and arriving in the next, plus duty-free rules and
                items to leave behind.
              </p>
            </div>
            <dl className="grid gap-3">
              {(
                [
                  [IdentificationCard, "Every move", "Passport, visa or residence permit, and a full inventory in English."],
                  [AirplaneTakeoff, "Leaving", "Export papers for your origin country, and items you cannot take."],
                  [AirplaneLanding, "Arriving", "Import papers, duty-free rules, and restricted items at your destination."],
                ] as const
              ).map(([Icon, t, d]) => (
                <div key={t} className="reveal lift group flex gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/12 text-[var(--primary)] transition duration-300 group-hover:scale-110">
                    <Icon size={22} weight="duotone" />
                  </span>
                  <div>
                    <dt className="font-semibold">{t}</dt>
                    <dd className="mt-1 text-[var(--muted)]">{d}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.5fr] md:py-28">
          <h2 className="reveal text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
          <div className="reveal divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold transition-colors hover:text-[var(--primary)] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <CaretDown size={18} className="shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="faq-answer mt-3 max-w-[60ch] text-[var(--muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="reveal sheen night-panel flex flex-col items-start justify-between gap-6 rounded-3xl p-8 text-[var(--on-night)] sm:p-12 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Plan your move tonight</h2>
              <p className="mt-2 opacity-70">Start with your route. Scan your rooms whenever you are ready.</p>
            </div>
            <a
              href="#start"
              className="btn-accent group inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--tape)] px-6 py-3.5 font-semibold text-black"
            >
              Get started <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2 text-[var(--ink)]">
            <span className="tape-mark" aria-hidden />
            <span className="font-semibold tracking-tight">AI Move Survey</span>
          </div>
          <p className="max-w-[70ch] text-xs leading-relaxed">
            Sizes are AI estimates. Customs summaries are based on the FIDI Customs Guides and are for information only. We
            are not affiliated with FIDI and are not FAIM certified.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="reveal lift group flex flex-col justify-between gap-8 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-7 md:col-span-2">
      <span className="w-fit text-[var(--primary)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-110">{icon}</span>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[var(--muted)]">{children}</p>
      </div>
    </div>
  );
}
