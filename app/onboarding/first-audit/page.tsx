import Link from "next/link";

export default function OnboardingFirstAuditPage() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* Header */}
      <section className="nk-page-header-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="nk-kicker">Onboarding</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Preparing your first audit
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              We&apos;re analyzing your listing structure, content, amenities and market
              positioning so you can see exactly where to improve conversion and bookings.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-slate-700/50 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Almost there
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              This is a preview of the audit generation flow. In a live setup, this step
              would run in the background while your report is being prepared.
            </p>
          </div>
        </div>
      </section>

      {/* Audit generation progress card */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover p-6 md:p-8">
          <p className="nk-section-title">Audit generation</p>
          <p className="mt-2 text-sm text-slate-300">
            Here&apos;s what a typical first audit generation sequence looks like. Steps update
            automatically until your report is ready to review.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Progress
                </p>
                <p className="mt-1 text-sm text-emerald-50">Simulated audit creation</p>
              </div>
              <p className="text-[11px] text-emerald-100">100% · Report ready</p>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/20">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-300 via-emerald-200 to-sky-300" />
            </div>
          </div>

          <ol className="mt-6 space-y-3 text-sm text-slate-200">
            <li className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-slate-950">
                ✓
              </span>
              <div>
                <p className="font-semibold text-white">Listing imported</p>
                <p className="mt-1 text-[13px] leading-6 text-emerald-50">
                  The public page has been captured so we can analyze photos, text and
                  amenities.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] font-semibold text-emerald-200">
                ✓
              </span>
              <div>
                <p className="font-semibold text-white">Market comparison prepared</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Similar listings in your area are identified to benchmark positioning and
                  offering.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] font-semibold text-emerald-200">
                ✓
              </span>
              <div>
                <p className="font-semibold text-white">Recommendations generated</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  Conversion-focused suggestions are created for title, photos, amenities and
                  description.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-slate-950/80 p-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] font-semibold text-emerald-200">
                ✓
              </span>
              <div>
                <p className="font-semibold text-white">Report ready</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-300">
                  A full audit report is assembled so you can review your score and the most
                  impactful actions.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* What is being analyzed block */}
        <aside className="nk-card nk-card-hover flex flex-col justify-between p-6 md:p-8">
          <div className="space-y-4 text-sm text-slate-200">
            <p className="nk-section-title">What is being analyzed</p>
            <p className="text-[13px] leading-6 text-slate-300">
              The audit focuses on the parts of your listing that guests actually see and use
              to make a booking decision.
            </p>
            <ul className="space-y-2 text-[13px] leading-6 text-slate-200">
              <li>
                <span className="font-semibold text-white">Structure:</span> title, headline
                hierarchy, section clarity.
              </li>
              <li>
                <span className="font-semibold text-white">Content:</span> description
                quality, guest fit, trust and differentiation.
              </li>
              <li>
                <span className="font-semibold text-white">Amenities:</span> coverage vs.
                comparable listings and guest expectations.
              </li>
              <li>
                <span className="font-semibold text-white">Market positioning:</span> how the
                overall offer compares within your local market.
              </li>
            </ul>
            <p className="text-[12px] leading-6 text-slate-400">
              In this MVP, the flow is simulated with static data so you can understand the
              experience before connecting real infrastructure.
            </p>
          </div>
        </aside>
      </section>

      {/* Next step CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Your first audit is ready to explore
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Next, you&apos;ll see the full report: overall score, potential score, estimated
            impact and a prioritized list of improvements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end text-xs font-semibold uppercase tracking-[0.18em]">
          <Link href="/dashboard/audits" className="nk-primary-btn">
            View audit report
          </Link>
          <Link href="/dashboard" className="nk-ghost-btn">
            Go to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
