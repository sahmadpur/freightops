import Image from "next/image";

/**
 * The sign-in surface. One column, one hairline card, one enormous Manrope
 * headline — the same flat language as the workspace behind it, so signing in
 * does not feel like a different product from the desk it opens.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-[72rem] grid-cols-1 items-center gap-14 bg-surface px-6 py-16 font-sans text-ink lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-20 lg:px-10">
      {/* The thesis column: who this is for, in the largest type in the app. */}
      <div>
        <div className="mb-10 flex items-center gap-3">
          <Image
            src="/all-in-logo.png"
            alt=""
            width={34}
            height={32}
            priority
            className="h-auto w-[34px]"
          />
          <span className="font-display text-[19px] font-extrabold leading-none tracking-[-0.04em] text-brand-deep">
            All In <span className="font-medium text-ink-soft">Logistics</span>
          </span>
        </div>

        <span className="eyebrow">Operations desk</span>
        <h1 className="mt-5 font-display text-[clamp(40px,6vw,68px)] font-extrabold leading-[0.95] tracking-[-0.045em] text-brand-deep">
          Every shipment,
          <br />
          accounted for
        </h1>
        <p className="mt-5 max-w-[26rem] text-[15px] leading-relaxed text-ink-soft">
          Waybills, customs clearances and carrier ledgers, kept in one record.
        </p>
      </div>

      <div className="w-full">
        <div className="rounded-card border border-edge-chip bg-surface-card p-7">
          {children}
        </div>
        <p className="mt-6 text-[11px] text-ink-faint">
          Freight forwarding operations
        </p>
      </div>
    </div>
  );
}
