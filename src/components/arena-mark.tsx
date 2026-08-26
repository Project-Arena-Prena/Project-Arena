import { useId } from 'react';

export function ArenaMark({ className }: { className?: string }) {
  const gradientId = useId().replaceAll(':', '');

  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="4" y1="5" x2="29" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F16001" />
          <stop offset="0.55" stopColor="#E85002" />
          <stop offset="1" stopColor="#C10801" />
        </linearGradient>
      </defs>
      <path d="M4 5H21.5L27 12H13V36H27L21.5 43H4V5Z" fill={`url(#${gradientId})`} />
      <path d="M44 5H29.5L24 12H35V36H24L29.5 43H44V5Z" fill="#F9F9F9" />
      <path d="M21 21H27V27H21V21Z" fill="#E85002" />
    </svg>
  );
}
