import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { countries } from "@/data/countries";
import { cities, getCityBySlug } from "@/data/cities";
import { getCityHubContentOverride } from "@/data/cityHubContentOverrides";
import { localSeoTopics } from "@/data/localSeo";
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
    marketAngle,
    competitionAngle,
    pricingAngle,
    guestExpectationAngle,
  } = city;

  const countrySlug = countryToSlug(country);
  const hasPublishedCountryPage = countries.some(
    (entry) => entry.slug === countrySlug,
  );

  const baseUrl = publicSiteUrl;
  const contentOverride = getCityHubContentOverride(city.slug);
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

      {/* Market context — qualitative until claim-level evidence is available */}
      <section
        className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        aria-labelledby="market-snapshot-heading"
      >
        <div className="nk-card nk-card-hover p-6">
          <h2 id="market-snapshot-heading" className="nk-section-title">
            {name} market context
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-700">
            {name} is a competitive short-term rental market in {country}. {competitionAngle}{" "}
            Your photos, description, amenities, pricing and trust signals need to make sense
            together when guests compare nearby alternatives.
          </p>
          <p className="mt-4 text-[13px] leading-6 text-slate-600">
            This city guide intentionally avoids publishing city-level average price, rating or
            photo-count figures without claim-level evidence showing the source, sample, period and
            freshness. When Norixo publishes numeric market evidence, the supporting methodology and
            limitations should be visible with that evidence.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px] font-semibold text-slate-800">
            <Link href="/research/methodology" className="underline-offset-4 hover:underline">
              Read the public data methodology
            </Link>
            <Link href="/reports" className="underline-offset-4 hover:underline">
              View evidence-aware market reports
            </Link>
          </div>
        </div>

        <div className="nk-card nk-card-hover grid gap-3 p-5 text-sm text-slate-800 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pricing context
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {pricingAngle}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Guest expectations
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {guestExpectationAngle}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Listing presentation
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Review the cover image, gallery order, title, description and amenity completeness
              together rather than treating any one element as a standalone ranking lever.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Competition
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Compare like-for-like alternatives in {name} before deciding whether the main issue
              is price, presentation, positioning or guest reassurance.
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
          you present your home with how guests compare alternatives in search.
        </p>
        <div className="mt-6 grid gap-6 text-sm text-slate-800 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Why Airbnb optimization matters in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {guestExpectationAngle} Make the listing easy to understand quickly: what the property
              offers, who it suits, where it is, and why the price is coherent with the experience.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pricing strategy in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              {pricingAngle} Compare your rate with genuinely similar alternatives and evaluate
              whether your presentation supports the position you are asking guests to accept.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Photos and listing quality in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Build a deliberate gallery order: start with the clearest proof of the space, then
              remove uncertainty about rooms, amenities, access and surroundings.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              How to improve booking readiness in {name}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Pair visible polish with a description that explains who the listing is for and what
              guests should expect, then validate the result against comparable alternatives.
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

              if (!topic) {
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
            <h3 className="text-sm font-semibold text-slate-900">Lead with your strongest proof</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Choose a first image that makes the space and its strongest differentiator immediately
              understandable, then make the rest of the gallery support that promise.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Write a city-aware opening</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Your first lines should clearly state who the listing is for and why its location and
              setup make sense for a stay in {name}.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Match amenities to expectations</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Compare relevant nearby alternatives and verify that your amenity list accurately
              covers the essentials guests expect for your property type and positioning.
            </p>
          </div>
        </div>
      </section>

      {/* Audit workflow — deliberately non-numeric */}
      <section
        className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        aria-labelledby="example-audit-heading"
      >
        <div className="nk-card nk-card-hover p-6">
          <h2 id="example-audit-heading" className="nk-section-title">
            What a Norixo audit reviews for a {name} listing
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            A full audit reviews the listing itself and organizes findings by category. This public
            city page does not publish a fabricated city-specific score or pretend that an audit has
            been run when no listing has been supplied.
          </p>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>• Listing structure, title and description clarity.</li>
            <li>• Photo presentation and gallery sequencing.</li>
            <li>• Amenities, reassurance and trust signals.</li>
            <li>• Pricing context and competitive positioning.</li>
            <li>• Prioritized findings and recommended next actions.</li>
          </ul>
        </div>

        <div className="nk-card nk-card-hover space-y-3 bg-slate-50 p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Illustrative workflow
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Listing → evidence → findings → priorities
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Evidence first
            </p>
            <p className="mt-2 text-[12px] leading-5 text-slate-700">
              Scores and recommendations belong to an actual listing audit. They are not reused as
              fixed city evidence on public market pages.
            </p>
          </div>
          <Link
            href="/free-audit"
            className="inline-flex text-[13px] font-semibold text-slate-900 underline-offset-4 hover:underline"
          >
            Start with the free audit preview
          </Link>
        </div>
      </section>

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
          {localSeoTopics.map((topic) => (
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

      {/* Internal links — discrete crawl paths */}
      <section className="nk-section-card">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-950">
          Related Airbnb optimization resources
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Build a stronger Airbnb strategy for {name} by combining local market insights with
          country-level guidance and practical listing optimization guides.
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
          <Link href="/free-audit" className="underline-offset-4 hover:underline">
            Run an Airbnb audit preview
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
            Ready to review your {name} listing?
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Use Norixo to move from general market context to listing-specific findings and a clear
            order of fixes for your property.
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
