/** Moversly wordmark: the name in brand blue with a teal full stop, as in the client's design. */
export default function Logo({ className = "", onPrimary = false }: { className?: string; onPrimary?: boolean }) {
  return (
    <span
      className={`font-extrabold tracking-[-0.02em] ${onPrimary ? "text-white" : "text-[var(--primary)]"} ${className || "text-xl"}`}
    >
      MOVERSLY<span className={onPrimary ? "text-[#5eead4]" : "text-[var(--logo-dot)]"}>.</span>
    </span>
  );
}
