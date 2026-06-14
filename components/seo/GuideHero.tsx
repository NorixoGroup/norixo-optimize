import Link from "next/link";

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
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
        {eyebrow}
      </p>

      <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
        {title}
      </h1>

      <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
        {subtitle}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={primaryCtaHref}
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
