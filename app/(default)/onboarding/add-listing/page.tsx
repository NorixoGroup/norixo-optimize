import Link from "next/link";

export default function OnboardingAddListingPage() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* Intro header */}
      <section className="nk-page-header-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="nk-kicker">Onboarding</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Add the listing you want to improve first
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              Paste a public Airbnb, Booking.com or Vrbo URL to start your first conversion audit. We&apos;ll turn this real listing into a clear read of how it performs today and what to improve first.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-slate-700/50 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Key activation step
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              This first listing is how you experience the full audit workflow end‑to‑end. It becomes your reference point inside the workspace, and you can add more listings at any time.
            </p>
          </div>
        </div>
      </section>

      {/* URL input card & supported platforms */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover p-6 md:p-8">
          <p className="nk-section-title">Listing URL</p>
          <p className="mt-2 text-sm text-slate-300">
            Choose a listing that matters right now: a flagship property, a unit you&apos;re concerned about, or a new launch you want to validate before peak season.
          </p>

          <form className="mt-6 space-y-4 text-sm text-slate-200">
            <div className="space-y-2">
              <label
                htmlFor="listing-url"
                className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400"
              >
                Listing URL
              </label>
              <textarea
                id="listing-url"
                name="listing-url"
                rows={3}
                placeholder={
                  "https://airbnb.com/rooms/…\nhttps://booking.com/hotel/…\nhttps://vrbo.com/…"
                }
                className="nk-input w-full resize-none whitespace-pre-line placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-400">
                Paste a single public URL from Airbnb, Booking.com or Vrbo. We only read the content of the page to run the audit and never change the listing itself.
              </p>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 pt-5 text-xs">
            <p className="text-[11px] text-slate-400">
              Start with one listing to see the full audit experience. You can refine your selection or add additional properties later from your dashboard.
            </p>
          </div>
        </div>

        {/* Supported platforms note */}
        <aside className="nk-card nk-card-hover flex flex-col justify-between p-6 md:p-8">
          <div className="space-y-4 text-sm text-slate-200">
            <p className="nk-section-title">Supported platforms</p>
            <p className="text-[13px] leading-6 text-slate-300">
              Listing Conversion Optimizer is designed around major short‑term rental platforms. The onboarding flow starts with three of them:
            </p>
            <ul className="space-y-2 text-[13px] leading-6 text-slate-200">
              <li>
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-200">
                  Airbnb
                </span>{" "}
                for individual stays and unique properties.
              </li>
              <li>
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Booking.com
                </span>{" "}
                for more hotel-style and apartment inventory.
              </li>
              <li>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  VRBO
                </span>{" "}
                for larger vacation rentals and villas.
              </li>
            </ul>
            <p className="text-[12px] leading-6 text-slate-400">
              Additional OTAs and direct booking sites can be connected over time as your stack and needs evolve.
            </p>
          </div>
        </aside>
      </section>

      {/* What happens next */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">What happens next</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Once you provide a URL, the audit walks through three clear stages to turn that public listing into an actionable, conversion‑focused report.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                1
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Extract listing
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">We extract the listing data</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Photos, title, description and amenities are collected from the public page so we can analyze how the listing currently presents itself to potential guests.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                2
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Benchmark
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">We benchmark it against the market</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Your listing is compared to similar local properties to understand where it&apos;s strong, average or underperforming on the levers that influence conversion.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                3
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Recommend
              </p>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">We generate recommendations</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              You receive a conversion‑focused audit with prioritized actions across title, photos, amenities and description, so you know exactly where to focus first.
            </p>
          </div>
        </div>
      </section>

      {/* Continue CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Move on to your first audit
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Next, you&apos;ll see how this listing is scored, how it compares to competitors, and which changes have the clearest potential to strengthen bookings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end text-xs font-semibold uppercase tracking-[0.18em]">
          <Link href="/onboarding/workspace" className="nk-ghost-btn">
            Back
          </Link>
          <Link href="/dashboard/listings/new" className="nk-primary-btn">
            Run audit on this listing
          </Link>
        </div>
      </section>
    </main>
  );
}
