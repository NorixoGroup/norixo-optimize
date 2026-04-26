import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cities, getCityBySlug, type City } from "@/data/cities";
import { buildCitySchema } from "@/lib/seo/buildCitySchema";
import { buildCityMetadata } from "@/lib/seo/buildCityMetadata";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo-optimize.vercel.app"
).replace(/\/$/, "");

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
  const baseUrl = publicSiteUrl;

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

/** Copy helpers — only use fields present on `City` (no invented stats). */
function pricingContextLine(c: City): string {
  if (c.avgPrice >= 175) {
    return `Typical well-positioned listings in ${c.name} cluster around €${c.avgPrice.toFixed(0)} per night—guests compare value carefully at this level.`;
  }
  if (c.avgPrice <= 140) {
    return `With typical nightly prices near €${c.avgPrice.toFixed(0)} in ${c.name}, small upgrades in presentation can still shift which listing wins the booking.`;
  }
  return `At roughly €${c.avgPrice.toFixed(0)} per night on average for strong listings in ${c.name}, clarity on value and positioning matters as much as the rate itself.`;
}

function photoMarketLine(c: City): string {
  if (c.avgPhotos >= 24) {
    return `Strong listings in ${c.name} average about ${c.avgPhotos} photos—guests are used to scrolling a full gallery before they shortlist.`;
  }
  if (c.avgPhotos <= 21) {
    return `With around ${c.avgPhotos} photos typical for competitive listings in ${c.name}, each image must work harder to build trust and context.`;
  }
  return `Listings near ${c.avgPhotos} photos on average in ${c.name} still need a deliberate order: lead with proof of space, light, and location.`;
}

function ratingPressureLine(c: City): string {
  if (c.avgRating >= 4.75) {
    return `Guest ratings in ${c.name} often sit around ${c.avgRating.toFixed(1)}/5 for top performers—new reviews and visible quality signals weigh heavily.`;
  }
  return `With many stays clustering near ${c.avgRating.toFixed(1)}/5 in ${c.name}, ${c.country}, hosts benefit from listings that read as polished and complete before the first message.`;
}

/** Rotating, deterministic picks so related hubs vary by city as the roster grows (max 4). */
function relatedHubCitiesFor(currentSlug: string, limit = 4): City[] {
  const others = cities.filter((c) => c.slug !== currentSlug);
  if (others.length <= limit) {
    return others;
  }
  let h = 0;
  for (let i = 0; i < currentSlug.length; i++) {
    h = (h * 31 + currentSlug.charCodeAt(i)) >>> 0;
  }
  const start = h % others.length;
  const out: City[] = [];
  for (let i = 0; i < limit; i++) {
    out.push(others[(start + i) % others.length]);
  }
  return out;
}

