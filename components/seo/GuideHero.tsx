import Link from "next/link";
import { makeGuideClaimSafe } from "@/lib/seo/guideClaimSafety";

type GuideHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
};

export function GuideHero({
  eyebrow,
  title,
  subtitle,
  primaryCtaHref = "/analyze",
  primaryCtaLabel = "Audit my Airbnb listing",
  secondaryCtaHref = "/guides",
  secondaryCtaLabel = "Explore guides",
}: GuideHeroProps) {
  const safePrimaryCtaHref = primaryCtaHref === "/analyze" ? "/free-audit" : primaryCtaHref;

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
        {eyebrow}
      </p>

      <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
        {makeGuideClaimSafe(title)}
      </h1>

      <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
        {makeGuideClaimSafe(subtitle)}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={safePrimaryCtaHref}
          className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
        >
          {primaryCtaLabel}
        </Link>

        <Link
          href={secondaryCtaHref}
          className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
        >
          {secondaryCtaLabel}
        </Link>
      </div>
    </section>
  );
}
