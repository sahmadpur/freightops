/**
 * The rail's icon set — hand-drawn 24px strokes rather than an icon package,
 * because ten glyphs is not worth a dependency. Every path is a stroke on
 * `currentColor` at 1.75, so an icon inherits whatever colour the nav item is
 * wearing: mint on the active ink pill, grey everywhere else.
 */
const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  requests: (
    <>
      <path d="M5 3.5h9l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 20.5v-15A2 2 0 0 1 6 3.5Z" />
      <path d="M14 3.5v5h5M8.5 13.5h7M8.5 17h4.5" />
    </>
  ),
  orders: (
    <>
      <path d="M2.5 15.5V8a1 1 0 0 1 1-1h9.5v8.5" />
      <path d="M13 10h3.8a1 1 0 0 1 .82.43L20.5 14.5v1h-7.5" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
      <path d="M9 17.5h6" />
    </>
  ),
  accounts: (
    <>
      <path d="M3.5 20.5v-2.2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2.2" />
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M16.5 14.6a4 4 0 0 1 4 4v1.9M15.5 4.3a3.5 3.5 0 0 1 0 6.5" />
    </>
  ),
  carriers: (
    <>
      <path d="M3.5 6.5h9v11h-9z" />
      <path d="M12.5 10h4l4 3.5v4h-8z" />
      <circle cx="7" cy="19.5" r="1.8" />
      <circle cx="16.5" cy="19.5" r="1.8" />
    </>
  ),
  customs: (
    <>
      <path d="M12 2.8 4 6v6c0 4.6 3.3 8.3 8 9.2 4.7-.9 8-4.6 8-9.2V6Z" />
      <path d="M9 12.2l2.2 2.2 4-4.4" />
    </>
  ),
  finance: (
    <>
      <path d="M3.5 19.5V9M9 19.5V4.5M14.5 19.5v-7M20 19.5V7" />
    </>
  ),
  documents: (
    <>
      <path d="M6 2.8h7l5 5v13.4H6Z" />
      <path d="M13 2.8v5h5M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  audit: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M11 7.5V11l2.5 2M16.2 16.2 21 21" />
    </>
  ),
  cargoTypes: (
    <>
      <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7Z" />
      <path d="M3.5 7 12 11.2 20.5 7M12 11.2v10" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-[17px] w-[17px] shrink-0 ${className}`}
    >
      {path}
    </svg>
  );
}