export default function CityOptimizerPage({ params }: PageProps) {
  const city = getCityBySlug(params.city);

  if (!city) {
    notFound();
  }

  const {
    name,
    country,
    avgPrice,
    avgRating,
    avgPhotos,
    marketAngle,
    competitionAngle,
    pricingAngle,
    guestExpectationAngle,
  } = city;

  const baseUrl = publicSiteUrl;
  const relatedHubCities = relatedHubCitiesFor(city.slug, 4);
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
          Stand out in the {name} market with a listing that converts views into bookings.{" "}
          {marketAngle} This guide shows how guests browse in {name}, what they expect to see,
          and which changes move occupancy first.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/audit/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run your listing audit
          </Link>
          <p className="text-xs leading-5 text-slate-500">
            Norixo Optimize scores your listing and surfaces prioritized actions—paste your URL
            to start.
          </p>
        </div>
      </section>

      {/* Market snapshot */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-labelledby="market-snapshot-heading">
        <div className="nk-card nk-card-hover p-6">
          <h2 id="market-snapshot-heading" className="nk-section-title">
            {name} market snapshot
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-700">
            {name} is a competitive short-term rental market in {country}. {competitionAngle}{" "}
            Your photos, description, and amenities still need to justify your nightly rate against
            what guests see in search.
          </p>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>
              • Competitive stays in {name} often sit near {avgRating.toFixed(1)}/5—gaps in
              polish or clarity are easy for guests to spot when they scroll.
            </li>
            <li>
              • Listings with roughly {avgPhotos} photos set the visual bar; a thin gallery
              makes even fair pricing feel risky.
            </li>
            <li>
              • At about €{avgPrice.toFixed(0)} per night on average for strong listings, guests
              weigh every detail before they commit.
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

      {/* SEO pillars — city-grounded copy */}
      <section className="nk-card nk-card-hover p-6 md:p-8" aria-labelledby="seo-pillars-heading">
        <h2 id="seo-pillars-heading" className="nk-section-title">
          What hosts in {name} should prioritize
        </h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-700">
          Optimization is not generic advice. {competitionAngle} In {name}, it means aligning how
          you present your home with how guests already shop—using the same signals they see beside
          your listing in search.
        </p>
        <div className="mt-6 grid gap-6 text-sm text-slate-800 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Why Airbnb optimization matters in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {guestExpectationAngle} Travelers choosing {name} skim dozens of listings; the winner
              is rarely the cheapest alone—it is the one that looks trustworthy, complete, and easy
              to understand in seconds.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pricing strategy in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {pricingAngle} {pricingContextLine(city)} Use your calendar and comps to stay
              coherent: if your presentation lags peers near €{avgPrice.toFixed(0)}, guests assume
              the gap is justified—or they book elsewhere.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Photos and listing quality in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {photoMarketLine(city)} Re-order for clarity, add captions where they remove
              doubt, and make sure your cover image matches what {name} guests filter for.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              How to increase bookings in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {ratingPressureLine(city)} Pair visible polish with a description that answers
              “who this is for” in {name}—families, remote workers, weekend explorers—so the
              right guests stop comparing and start booking.
            </p>
          </div>
        </div>
      </section>

      {/* Optimization tips */}
      <section className="nk-card nk-card-hover p-6" aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="nk-section-title">
          Optimization tips for {name}
        </h2>
        <div className="mt-3 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Lead with your strongest view</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              In {name}, guests care a lot about light, outdoor space and neighborhood
              atmosphere. Make sure your first photo showcases the best angle or view of
              your place.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Write a city-aware opening</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Your first 2–3 lines should clearly state who the listing is for and why it is
              ideal for visiting {name} (weekend break, work trip, family stay, etc.).
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Match amenities to expectations</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Look at top-performing listings in {name} and make sure your amenity list
              covers the essentials guests expect at your price point.
            </p>
          </div>
        </div>
      </section>

      {/* Example audit */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-labelledby="example-audit-heading">
        <div className="nk-card nk-card-hover p-6">
          <h2 id="example-audit-heading" className="nk-section-title">
            Example audit for a {name} listing
          </h2>
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

      {/* Internal links — discrete crawl paths */}
      <section
        className="rounded-2xl border border-slate-200/90 bg-slate-50/60 px-5 py-4 md:px-6"
        aria-labelledby="related-guides-heading"
      >
        <h2 id="related-guides-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Related guides
        </h2>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-800" aria-label="Related optimization guides">
          {relatedHubCities.map((c) => (
            <Link
              key={c.slug}
              href={`/airbnb-optimizer/${c.slug}`}
              className="font-medium text-slate-800 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
            >
              Airbnb optimization · {c.name}
            </Link>
          ))}
          <Link
            href="/booking-optimization"
            className="font-medium text-slate-800 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
          >
            Booking.com listing optimization
          </Link>
        </nav>
      </section>

      {/* CTA */}
      <section
        className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-xl">
          <h2 id="cta-heading" className="text-base font-semibold text-slate-900 md:text-lg">
            Ready to see how your {name} listing scores?
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Open a structured audit in Norixo Optimize: conversion score, Listing Quality Index,
            and a clear order of fixes for your {name} listing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/audit/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run your listing audit
          </Link>
        </div>
      </section>
    </main>
  );
}
