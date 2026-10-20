/** Moversly wordmark: the name in brand blue with a teal full stop, as in the client's design. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`text-xl font-extrabold tracking-tight text-[var(--primary)] ${className}`}>
      MOVERSLY<span className="text-[var(--logo-dot)]">.</span>
    </span>
  );
}
