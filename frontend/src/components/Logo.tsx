export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-on-pine/10" />
      <path
        d="M9 12.5 16 8l7 4.5v8.2L16 25l-7-4.3z"
        fill="none"
        stroke="#D9EBDF"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 12.5 16 17l7-4.5M16 17v8" fill="none" stroke="#C9A35A" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
