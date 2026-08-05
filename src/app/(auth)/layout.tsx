export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper-dim bg-grid px-5 py-14 font-sans text-ink">
      {/* Soft blue wash behind the card, top-centre */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(47,105,255,0.16)_0%,transparent_65%)]"
      />
      {/* The grid fades out toward the bottom of the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-paper-dim"
      />

      <ShipmentCard
        className="absolute left-[6%] top-[18%] hidden w-[210px] animate-float1 xl:block"
        id="FRT-002847"
        route="Baku, AZ → Istanbul, TR"
        mode="Road · FTL"
        incoterm="DAP"
        status="In transit"
        dot="bg-dot-progress"
      />
      <ShipmentCard
        className="absolute bottom-[16%] right-[6%] hidden w-[210px] animate-float2 xl:block"
        id="FRT-002851"
        route="Poti, GE → Tbilisi, GE"
        mode="Rail"
        incoterm="CIP"
        status="Delivered"
        dot="bg-dot-done"
      />

      <div className="relative w-full max-w-[26rem]">
        {/* Lockup */}
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <BrandMark />
          <span className="font-display text-[19px] font-medium tracking-[-0.03em] text-brand-deep">
            Freight<span className="text-brand">Ops</span>
          </span>
        </div>

        <div className="mb-6 text-center">
          <span className="eyebrow mb-3">Operations desk</span>
          <h1 className="font-display text-[32px] font-medium leading-[1.08] tracking-[-0.035em] text-brand-deep">
            Every shipment,
            <br />
            accounted for
          </h1>
          <p className="mx-auto mt-3 max-w-[22rem] text-[14px] leading-relaxed text-ink-soft">
            Waybills, customs clearances and carrier ledgers, kept in one
            record.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-[20px] border border-edge-soft bg-surface-card p-7 shadow-[0_1px_1px_rgba(0,0,0,0.04),0_18px_44px_-24px_rgba(0,0,0,0.18)]">
          {children}
        </div>

        <p className="mt-6 text-center text-[11.5px] text-ink-soft/80">
          Freight forwarding operations
        </p>
      </div>
    </div>
  );
}

/** A shipment record, floated behind the form as ambient product detail. */
function ShipmentCard({
  className = "",
  id,
  route,
  mode,
  incoterm,
  status,
  dot,
}: {
  className?: string;
  id: string;
  route: string;
  mode: string;
  incoterm: string;
  status: string;
  dot: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[16px] border border-edge-soft bg-surface-card p-4 shadow-[0_1px_1px_rgba(0,0,0,0.04),0_18px_44px_-26px_rgba(0,0,0,0.22)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12.5px] text-brand">{id}</span>
        <span className="rounded-full bg-surface-chip-active px-2 py-0.5 text-[10px] font-medium text-brand">
          {incoterm}
        </span>
      </div>
      <div className="mt-2.5 text-[12.5px] font-medium text-brand-deep">
        {route}
      </div>
      <div className="mt-0.5 text-[11.5px] text-ink-soft">{mode}</div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-edge-soft pt-2.5 text-[11px] text-ink-soft">
        <span className={`h-[6px] w-[6px] rounded-full ${dot}`} />
        {status}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white shadow-[inset_0_0_20px_rgba(142,174,255,0.55),0_1px_2px_rgba(0,46,164,0.2)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    </span>
  );
}
