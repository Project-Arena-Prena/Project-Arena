export function ArenaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden focusable="false">
      <path
        d="M32 5 60 57H47.5L32 25.5 16.5 57H4L32 5Z"
        fill="currentColor"
        fillOpacity="0.92"
      />
      <path
        d="M32 22.5l2.6 7.4 7.4 2.6-7.4 2.6L32 42.5l-2.6-7.4-7.4-2.6 7.4-2.6L32 22.5Z"
        fill="currentColor"
      />
      <path
        d="M9 40.5C9 47.4 19.3 53 32 53s23-5.6 23-12.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
