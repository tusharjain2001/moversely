import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="w-fit">
        <Logo />
      </Link>
      <p className="mt-12 font-mono text-sm font-semibold text-[var(--primary)]">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-[var(--muted)]">The link may be old or mistyped. Start again from the home page.</p>
      <Link
        href="/"
        className="btn-primary mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 font-semibold text-[var(--on-primary)]"
      >
        <ArrowLeft size={18} weight="bold" /> Back to the start
      </Link>
    </main>
  );
}
