import { AirplaneTilt, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Logo from "@/components/Logo";

/** A route that went nowhere: SIN → 404. */
function LostRoute({ big }: { big?: boolean }) {
  const code = `font-extrabold tracking-[-0.03em] ${big ? "text-[44px]" : "text-[30px]"}`;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-[18px]">
      <span className={code}>SIN</span>
      <span className="flex items-center gap-1.5 sm:gap-2">
        <span className="flex-1 border-t-2 border-dashed border-[#c9d5e8]" />
        <AirplaneTilt size={big ? 22 : 18} weight="fill" className="rotate-45 text-[var(--bad)]" aria-hidden />
        <span className="flex-1 border-t-2 border-dashed border-[#c9d5e8]" />
      </span>
      <span className={`${code} text-[#c9d5e8]`}>404</span>
    </div>
  );
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 sm:h-[72px] sm:border-b sm:border-[var(--line)] sm:bg-[var(--card)] sm:p-0">
        <div className="mx-auto flex h-full max-w-[1280px] items-center sm:px-6 lg:px-12">
          <Link href="/" className="flex min-h-11 items-center">
            <Logo className="text-lg sm:text-xl" />
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1280px] flex-1 content-center gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[1fr_520px] lg:items-center lg:gap-20 lg:px-12">
        <div className="order-2 lg:order-1">
          <p className="text-[13px] font-extrabold tracking-[0.12em] text-[var(--primary)] sm:text-sm">ERROR 404</p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:mt-3 sm:text-[56px] sm:leading-[1.05] sm:tracking-[-0.035em]">
            This page doesn&apos;t exist
          </h1>
          <p className="mt-3 max-w-[44ch] text-base leading-[1.55] text-[var(--muted)] sm:mt-4 sm:text-lg sm:leading-relaxed">
            The link may be old or mistyped. Start again from the home page.
          </p>
          <Link
            href="/"
            className="btn-primary mt-7 flex h-14 items-center gap-2.5 rounded-[14px] px-5 text-base font-extrabold transition sm:mt-8 sm:inline-flex sm:px-6"
          >
            <ArrowLeft size={18} weight="bold" /> Back to the start
          </Link>
        </div>
        <div className="order-1 rounded-[20px] bg-[var(--card)] p-5 shadow-[0_0_0_1px_var(--line)] lg:order-2 lg:rounded-3xl lg:p-7 lg:shadow-[0_0_0_1px_var(--line),0_30px_60px_-36px_rgb(10_70_150/0.45)]">
          <div className="hidden justify-between text-[11px] font-extrabold tracking-[0.1em] text-[var(--muted)] lg:flex">
            <span>ROUTE</span>
            <span>STATUS</span>
          </div>
          <div className="lg:mt-3.5">
            <div className="lg:hidden">
              <LostRoute />
            </div>
            <div className="hidden lg:block">
              <LostRoute big />
            </div>
          </div>
          <div className="mt-5 hidden items-center justify-between border-t-2 border-dashed border-[var(--line)] pt-4 lg:flex">
            <span className="text-sm font-bold text-[var(--muted)]">Destination</span>
            <span className="flex h-7 items-center rounded-[7px] bg-[var(--bad-bg)] px-2.5 text-xs font-extrabold text-[var(--bad)]">
              Not found
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
