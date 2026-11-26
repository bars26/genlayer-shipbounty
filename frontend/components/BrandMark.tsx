/** ShipBounty mark: an app tile with a check, lifting off like a paper plane, on a navy tile. */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="ShipBounty">
      <rect width="32" height="32" rx="9" fill="#0F1B2D" />
      <rect x="7" y="9" width="14" height="14" rx="4" fill="#0A84FF" />
      <path d="M10.5 16.2l2.4 2.4 4.6-4.8" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 12.5L26 6.5l-2.2 9.2-2.9-2.1-1.4 2.6-.5-3.7z" fill="#F3F6FA" />
      <circle cx="24.8" cy="24.6" r="3.6" fill="#2E7D4F" stroke="#0F1B2D" strokeWidth="1" />
      <path d="M23.3 24.7l1 1 1.9-2" fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
