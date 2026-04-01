import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function PricingPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
      {/* Pricing hero */}
      <section className="space-y-4">
        <p className="nk-kicker">Pricing</p>
        <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          Simple plans for hosts, operators and conciergeries.
        </h1>
        <p className="max-w-2xl text-[15px] leading-7 text-slate-200">
          Choose the plan that matches your portfolio size and unlock better-performing
          listings with AI-powered audits, benchmarks and optimization recommendations.
        </p>
        <p className="text-xs text-slate-400">
          Start simple and upgrade as your portfolio grows.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="nk-section-title">Plans</p>
            <p className="mt-2 text-sm text-slate-300">
              All plans include AI-powered listing audits, market-aware recommendations and a
              dashboard to track performance over time.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Pricing is mocked for now. Connect Stripe later to charge real customers.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Starter */}
          <div className="flex flex-col rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5 text-sm text-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Starter
            </p>
            <p className="mt-1 text-xs text-slate-400">For solo hosts and small operators</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              €9
              <span className="text-sm font-normal text-slate-400"> / mo</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">Great to test and improve a few listings.</p>

            <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-200">
              <li>1 workspace</li>
              <li>Up to 5 listings</li>
              <li>Limited monthly audits</li>
              <li>Conversion score for each listing</li>
              <li>Basic market comparison</li>
              <li>Concrete optimization recommendations</li>
              <li>Email support</li>
            </ul>

            <div className="mt-6 flex-1" />

            <Link
              href="/dashboard/listings/new"
              className="nk-ghost-btn mt-4 w-full text-center text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Get started
            </Link>
          </div>

          {/* Pro (emphasized) */}
          <div className="relative flex flex-col rounded-2xl border border-orange-400/60 bg-slate-950/80 p-5 text-sm text-slate-100 shadow-[0_0_0_1px_rgba(251,146,60,0.3),0_24px_60px_rgba(0,0,0,0.55)]">
            <span className="absolute -top-3 right-4 rounded-full border border-orange-400/50 bg-orange-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200">
              Most popular
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
              Pro
            </p>
            <p className="mt-1 text-xs text-slate-300">For professional hosts and growing operators</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              €29
              <span className="text-sm font-normal text-slate-400"> / mo</span>
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Scale conversion improvements across a portfolio of listings.
            </p>

            <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-200">
              <li>1 workspace</li>
              <li>Up to 25 listings</li>
              <li>Higher monthly audit allowance</li>
              <li>Full audit history per listing</li>
              <li>Photo and description suggestions</li>
              <li>Missing amenities analysis</li>
              <li>Priority email support</li>
            </ul>

            <div className="mt-6 flex-1" />

            <Link
              href="/dashboard/listings/new"
              className="nk-primary-btn mt-4 w-full text-center text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Choose Pro
            </Link>
          </div>

          {/* Agency */}
          <div className="flex flex-col rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5 text-sm text-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Agency
            </p>
            <p className="mt-1 text-xs text-slate-400">For conciergeries and portfolio managers</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              €79
              <span className="text-sm font-normal text-slate-400"> / mo</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Built for teams managing many listings and client portfolios.
            </p>

            <ul className="mt-4 space-y-2 text-[13px] leading-6 text-slate-200">
              <li>Multi-listing portfolio view</li>
              <li>Higher listing limits</li>
              <li>Increased monthly audit volume</li>
              <li>Team-ready workflows (owners, operators)</li>
              <li>Advanced reporting views</li>
              <li>Premium support</li>
            </ul>

            <div className="mt-6 flex-1" />

            <Link
              href="/dashboard/listings/new"
              className="nk-ghost-btn mt-4 w-full text-center text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      {/* Feature highlights / value */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">What you are paying for</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Each plan is designed to make it easier to understand how your listings perform and
          where to focus your energy to unlock more bookings.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">AI-powered listing audit</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Automated checks across photos, description, amenities and positioning, so you
              don&apos;t have to guess.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Competitor benchmark</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Understand how you stack up against comparable Airbnb, Booking.com and VRBO
              listings.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Conversion-focused recommendations</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Clear, prioritized actions that move the needle on bookings, not vanity
              metrics.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Better asset visibility</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              See at a glance which listings are strong, average or at risk.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Faster optimization decisions</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Stop debating what to tweak first and focus on the changes with the biggest
              upside.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Stronger portfolio performance</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Improve the quality of your listings as an asset class over time.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Pricing FAQ</p>
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Can I start with a smaller plan?</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Yes. You can start on Starter, validate the impact on a few listings, and then
              move to Pro or Agency as your portfolio grows.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Does this work only for Airbnb?</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              No. The product is designed for Airbnb, Booking.com and VRBO listings, with a
              focus on short-term rental assets, not one specific platform.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Is this for individual hosts or agencies?</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Both. Starter and Pro fit individual hosts and small operators, while Agency is
              better suited for conciergeries and portfolio managers.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Do I need technical knowledge?</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              No. You paste a listing URL, read the audit and apply the recommended changes in
              your usual hosting platform.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Can I upgrade later?</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Yes. The current setup is mock-only, but the UX assumes you can upgrade as your
              needs evolve once billing is connected.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Start improving your listings today.
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Choose a plan, run your first audit, and turn weak listings into stronger booking
            assets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Start your first audit
          </Link>
          <Link
            href="/demo"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            View product demo
          </Link>
        </div>
      </section>
      </main>
    </MarketingPageShell>
  );
}
