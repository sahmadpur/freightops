export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper font-sans text-ink md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <HeroPanel />

      {/* Form panel — paper with a faint grain */}
      <div className="relative flex items-center justify-center bg-paper bg-grain-light bg-blend-multiply px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Compact lockup (carries the brand on mobile, where the hero is hidden) */}
          <div className="mb-8 flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[17px] font-semibold tracking-tight text-brand-deep">
              Freight
              <sup className="ml-0.5 align-super font-mono text-[10px] text-brand-chip">
                Ops
              </sup>
            </span>
          </div>
          {children}
          <p className="mt-8 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-soft/70">
            Freight forwarding operations
          </p>
        </div>
      </div>
    </div>
  );
}

/** Deep-green editorial column with floating waybill cards. Hidden on mobile. */
function HeroPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-deep px-12 py-14 text-paper md:flex md:flex-col md:justify-between">
      {/* warm glow from upper-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,#0e3e6e_0%,transparent_65%)] opacity-55"
      />
      {/* grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-grain opacity-[0.16] mix-blend-screen"
      />
      {/* ledger margin rule down the right edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-10 w-px bg-brand-accent/20"
      />
      {/* thin horizontal rule near the top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-12 top-[88px] h-px bg-paper/10"
      />

      {/* brand strip */}
      <div className="relative flex items-center gap-2.5">
        <BrandMark accent />
        <span className="text-[17px] font-semibold tracking-tight text-paper">
          Freight
          <sup className="ml-0.5 align-super font-mono text-[10px] text-brand-accent">
            Ops
          </sup>
        </span>
      </div>

      {/* headline + footer, anchored to the bottom of the panel */}
      <div className="relative mt-auto">
        <div className="max-w-md">
          <h2 className="font-display text-[44px] font-light leading-[0.98] tracking-[-0.01em] lg:text-[56px]">
            Every shipment,
            <br />
            <span className="italic text-brand-light">filed and</span>
            <br />
            accounted for.
          </h2>
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-brand-light/90">
            The operations desk for freight forwarders — waybills, customs
            clearances and carrier ledgers, kept in one orderly record.
          </p>
        </div>

        {/* footer meta row */}
        <div className="mt-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em]">
          <span className="text-brand-accent">Consignment Ledger</span>
          <span className="text-paper/40">N° 01</span>
        </div>
      </div>

      {/* floating waybill cards — stacked in the upper zone, clear of the headline */}
      <WaybillCard
        className="absolute right-10 top-14 w-[224px] animate-float1"
        id="FRT-002847"
        origin="Baku, AZ"
        dest="Istanbul, TR"
        mode="Road · FTL"
        incoterm="DAP"
        stamped
      />
      <WaybillCard
        className="absolute right-24 top-[232px] hidden w-[206px] animate-float2 lg:block"
        id="FRT-002851"
        origin="Poti, GE"
        dest="Tbilisi, GE"
        mode="Rail"
        incoterm="CIP"
      />
    </div>
  );
}

/** A tilted "library card" reimagined as a freight waybill. */
function WaybillCard({
  className = "",
  id,
  origin,
  dest,
  mode,
  incoterm,
  stamped = false,
}: {
  className?: string;
  id: string;
  origin: string;
  dest: string;
  mode: string;
  incoterm: string;
  stamped?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-paper p-4 text-ink shadow-[0_22px_44px_-18px_rgba(0,0,0,0.45)] ring-1 ring-paper-edge ${className}`}
    >
      {/* tick-mark corners */}
      <Ticks />
      {/* perforation row */}
      <div className="mb-3 flex justify-between">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="h-[3px] w-[3px] rounded-full bg-ink opacity-40"
          />
        ))}
      </div>

      {/* header */}
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
        <span>Waybill · 2026</span>
        <span className="rounded-[2px] border border-ink/20 px-1 py-px text-[8px]">
          {incoterm}
        </span>
      </div>
      <div className="mt-1 font-mono text-[15px] tracking-[0.02em] text-brand-deep">
        {id}
      </div>

      {/* metadata */}
      <dl className="mt-3 space-y-1.5 font-mono text-[10.5px]">
        <Row k="Origin" v={origin} />
        <Row k="Destination" v={dest} />
        <Row k="Mode" v={mode} />
      </dl>

      {/* footer status */}
      <div className="mt-3 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
        <span className="h-[6px] w-[6px] rounded-full bg-dot-done" />
        Manifested
      </div>

      {stamped && (
        <span className="absolute -right-2 bottom-6 rotate-[14deg] animate-stamp rounded-[2px] border-[1.5px] border-red-700/80 bg-paper/60 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-red-700/85 backdrop-blur-[1px]">
          Cleared ’26
        </span>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-ink/15 pb-1">
      <dt className="uppercase tracking-[0.1em] text-ink-soft">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

function Ticks() {
  const marks = [
    "left-0 top-0 w-3 h-px",
    "left-0 top-0 w-px h-3",
    "right-0 top-0 w-3 h-px",
    "right-0 top-0 w-px h-3",
    "left-0 bottom-0 w-3 h-px",
    "left-0 bottom-0 w-px h-3",
    "right-0 bottom-0 w-3 h-px",
    "right-0 bottom-0 w-px h-3",
  ];
  return (
    <>
      {marks.map((m) => (
        <span key={m} className={`absolute bg-ink/40 ${m}`} />
      ))}
    </>
  );
}

function BrandMark({ accent = false }: { accent?: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-[5px] ${
        accent ? "bg-brand-accent text-brand-deep" : "bg-brand text-brand-pale"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    </span>
  );
}
