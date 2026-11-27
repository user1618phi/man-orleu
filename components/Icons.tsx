type P = { size?: number; className?: string };

export const IconCheck = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconCross = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
export const IconBang = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M12 5v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle cx="12" cy="19" r="1.8" fill="currentColor" />
  </svg>
);
export const IconBulb = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
export const IconCloud = ({ size = 22, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.5A3.3 3.3 0 007 18z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M9.5 13.5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconArrow = ({ size = 20, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Round badge with an icon, used in feedback sheets and step lists. */
export function Badge({ tone, children, size = 32 }: { tone: "ok" | "bad" | "mark" | "primary"; children: React.ReactNode; size?: number }) {
  const bg = { ok: "bg-ok", bad: "bg-bad", mark: "bg-mark", primary: "bg-primary" }[tone];
  const fg = tone === "mark" ? "text-text" : "text-white";
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full ${bg} ${fg}`} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}
