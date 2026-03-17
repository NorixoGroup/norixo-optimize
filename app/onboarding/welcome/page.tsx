import Link from "next/link";

export default function OnboardingWelcomePage() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* Welcome hero */}
      <section className="nk-page-header-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="nk-kicker">Onboarding</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Welcome to Listing Conversion Optimizer
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              Let&apos;s set up your workspace, add your first listing, and generate your
              first conversion audit. This guided flow will take you from sign-up to your
              first actionable insights in just a few minutes.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-slate-700/50 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              What to expect
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              We&apos;ll create your workspace, analyze a first listing and show you how
              to read your audit report. No technical setup or API keys required at this
              stage.
            </p>
          </div>
        </div>
      </section>

      {/* 3-step onboarding preview */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Your first few minutes</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Onboarding is designed to be simple and focused. In three short steps, you&apos;ll
          go from a blank workspace to a concrete audit of a real listing.
        </p>
        <div className="mt-6 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                1
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Create workspace
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Create your workspace</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Give your workspace a name that matches your activity: a property, brand or
              management company.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                2
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Add listing
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Add your first listing</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Paste a public Airbnb, Booking.com or VRBO URL. We&apos;ll create the listing in
              your dashboard and prepare it for analysis.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                3
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Get audit
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Get your first audit report</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Review your conversion score, see how you compare to local competitors and get
              a prioritized list of improvements.
            </p>
          </div>
        </div>
      </section>

      {/* Value summary */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">What you&apos;ll get from your first audit</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          The goal of onboarding is not just to click through steps, but to give you a
          concrete, data-backed view of how one of your listings is performing today.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Benchmark against local competitors</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Understand whether your listing is positioned above, at or below similar
              listings in your area.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Discover missing amenities</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              See which amenities comparable listings are highlighting that you may not be
              promoting yet.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Improve title, photos and description</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Get suggestions for your title, hero photos and opening paragraph so guests
              quickly understand why to book.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Increase booking potential</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Translate improvements into a clearer, more competitive listing that converts
              more views into bookings over time.
            </p>
          </div>
        </div>
      </section>

      {/* Primary CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Ready to continue your setup?
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            We&apos;ll guide you through creating your workspace and adding your first listing
            so you can see your initial audit in just a few minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Continue setup
          </Link>
          <Link
            href="/demo"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            See demo
          </Link>
        </div>
      </section>
    </main>
  );
}
