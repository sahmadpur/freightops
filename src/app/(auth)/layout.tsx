export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      {/* Atmospheric blur orbs — layered indigo/violet depth behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-violet-300/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-200/30 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Brand lockup above the card */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_0_24px_rgba(79,70,229,0.45)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" />
              <path d="M3 7.5 12 12l9-4.5M12 12v9" />
            </svg>
          </span>
          <span className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">
            Freight<span className="text-gradient">Ops</span>
          </span>
        </div>

        {/* Elevated card with a whisper of isometric lift */}
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-soft-lg">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Freight forwarding operations platform
        </p>
      </div>
    </div>
  );
}
