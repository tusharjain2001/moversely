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
  PencilSimple,
  ShippingContainer,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import Link from "next/link";
import MoveForm from "@/components/MoveForm";
import { COUNTRIES } from "@/lib/countries";
import Logo from "@/components/Logo";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#documents", label: "Documents" },
  { href: "#faq", label: "FAQ" },
];

// Shown beside each country in the "Customs checklists for" strip.
const ISO: Record<string, string> = {
  australia: "AU",
  canada: "CA",
  france: "FR",
  germany: "DE",
  india: "IN",
  "new-zealand": "NZ",
  singapore: "SG",
  uae: "AE",
  uk: "GB",
  usa: "US",
};

const STEPS = [
  {
    title: "Tell us about your move",
    body: "Where you are moving to, your date, and how much you are taking. Or answer a few questions in the chat.",
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

const eyebrow = "text-xs font-extrabold tracking-[0.1em] text-[var(--primary)] sm:text-[13px]";
const h2 = "text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[44px] sm:leading-[1.08] sm:tracking-[-0.03em]";

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-2 pl-4 pr-3 sm:h-[72px] sm:px-6 lg:px-12">
          <Link href="/" className="flex-1 md:flex-none">
            <Logo className="text-lg sm:text-xl" />
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 text-sm font-semibold md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-[10px] px-3.5 py-2.5 text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
              >
                {n.label}
              </a>
            ))}
            <Link
              href="/chat"
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-50)]"
            >
              <Sparkle size={16} weight="fill" /> Talk to AI
            </Link>
          </nav>
          <Link
            href="/chat"
            aria-label="Talk to AI"
            className="grid h-11 w-11 place-items-center rounded-full bg-[var(--primary-50)] text-[var(--primary)] md:hidden"
          >
            <Sparkle size={18} weight="fill" />
          </Link>
          <a
            href="#start"
            className="btn-primary flex h-11 items-center rounded-xl px-4 text-sm font-extrabold transition sm:px-5"
          >
            Get started
          </a>
        </div>
      </header>

      <main id="main">
        {/* Hero: the client wants the form on the first screen. */}
        {/* The picture (a phone scanning a room, SIN → SYD) sits on the right;
            the left stays plain blue so the white headline reads clearly. */}
        <div className="bg-[var(--primary)] bg-[url(/hero/hero-mobile.webp)] bg-cover bg-top text-white md:min-h-[720px] lg:min-h-[800px] lg:bg-[url(/hero/hero-desktop.webp)]">
          <section className="mx-auto max-w-[1280px] px-5 pb-24 pt-6 sm:px-6 md:pb-0 md:pt-16 lg:px-12 lg:pt-[88px]">
            <div className="fade-up">
              <p className="inline-flex h-7 items-center gap-2 rounded-full bg-white/14 px-2.5 text-xs font-bold sm:h-8 sm:px-3 sm:text-[13px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5eead4]" aria-hidden />
                AI moving survey for international moves
              </p>
              <h1 className="mt-3.5 max-w-[63%] text-[34px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:mt-5 sm:text-[56px] lg:max-w-[13ch] lg:text-[68px] lg:leading-[1.02]">
                Measure your home <span className="text-[var(--primary-200)]">with your phone.</span>
              </h1>
              <p className="mt-3 max-w-[63%] text-[15px] leading-[1.45] text-[#eef5fd] sm:mt-5 sm:text-[17px] lg:max-w-[44ch] lg:text-[19px] lg:leading-[1.55]">
                Record each room on your phone. AI measures your furniture and lists the customs documents for your route.
              </p>
              {/* Tablets and desktops only: on phones the form should be on the first screen. */}
              <ul className="mt-6 hidden flex-wrap gap-2 text-sm font-bold md:flex">
                {(
                  [
                    [DeviceMobile, "No app, any phone"],
                    [Cube, "Measured in 3D"],
                    [FileText, "Customs checklist"],
                  ] as const
                ).map(([Icon, label]) => (
                  <li
                    key={label}
                    className="flex h-10 items-center gap-2 rounded-full bg-white/12 px-3.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
                  >
                    <Icon size={18} className="text-[var(--primary-200)]" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="mx-auto -mt-[72px] max-w-[1280px] px-3 sm:px-6 md:-mt-40 lg:-mt-[200px] lg:px-12">
          <div id="start" className="fade-up scroll-mt-24 [animation-delay:120ms]">
            <MoveForm />
          </div>
          <Link
            href="/chat"
            className="group mx-1 mt-3.5 inline-flex min-h-12 items-center gap-2.5 text-[15px] font-extrabold transition hover:text-[var(--primary)] sm:mt-5"
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--primary-50)] text-[var(--primary)]">
              <Sparkle size={16} weight="fill" />
            </span>
            Prefer to chat? Talk to our AI assistant
            <ArrowRight size={16} weight="bold" className="flex-none text-[var(--primary)] transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <section aria-label="Countries covered" className="mt-6 border-y border-[var(--line)] bg-[var(--card)] sm:mt-14">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-2.5 px-4 py-[18px] sm:px-6 md:flex-row md:items-center md:gap-7 md:py-[22px] lg:px-12">
            <p className="flex-none text-[13px] font-bold text-[var(--muted)] sm:text-sm">Customs checklists for</p>
            <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:gap-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {COUNTRIES.map((c) => (
                <li
                  key={c.slug}
                  className="flex h-[34px] flex-none items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[var(--paper)] pl-[5px] pr-2.5 text-[13px] font-bold sm:h-9 sm:gap-2 sm:rounded-[10px] sm:pl-1.5 sm:pr-3 sm:text-sm"
                >
                  <span className="rounded-[5px] bg-[var(--primary-50)] px-1 py-[3px] text-[10px] font-extrabold text-[var(--primary)] sm:px-[5px] sm:text-[11px]">
                    {ISO[c.slug]}
                  </span>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how"
          className="mx-auto grid max-w-[1280px] scroll-mt-20 gap-6 px-5 pb-2 pt-12 sm:px-6 sm:py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-20 lg:px-12 lg:py-28"
        >
          <div className="md:sticky md:top-28 md:self-start">
            <p className={`reveal ${eyebrow}`}>HOW IT WORKS</p>
            <h2 className={`reveal mt-2 max-w-[16ch] sm:mt-3 ${h2}`}>From a short video to a full moving plan</h2>
            <p className="reveal mt-2.5 max-w-[38ch] text-[15px] text-[var(--muted)] sm:mt-4 sm:text-[17px] sm:leading-relaxed">
              Three steps, all on your phone. No home visit needed.
            </p>
          </div>
          <ol className="relative">
            <span
              aria-hidden
              className="absolute bottom-5 left-[19px] top-5 border-l-2 border-dashed border-[#bbd0ea] sm:bottom-6 sm:left-[23px] sm:top-6"
            />
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="reveal relative grid grid-cols-[40px_1fr] gap-4 pb-6 last:pb-0 sm:grid-cols-[48px_1fr] sm:gap-6 sm:pb-10"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full text-[13px] font-extrabold sm:h-12 sm:w-12 sm:text-[15px] ${
                    i === 0
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--card)] text-[var(--primary)] shadow-[inset_0_0_0_2px_var(--primary)]"
                  }`}
                >
                  0{i + 1}
                </span>
                <div className="sm:pt-1">
                  <h3 className="text-[17px] font-extrabold sm:text-[22px] sm:tracking-[-0.01em]">{s.title}</h3>
                  <p className="mt-1 max-w-[46ch] text-sm leading-[1.55] text-[var(--muted)] sm:mt-2 sm:text-base sm:leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-[1280px] px-3 pt-10 sm:px-6 sm:pt-0 lg:px-12">
          <h2 className={`reveal mx-2 max-w-[20ch] sm:mx-0 ${h2}`}>No home visit. No tape measure. No guesswork.</h2>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-10 md:grid-cols-6 md:gap-4">
            <div className="reveal group col-span-2 flex flex-col justify-between gap-7 rounded-[20px] bg-[var(--primary)] p-[22px] text-white transition hover:bg-[var(--primary-hover)] sm:min-h-[280px] sm:rounded-3xl sm:p-8 md:col-span-4">
              <span className="sm:grid sm:h-[52px] sm:w-[52px] sm:place-items-center sm:rounded-[14px] sm:bg-white/14">
                <Cube size={28} className="transition duration-500 group-hover:rotate-[20deg]" />
              </span>
              <div>
                <h3 className="text-xl font-extrabold sm:text-[28px] sm:tracking-[-0.02em]">Measured in 3D, not guessed</h3>
                <p className="mt-1.5 max-w-[48ch] text-sm leading-[1.55] text-[#e3eefa] sm:mt-2.5 sm:text-base sm:leading-relaxed">
                  The AI finds each piece of furniture, works out how far away it is, and measures its length, width and height.
                </p>
              </div>
            </div>
            <Tile icon={<DeviceMobile size={28} />} title="No app to install" tinted>
              Works in the browser on any iPhone or Android.
            </Tile>
            <Tile icon={<PencilSimple size={28} />} title="You stay in control">
              Change a size, remove an item, or add one the AI missed.
            </Tile>
            <Tile icon={<ShippingContainer size={28} />} title="The right container">
              Your total volume points to a shared container, a 20 ft or a 40 ft.
            </Tile>
            <Tile icon={<DownloadSimple size={28} />} title="An inventory for your mover">
              Download the full item list as a spreadsheet.
            </Tile>
          </div>
        </section>

        <section id="documents" className="mt-10 scroll-mt-20 border-y border-[var(--line)] bg-[var(--card)] sm:mt-28">
          <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-10 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center md:gap-20 lg:px-12 lg:py-28">
            <div>
              <p className={`reveal ${eyebrow}`}>DOCUMENTS</p>
              <h2 className={`reveal mt-2 sm:mt-3 ${h2}`}>Know your paperwork before you pack</h2>
              <p className="reveal mt-2.5 max-w-[48ch] text-[15px] leading-[1.55] text-[var(--muted)] sm:mt-4 sm:text-lg sm:leading-relaxed">
                Your summary lists the documents for leaving one country and arriving in the next, plus duty-free rules and
                items to leave behind.
              </p>
            </div>
            <dl className="grid gap-2 sm:gap-3">
              {(
                [
                  [IdentificationCard, "Every move", "Passport, visa or residence permit, and a full inventory in English."],
                  [AirplaneTakeoff, "Leaving", "Export papers for your origin country, and items you cannot take."],
                  [AirplaneLanding, "Arriving", "Import papers, duty-free rules, and restricted items at your destination."],
                ] as const
              ).map(([Icon, t, d]) => (
                <div key={t} className="reveal flex gap-3.5 rounded-2xl bg-[var(--paper)] p-4 sm:gap-4 sm:rounded-[18px] sm:p-5">
                  <span className="flex-none text-[var(--primary)] sm:grid sm:h-12 sm:w-12 sm:place-items-center sm:rounded-[14px] sm:bg-[var(--card)] sm:shadow-[0_0_0_1px_var(--line)]">
                    <Icon size={24} />
                  </span>
                  <div>
                    <dt className="text-[15px] font-extrabold sm:text-[17px]">{t}</dt>
                    <dd className="mt-0.5 text-sm leading-normal text-[var(--muted)] sm:mt-1 sm:text-[15px] sm:leading-[1.55]">{d}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          id="faq"
          className="mx-auto grid max-w-[1280px] scroll-mt-20 gap-4 px-4 pt-10 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.5fr] md:gap-20 lg:px-12 lg:py-28"
        >
          <div className="mx-1 md:sticky md:top-28 md:mx-0 md:self-start">
            <p className={`reveal ${eyebrow}`}>FAQ</p>
            <h2 className={`reveal mt-2 sm:mt-3 ${h2}`}>Questions</h2>
            <p className="reveal mt-4 hidden max-w-[32ch] leading-relaxed text-[var(--muted)] md:block">
              Can&apos;t find your answer? The AI assistant knows the customs rules for your route.
            </p>
            <AskLink className="hidden md:inline-flex" />
          </div>
          <div className="reveal divide-y divide-[var(--line)] rounded-[18px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line)] sm:rounded-[20px]">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-[18px] py-4 text-[15px] font-extrabold transition-colors hover:text-[var(--primary)] group-open:text-[var(--primary)] sm:px-6 sm:py-[22px] sm:text-[17px] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <CaretDown size={18} weight="bold" className="flex-none transition group-open:rotate-180" />
                </summary>
                <p className="faq-answer -mt-2 max-w-[60ch] px-[18px] pb-4 text-sm leading-[1.55] text-[var(--muted)] sm:-mt-3 sm:px-6 sm:pb-[22px] sm:text-[15px] sm:leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
          <div className="mx-1 md:hidden">
            <p className="text-sm leading-[1.55] text-[var(--muted)]">
              Can&apos;t find your answer? The AI assistant knows the customs rules for your route.
            </p>
            <AskLink />
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-3 py-8 sm:px-6 sm:pb-24 sm:pt-0 lg:px-12">
          <div className="reveal flex flex-col items-stretch justify-between gap-5 rounded-[22px] bg-[var(--primary)] px-[22px] py-7 text-white sm:flex-row sm:items-center sm:gap-8 sm:rounded-[28px] sm:p-12">
            <div>
              <h2 className="text-[26px] font-extrabold tracking-[-0.02em] sm:text-4xl">Plan your move tonight</h2>
              <p className="mt-1.5 text-[15px] text-[#e3eefa] sm:mt-2 sm:text-[17px]">
                Start with your route. Scan your rooms whenever you are ready.
              </p>
            </div>
            <a
              href="#start"
              className="group flex h-[52px] flex-none items-center justify-between gap-2.5 rounded-[14px] bg-white px-5 text-base font-extrabold text-[var(--primary)] transition hover:bg-[var(--primary-50)] sm:h-14 sm:px-6"
            >
              Get started <ArrowRight size={18} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto grid max-w-[1280px] gap-3.5 px-5 pb-9 pt-7 sm:px-6 md:grid-cols-[1fr_auto] md:items-start md:gap-8 md:py-12 lg:px-12">
          <div>
            <Logo className="text-lg sm:text-xl" />
            <p className="mt-2.5 max-w-[60ch] text-xs leading-relaxed text-[var(--muted)] sm:mt-3 sm:text-[13px]">
              Sizes are AI estimates. Customs summaries are based on the FIDI Customs Guides and are for information only. We
              are not affiliated with FIDI and are not FAIM certified.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm font-semibold sm:gap-x-6">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="flex min-h-11 items-center text-[var(--muted)] transition hover:text-[var(--ink)] md:min-h-0"
              >
                {n.label}
              </a>
            ))}
            <Link
              href="/chat"
              className="flex min-h-11 items-center font-extrabold text-[var(--primary)] transition hover:text-[var(--primary-press)] md:min-h-0"
            >
              Talk to AI
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function AskLink({ className = "inline-flex" }: { className?: string }) {
  return (
    <Link
      href="/chat"
      className={`group mt-1 min-h-11 items-center gap-2 text-[15px] font-extrabold text-[var(--primary)] transition hover:text-[var(--primary-press)] md:mt-4 ${className}`}
    >
      <Sparkle size={16} weight="fill" /> Ask the AI assistant
      <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function Tile({ icon, title, tinted, children }: { icon: ReactNode; title: string; tinted?: boolean; children: ReactNode }) {
  return (
    <div className="reveal group flex flex-col justify-between gap-5 rounded-[20px] bg-[var(--card)] p-[18px] shadow-[0_0_0_1px_var(--line)] transition hover:shadow-[0_0_0_1.5px_var(--primary),0_20px_40px_-24px_rgb(10_70_150/0.4)] sm:min-h-[220px] sm:gap-8 sm:rounded-3xl sm:p-8 md:col-span-2">
      <span
        className={`w-fit text-[var(--primary)] transition duration-300 group-hover:-translate-y-0.5 ${
          tinted ? "sm:grid sm:h-[52px] sm:w-[52px] sm:place-items-center sm:rounded-[14px] sm:bg-[var(--primary-50)]" : ""
        }`}
      >
        {icon}
      </span>
      <div>
        <h3 className="text-[15px] font-extrabold sm:text-xl">{title}</h3>
        <p className="mt-1 text-[13px] leading-normal text-[var(--muted)] sm:mt-2 sm:text-[15px] sm:leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
