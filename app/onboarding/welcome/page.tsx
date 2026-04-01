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
              Give your listings a clear conversion strategy
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              In the next few minutes you&apos;ll create your workspace, connect a real listing and receive a structured audit that highlights strengths, blind spots and a prioritized set of fixes.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-slate-700/50 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              What to expect
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              A guided path from sign-up to a first, decision-ready audit. We handle the data collection for you; no technical setup or API keys required at this stage.
            </p>
          </div>
        </div>
      </section>

      {/* 3-step onboarding preview */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Your first few minutes</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Onboarding is designed to move quickly from setup to value. In three focused steps, you&apos;ll go from a blank workspace to a concrete audit of a real listing.
        </p>
        <div className="mt-6 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                1
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Set up workspace
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Set up your workspace</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Name your workspace after a property, brand or management company so audits and reports stay organised and easy to share.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                2
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Add listing URL
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Add a real listing</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Paste a public Airbnb, Booking.com or Vrbo URL. We&apos;ll pull the page details into your dashboard and prepare them for audit.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                3
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Review audit
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Review your first conversion audit</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              See your conversion score, how you compare to local competitors and which changes should realistically come first.
            </p>
          </div>
        </div>
      </section>

      {/* Value summary */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">What you&apos;ll get from your first audit</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          The goal of onboarding is not just to click through steps, but to leave you with a clear, data-backed view of how one of your listings is positioned today and what to do about it.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Benchmark against local competition</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              See whether this listing sits above, in line with or behind comparable listings in your area, based on the visible signals travellers actually see.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Discover missing or hidden amenities</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Identify amenities and reassurance signals competitors highlight that you either don&apos;t offer or don&apos;t yet surface clearly in your listing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Sharpen title, photos and description</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Get precise suggestions for the title, hero photos and opening paragraph so the core promise is obvious within the first seconds on the page.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="font-semibold text-white">Clarify the booking upside</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Connect suggested improvements to a clearer, more competitive listing that turns more qualified views into bookings over time, without overhauling your entire pricing model.
            </p>
          </div>
        </div>
      </section>

      {/* Primary CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Start your first conversion audit
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            We&apos;ll guide you through creating your workspace and adding one real listing so you see a complete audit, not just a demo, in a few minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Start first audit
          </Link>
          <Link
            href="/demo"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            View sample audit
          </Link>
        </div>
      </section>
    </main>
  );
}
