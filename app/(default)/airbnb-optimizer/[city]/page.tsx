import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { countries } from "@/data/countries";
import { cities, getCityBySlug, type City } from "@/data/cities";
import { getCityHubContentOverride } from "@/data/cityHubContentOverrides";
import { localSeoTopics } from "@/data/localSeo";
import { isCityTopicSitemapEligible } from "@/lib/seo/sitemapEligibility";
import { buildCitySchema } from "@/lib/seo/buildCitySchema";
import { buildCityMetadata } from "@/lib/seo/buildCityMetadata";

const publicSiteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");

type PageProps = {
  params: Promise<{
    city: string;
  }>;
};

export function generateStaticParams() {
  return cities.map((city) => ({
    city: city.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);
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
function hasRichCityContext(c: City): boolean {
  return Boolean(
    c.marketAngle &&
      c.competitionAngle &&
      c.pricingAngle &&
      c.guestExpectationAngle
  );
}

function marketAngleLine(c: City): string {
  return c.marketAngle ?? `Use ${c.name}, ${c.country}, as geographic context and validate market-specific claims with current evidence before applying them to a listing.`;
}

function competitionAngleLine(c: City): string {
  return c.competitionAngle ?? `Compare the listing with observable alternatives in ${c.name} rather than assuming a city-wide competitive pattern.`;
}

function pricingAngleLine(c: City): string {
  return c.pricingAngle ?? `Evaluate pricing in ${c.name} from current comparable listings, stay conditions, availability, and first-party performance evidence.`;
}

function guestExpectationAngleLine(c: City): string {
  return c.guestExpectationAngle ?? `Use the listing's own guest questions, reviews, rules, amenities, and presentation to identify expectation gaps instead of assuming city-wide guest preferences.`;
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

function countryToSlug(country: string) {
  const map: Record<string, string> = {
    France: "france",
    Morocco: "morocco",
    Spain: "spain",
    Italy: "italy",
    Portugal: "portugal",
    Greece: "greece",
    Japan: "japan",
    Thailand: "thailand",
    Canada: "canada",
    "United States": "united-states",
  };

  return map[country] ?? country.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function CityOptimizerPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);

  if (!city) {
    notFound();
  }

  const {
    name,
    country,
  } = city;

  const countrySlug = countryToSlug(country);
  const hasPublishedCountryPage = countries.some(
    (entry) => entry.slug === countrySlug,
  );

  const baseUrl = publicSiteUrl;
  const relatedHubCities = relatedHubCitiesFor(city.slug, 4);
  const contentOverride = getCityHubContentOverride(city.slug);
  const eligibleTopics = localSeoTopics.filter((topic) =>
    isCityTopicSitemapEligible(
      `/airbnb-optimizer/${city.slug}/${topic.slug}`,
    ),
  );
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
          {hasRichCityContext(city) ? (
            <>
              Stand out in the {name} market with a listing that converts views into bookings.{" "}
              {marketAngleLine(city)} This guide shows how guests browse in {name}, what they expect to see,
              and which changes move occupancy first.
            </>
          ) : (
            <>
              Use {name}, {country}, as geographic context while improving the listing from evidence
              the property can actually support. {marketAngleLine(city)} This guide focuses on clearer
              presentation, observable comparisons, and listing-level signals rather than unsupported
              city-wide assumptions.
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-in?next=/audit/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run your listing audit
          </Link>
          <p className="text-xs leading-5 text-slate-500">
            Norixo scores your listing and surfaces prioritized actions—paste your URL
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
            {hasRichCityContext(city) ? (
              <>
                {name} is a competitive short-term rental market in {country}. {competitionAngleLine(city)}{" "}
                Your photos, description, and amenities still need to justify your nightly rate against
                what guests see in search.
              </>
            ) : (
              <>
                Use {name}, {country}, as the geographic frame for comparison. {competitionAngleLine(city)}{" "}
                Evaluate photos, description, amenities, and price against observable alternatives
                instead of assuming a city-wide competitive pattern.
              </>
            )}
          </p>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>
              • Compare observable listing evidence such as current rates, amenities,
              stay conditions, reviews, and presentation instead of relying on unsupported
              city-wide averages.
            </li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover grid gap-3 p-5 text-sm text-slate-800 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Key takeaway
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Review photos, copy, amenities, pricing, and stay conditions against
              observable alternatives in {name}, then prioritize changes supported by
              current listing and market evidence.
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
          {hasRichCityContext(city) ? (
            <>
              Optimization is not generic advice. {competitionAngleLine(city)} In {name}, it means aligning how
              you present your home with how guests already shop—using the same signals they see beside
              your listing in search.
            </>
          ) : (
            <>
              Optimization should stay specific to the property. {competitionAngleLine(city)} Compare
              observable listing signals such as clarity, amenities, photos, rules, and price without
              treating unverified city-wide behavior as fact.
            </>
          )}
        </p>
        <div className="mt-6 grid gap-6 text-sm text-slate-800 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Why Airbnb optimization matters in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {hasRichCityContext(city) ? (
                <>
                  {guestExpectationAngleLine(city)} Travelers choosing {name} skim dozens of listings; the winner
                  is rarely the cheapest alone—it is the one that looks trustworthy, complete, and easy
                  to understand in seconds.
                </>
              ) : (
                <>
                  {guestExpectationAngleLine(city)} Improve trust by making the stay, amenities, access,
                  limitations, and value proposition easy to verify from the listing itself.
                </>
              )}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pricing strategy in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {pricingAngleLine(city)} Use your calendar and observable comparable
              listings to keep pricing and presentation coherent.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Photos and listing quality in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Review the listing's own photo coverage. Re-order for clarity and add captions where they remove
              doubt.{" "}
              {hasRichCityContext(city)
                ? `Make sure your cover image matches what ${name} guests filter for.`
                : "Choose a cover image that clearly represents a verifiable strength of the property."}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              How to increase bookings in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Use the listing's own review history and observable trust signals. Pair visible polish with a description that answers
              “who this is for” in {name}—families, remote workers, weekend explorers—so the
              right guests stop comparing and start booking.
            </p>
          </div>
        </div>
      </section>

      {contentOverride ? (
        <section className="nk-card nk-card-hover p-6" aria-labelledby="city-diagnosis-heading">
          <h2 id="city-diagnosis-heading" className="nk-section-title">
            {contentOverride.heading}
          </h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-700">
            {contentOverride.introduction}
          </p>
          <div className="mt-6 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
            {contentOverride.priorities.map((priority) => {
              const topic = localSeoTopics.find((item) => item.slug === priority.topicSlug);

              if (
                !topic ||
                !isCityTopicSitemapEligible(
                  `/airbnb-optimizer/${city.slug}/${topic.slug}`,
                )
              ) {
                return null;
              }

              return (
                <div key={priority.topicSlug}>
                  <h3 className="text-sm font-semibold text-slate-900">{priority.heading}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">{priority.body}</p>
                  <Link
                    href={`/airbnb-optimizer/${city.slug}/${topic.slug}`}
                    className="mt-3 inline-flex text-[13px] font-semibold text-slate-800 underline-offset-4 hover:underline"
                  >
                    Explore {city.name} {topic.label.toLowerCase()}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-[13px] leading-6 text-slate-700">{contentOverride.auditBridge}</p>
        </section>
      ) : null}

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
      <section aria-labelledby="example-audit-heading">
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
            <li>
                •{" "}
                {hasRichCityContext(city)
                  ? `Recommended photo order tailored to ${name}-style browsing behavior.`
                  : "Recommended photo order based on the property's clearest and most verifiable strengths."}
              </li>
            <li>• Copy tweaks that reinforce trust and clarity for international guests.</li>
          </ul>
        </div>


      </section>

      {eligibleTopics.length > 0 ? (
        <section className="nk-card nk-card-hover p-6" aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="nk-section-title">
            Explore Airbnb optimization topics for {name}
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-slate-700">
          Browse every city-specific guide for {name} to move from high-level market context to
          concrete pricing, photo, SEO, trust, and conversion improvements.
        </p>
        <nav
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={`${name} Airbnb optimization topics`}
        >
          {eligibleTopics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/airbnb-optimizer/${city.slug}/${topic.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              {city.name} {topic.titleSuffix}
            </Link>
          ))}
          </nav>
        </section>
      ) : null}

      {/* Internal links — discrete crawl paths */}
      <section className="nk-section-card">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-950">
            Related Airbnb optimization resources
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Build a stronger Airbnb strategy for {name} by combining local
            market insights with country-level guidance and practical listing
            optimization guides.
          </p>

          <nav
            className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-800"
            aria-label="Related optimization resources"
          >
            {hasPublishedCountryPage ? (
              <Link
                href={`/countries/${countrySlug}`}
                className="underline-offset-4 hover:underline"
              >
                Airbnb optimizer {country}
              </Link>
            ) : null}
            <Link href="/countries" className="underline-offset-4 hover:underline">
              Airbnb markets by country
            </Link>
            <Link href="/guides" className="underline-offset-4 hover:underline">
              Airbnb optimization guides
            </Link>
            <Link href="/guides/airbnb-seo" className="underline-offset-4 hover:underline">
              Airbnb SEO
            </Link>
            <Link href="/guides/airbnb-listing-optimization" className="underline-offset-4 hover:underline">
              Listing optimization
            </Link>
            <Link href="/guides/airbnb-pricing-optimization" className="underline-offset-4 hover:underline">
              Pricing optimization
            </Link>
            <Link href="/guides/airbnb-listing-audit" className="underline-offset-4 hover:underline">
              Listing audit
            </Link>
            <Link href="/sign-in?next=/audit/new" className="underline-offset-4 hover:underline">
              Run an Airbnb audit
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
            Open a structured audit in Norixo: conversion score, Listing Quality Index,
            and a clear order of fixes for your {name} listing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/sign-in?next=/audit/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run your listing audit
          </Link>
        </div>
      </section>
    </main>
  );
}
