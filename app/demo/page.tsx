import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

export default function DemoPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-16 md:space-y-20">
      {/* Demo hero */}
      <section className="space-y-4">
        <p className="nk-kicker">Product demo</p>
        <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          See how a listing audit works.
        </h1>
        <p className="max-w-2xl text-[15px] leading-7 text-slate-200">
          Preview how Listing Conversion Optimizer analyzes a short-term rental listing and
          identifies concrete ways to improve conversion and bookings.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/listings/new"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Start your first audit
          </Link>
          <Link
            href="/dashboard"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Go to dashboard
          </Link>
        </div>
      </section>

      {/* Example listing analyzed */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover flex flex-col justify-between p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="nk-section-title">Example listing analyzed</p>
              <h2 className="mt-2 text-lg font-semibold text-white md:text-xl">
                Riad with rooftop terrace & plunge pool
              </h2>
              <p className="mt-1 text-sm text-slate-300">Marrakech · Medina · 2BR · 4 guests</p>
              <p className="mt-2 text-sm text-slate-300">\u20ac110 / night · Flexible cancellation</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-200">
                Airbnb
              </span>
              <div className="flex items-center gap-1 text-sm font-medium text-amber-300">
                <span>4.7</span>
                <span className="text-xs text-slate-400">(128 reviews)</span>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/80">
            <div className="relative h-40 w-full bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 sm:h-48">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.08),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.25),transparent_55%)]" />
              <div className="relative flex h-full items-end justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Listing preview (mock)
                  </p>
                  <p className="mt-1 text-sm text-slate-100">
                    Terrace · Patio · Small plunge pool · Traditional riad layout
                  </p>
                </div>
                <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-slate-200">
                  Guests decide in seconds based on this.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit report preview */}
        <div className="nk-card nk-card-hover flex flex-col p-6">
          <p className="nk-section-title">Audit report preview</p>
          <p className="mt-2 text-sm text-slate-300">
            This is a static example of what a Listing Conversion Optimizer audit looks
            like for this listing.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Overall score
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-400">
                6.2<span className="text-base text-emerald-300"> / 10</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Compared to similar listings nearby.</p>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Potential score
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">
                8.4<span className="text-sm text-slate-400"> after changes</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-300">+2.2 pts possible uplift</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Estimated impact
                </p>
                <p className="mt-1 text-sm text-emerald-50">+18% booking potential</p>
              </div>
              <p className="text-[11px] text-emerald-200">Based on similar optimized listings.</p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Photos
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-300">Hero image does not show key asset.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Copy
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-300">Opening paragraph is generic and vague.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Amenities
              </p>
              <p className="mt-1 text-[13px] leading-5 text-slate-300">3 high-impact amenities missing vs. comps.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key insights */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Key insights detected</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          The audit breaks down your listing into the levers that actually influence
          conversion and booking decisions.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Listing title
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Title could better surface key assets and audience.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              The current title doesn&apos;t mention the rooftop terrace or plunge pool and
              doesn&apos;t clarify who the place is ideal for.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Photo order
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Hero photo doesn&apos;t highlight the strongest rooms.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              The first images focus on corridors and secondary rooms instead of the terrace
              and pool that drive clicks.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Amenities vs. competitors
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Missing amenities compared to local competitors.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Nearby listings at similar price points promote fast Wi-Fi, workspace and late
              checkout, which are absent here.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Description opening
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Description lacks a strong, guest-focused opening.
            </p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              The first lines don&apos;t clearly state who the listing is for, what makes it
              special, or why to book now.
            </p>
          </div>
        </div>
      </section>

      {/* Optimization recommendations */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Optimization recommendations</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Each audit comes with a prioritized checklist of concrete actions you can apply in
          a single sitting.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/70 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-white">Improve listing title structure</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Include city, key feature and audience: e.g. &quot;Marrakech riad with
                  rooftop pool · ideal for couples&quot;.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/70 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-white">Reorder photos for stronger first impression</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Move terrace, pool and main living area to the first 3 photos to match what
                  guests care about most.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/70 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-white">Add missing amenities</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Highlight fast Wi-Fi, dedicated workspace and flexible checkout if
                  available to match local expectations.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-slate-500/70 text-[10px] text-slate-400">
                
              </span>
              <div>
                <p className="font-semibold text-white">Strengthen description opening paragraph</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Lead with who the place is for, the main emotional benefit and what makes
                  this riad different from others.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              How to use this checklist
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Most hosts can apply the top 3 recommendations in under an hour. The aim is to
              ship meaningful improvements quickly, not rewrite your entire listing.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-slate-300">
              You stay in control: nothing is changed automatically. LCO gives you the
              playbook; you decide what to implement on Airbnb, Booking.com or VRBO.
            </p>
          </div>
        </div>
      </section>

      {/* Estimated performance improvement */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Estimated performance improvement</p>
        <div className="mt-4 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Conversion uplift
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-50">+15\u201325% bookings</p>
            <p className="mt-1 text-[13px] leading-6 text-emerald-100">
              Typical improvement range observed after applying high-impact recommendations on
              similar listings.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Listing competitiveness
            </p>
            <p className="mt-2 text-sm font-semibold text-white">Move from average to top-tier.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              By closing the gap on photos, amenities and messaging, your listing becomes a
              safer choice in search results.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Decision speed
            </p>
            <p className="mt-2 text-sm font-semibold text-white">Know exactly what to fix first.</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-300">
              Instead of guessing, you get a clear, ranked list of opportunities by impact.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Ready to analyze your own listing?
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Paste a URL, run your first AI-powered audit, and turn cold scrollers into booked
            guests.
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
            href="/sign-up"
            className="nk-ghost-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Sign up
          </Link>
        </div>
      </section>
      </main>
    </MarketingPageShell>
  );
}
