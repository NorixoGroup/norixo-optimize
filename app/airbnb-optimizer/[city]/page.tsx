import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cities, getCityBySlug } from "@/data/cities";
import { buildCitySchema } from "@/lib/seo/buildCitySchema";
import { buildCityMetadata } from "@/lib/seo/buildCityMetadata";

type PageProps = {
  params: {
    city: string;
  };
};

export function generateStaticParams() {
  return cities.map((city) => ({
    city: city.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = getCityBySlug(params.city);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  if (!city) {
    return {
      title: "Airbnb Listing Optimization Guide",
      description:
        "Improve your Airbnb listing performance with actionable optimization insights.",
    };
  }

  return buildCityMetadata({
    city: {
      slug: city.slug,
      name: city.name,
      country: city.country,
    },
    baseUrl,
  }) as Metadata;
}

export default function CityOptimizerPage({ params }: PageProps) {
  const city = getCityBySlug(params.city);

  if (!city) {
    notFound();
  }

  const { name, country, avgPrice, avgRating, avgPhotos } = city!;

   const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
   const schema = buildCitySchema({
     city: {
       slug: city.slug,
       name: city.name,
       country: city.country,
     },
     baseUrl,
   });

  return (
    <main className="nk-section space-y-14 md:space-y-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Hero */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-kicker-muted">Airbnb optimization guide · {country}</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          How to Optimize Your Airbnb Listing in {name}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-700">
          Stand out in the {name} market with a listing that converts views into bookings.
          This guide shows you how guests browse in {name}, what they expect to see, and
          which changes have the biggest impact on your occupancy.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/analyze"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Analyze your listing
          </Link>
          <p className="text-xs leading-5 text-slate-500">
            Paste your listing URL and get a conversion-focused audit in minutes.
          </p>
        </div>
      </section>

      {/* Market snapshot */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover p-6">
          <p className="nk-section-title">{name} market snapshot</p>
          <p className="mt-2 text-[15px] leading-7 text-slate-700">
            {name} is a competitive short-term rental market. Guests compare dozens of
            similar listings before booking, so your photos, description and amenities need
            to clearly justify your nightly rate.
          </p>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>
              • Many guests stay for weekends and short city breaks, quickly comparing
              several neighborhoods and price points.
            </li>
            <li>
              • High-quality photos and clear descriptions are essential to stand out from
              similarly priced homes.
            </li>
            <li>
              • Amenities like Wi‑Fi, workspace and climate control are increasingly
              non‑negotiable for modern travelers.
            </li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover grid gap-3 p-5 text-sm text-slate-800 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Avg. nightly price
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              €{avgPrice.toFixed(0)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Typical pricing for well-positioned listings in {name}.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Avg. guest rating
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {avgRating.toFixed(1)}<span className="text-sm text-emerald-500"> / 5</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Highly rated stays are now the norm – not the exception.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Avg. photos per listing
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {avgPhotos}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              You need a strong first 5 photos to win the click.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Key takeaway
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Small improvements in photos, copy and amenities can move you above the
              average listing in {name} and unlock more bookings.
            </p>
          </div>
        </div>
      </section>

      {/* Optimization tips */}
      <section className="nk-card nk-card-hover p-6">
        <p className="nk-section-title">Optimization tips for {name}</p>
        <div className="mt-3 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Lead with your strongest view</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              In {name}, guests care a lot about light, outdoor space and neighborhood
              atmosphere. Make sure your first photo showcases the best angle or view of
              your place.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Write a city-aware opening</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Your first 2–3 lines should clearly state who the listing is for and why it is
              ideal for visiting {name} (weekend break, work trip, family stay, etc.).
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Match amenities to expectations</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Look at top-performing listings in {name} and make sure your amenity list
              covers the essentials guests expect at your price point.
            </p>
          </div>
        </div>
      </section>

      {/* Example audit */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover p-6">
          <p className="nk-section-title">Example audit for a {name} listing</p>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            When you run an audit for a listing in {name}, you&apos;ll get a structured report
            that scores your listing, highlights weaknesses and shows how much improvement is
            possible.
          </p>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>• Overall conversion score out of 10 with category breakdowns.</li>
            <li>• Listing Quality Index (0–100) that captures quality and competitiveness.</li>
            <li>• Recommended photo order tailored to {name}-style browsing behavior.</li>
            <li>• Copy tweaks that reinforce trust and clarity for international guests.</li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover space-y-3 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sample results
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {name} · 1BR apartment
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Mock audit
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Conversion score
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                6.3<span className="text-sm text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Below top {name} competitors.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Listing Quality Index
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                74<span className="text-sm text-slate-500"> / 100</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">Competitive, with clear upside.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Top recommendations
            </p>
            <ul className="mt-3 space-y-1.5 text-[12px] leading-5 text-slate-800">
              <li>• Highlight proximity to key {name} landmarks in first paragraph.</li>
              <li>• Swap in brighter living-room photo as the cover image.</li>
              <li>• Add missing amenities that guests filter for in this area.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">
            Ready to see how your {name} listing scores?
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Run a free audit, get your conversion score and Listing Quality Index, and see
            exactly which changes to make first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/analyze"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Analyze your listing
          </Link>
        </div>
      </section>
    </main>
  );
}
