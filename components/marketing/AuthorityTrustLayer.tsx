import { SectionDescription, SectionLabel, SectionTitle } from "@/components/ui";
import type { AuthorityTrustCopy } from "@/data/marketing/authorityTrustI18n";

type AuthorityTrustLayerProps = Readonly<{
  copy: AuthorityTrustCopy;
  isRtl?: boolean;
}>;

export function AuthorityTrustLayer({
  copy,
  isRtl = false,
}: AuthorityTrustLayerProps) {
  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] px-5 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:p-7"
    >
      <SectionLabel className="text-slate-500">{copy.eyebrow}</SectionLabel>
      <SectionTitle className="mt-2 max-w-3xl text-[20px] text-slate-950 md:text-[24px]">
        {copy.title}
      </SectionTitle>
      <SectionDescription className="mt-2 max-w-3xl text-[14px] leading-7 text-slate-600">
        {copy.intro}
      </SectionDescription>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {copy.pillars.map((pillar, index) => (
          <div
            key={pillar.title}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
          >
            <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-950 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              {String(index + 1).padStart(2, "0")}
            </div>
            <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
              {pillar.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pillar.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/80 p-4 shadow-[0_10px_24px_rgba(16,185,129,0.10)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {copy.privacyTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {copy.privacyText}
          </p>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            {copy.limitsTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {copy.limitsText}
          </p>
        </div>
      </div>
    </section>
  );
}
