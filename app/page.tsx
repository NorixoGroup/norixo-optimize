import Link from "next/link";

export default function Home() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* HERO */}
      <section className="grid gap-10 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_22px_80px_rgba(15,23,42,0.08)] md:grid-cols-[minmax(0,1.6fr)_minmax(0,420px)] md:p-10">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="nk-kicker-muted">Listing Conversion Optimizer</p>
            <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Optimize your Airbnb listing
              <span className="block bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 bg-clip-text text-transparent">
                like a pro.
              </span>
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-700">
              Get a full conversion audit of your listing and discover exactly what
              prevents bookings: weak photos, missing trust signals, poor positioning or
              pricing blind spots.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard/listings/new"
              className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Analyze my listing
            </Link>
            <Link
              href="#how-it-works"
              className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              See how it works
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="nk-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Built for
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Hosts, investors and property managers who care about bookings, not vanity
                metrics.
              </p>
            </div>
            <div className="nk-card p-5 ring-1 ring-orange-400/40">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                Outcome
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">+12–25%</p>
              <p className="mt-1 text-xs text-slate-600">
                Typical booking uplift after applying the most impactful recommendations.
              </p>
            </div>
            <div className="nk-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Time to value
              </p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Paste a URL, get a full audit and optimization plan in minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Product preview in hero */}
        <aside className="nk-card flex flex-col justify-between bg-slate-50 p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sample audit snapshot
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Lisbon · 2BR with balcony
                </p>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                AI report
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Conversion score
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-600">
                  6.4<span className="text-base text-emerald-500"> / 10</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Compared to similar listings nearby.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Listing Quality Index
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  78<span className="text-sm text-slate-500"> / 100</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-600">Competitive with upside</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Top recommendations
              </p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-800">
                <li>Reorder photos to highlight terrace and city view first.</li>
                <li>Rewrite opening paragraph with stronger trust and social proof.</li>
                <li>Add missing amenities guests expect at this price point.</li>
              </ul>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Estimated revenue impact
                </p>
                <p className="mt-1 text-sm font-medium text-emerald-800">
                  +€280 to +€620 / month
                </p>
              </div>
              <span className="text-[11px] text-emerald-700">Based on similar optimized listings.</span>
            </div>
          </div>
        </aside>
      </section>

      {/* PROBLEM SECTION */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card p-6">
          <p className="nk-section-title">The host problem</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            Your listing gets views, but not enough bookings.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Most hosts don’t know exactly why a listing underperforms. You tweak the price,
            change a few photos, or add a sentence in the description – but it still feels
            like guesswork.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Hard to see how you really compare to nearby competitors.</li>
            <li>• No clear link between specific changes and more bookings.</li>
            <li>• Little visibility on which listing in your portfolio needs help first.</li>
          </ul>
        </div>

        <div className="nk-card grid gap-3 p-5 text-sm text-slate-800 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Unknown conversion leaks
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Guests decide in seconds. If your hero photo, title or opening paragraph miss,
              they never even read the rest.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              No competitive context
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              You rarely see your listing next to the 10 most similar places guests compare
              you with.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Guesswork over data
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Without a structured audit, it’s impossible to know which edits have the
              biggest impact.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              No clear roadmap
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              You need an ordered checklist, not endless generic “tips for hosts”.
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCT SOLUTION */}
      <section id="how-it-works" className="nk-card p-6">
        <p className="nk-section-title">Product solution</p>
        <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
          A full conversion audit that shows you what blocks bookings.
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-slate-700">
          Listing Conversion Optimizer analyzes your listing like a top-performing host would
          – but with data. It breaks down each element that influences conversion and
          summarizes it in a clear report.
        </p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-slate-900">Conversion score</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              One global score out of 10 so you instantly know where you stand.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Competitor comparison</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Understand how you rank vs. similar listings competing for the same guests.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Optimization recommendations</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              A prioritized checklist across photos, copy, amenities and trust.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Revenue impact estimate</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              A projected booking and revenue uplift once you apply the changes.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="nk-card p-6">
        <p className="nk-section-title">Feature overview</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Listing Conversion Score</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              A clear 0–10 score with category breakdowns so you know which levers to pull
              first.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Competitor Benchmark</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              See where you sit vs. nearby listings on photos, description, amenities and
              pricing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Listing Quality Index</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              A 0–100 metric that combines quality, competitiveness and conversion potential.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">AI Optimization Suggestions</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Get ready-to-use wording ideas, photo order suggestions and amenity tweaks.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Revenue Impact Estimator</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Understand the potential monthly uplift so you can prioritize the right
              listings.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Portfolio-ready</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Designed to handle multiple listings and compare performance across your whole
              portfolio.
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="nk-card p-6">
          <p className="nk-section-title">Product preview</p>
          <h2 className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">
            A dashboard-like report that feels built for operators.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-700">
            Instead of a wall of text, you get a structured view: conversion score, Listing
            Quality Index, prioritized recommendations and estimated revenue impact — all in
            one place.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-700">
            <li>• Executive summary with overall score and LQI.</li>
            <li>• Section-by-section breakdown: photos, description, amenities, trust.</li>
            <li>• Clear next actions you can apply in your OTA dashboard today.</li>
          </ul>
        </div>

        <div className="nk-card space-y-3 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Listing snapshot
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Barcelona · Design loft in Gràcia
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Audit ready
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Overall conversion score
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                7.2<span className="text-sm text-emerald-500"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Above market average</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Listing Quality Index
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                82<span className="text-sm text-slate-500"> / 100</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">Strong performer</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recommended actions
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px] leading-5 text-slate-800">
                <li>• Move living room photo to first position.</li>
                <li>• Add “ideal for remote work” to the title.</li>
                <li>• Highlight weekly discount and flexible check-in.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Revenue impact
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-800">
                +€340 to +€540 / month
              </p>
              <p className="mt-1 text-[11px] text-emerald-700">
                Estimate based on comparable optimized listings in this area.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="nk-card p-6">
        <p className="nk-section-title">Who it’s for</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Airbnb Hosts</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Optimize your main listing and stop leaving bookings and nightly rate on the
              table.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Real Estate Investors</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Validate revenue potential before buying, renovating or repositioning a
              property.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Property Managers</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Quickly see which units in your portfolio need attention this month.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Short-Term Rental Agencies</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Turn conversion audits into a premium service for owners and partners.
            </p>
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="nk-card p-6">
        <p className="nk-section-title">Pricing preview</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-800 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Starter
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">For 1–2 listings</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Perfect to optimize a primary listing or test the product on your main unit.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-400/60 bg-orange-50 p-5 ring-1 ring-orange-400/50">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Pro
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">For growing hosts</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Designed for small portfolios, conciergeries and property managers with
              3–10 listings.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Agency
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">For operators</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Tailored for agencies and multi-city operators managing larger portfolios.
            </p>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-slate-500">
          Pricing is mocked for now. Connect Stripe in the backend when you’re ready to start
          charging real customers.
        </p>
      </section>

      {/* FINAL CTA */}
      <section className="nk-card flex flex-col gap-4 bg-slate-900 px-6 py-7 text-white md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold md:text-2xl">
            Analyze your listing now.
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-200">
            Paste your listing URL, run a full audit and get a concrete, prioritized plan to
            increase bookings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Start a free audit
          </Link>
        </div>
      </section>
    </main>
  );
}