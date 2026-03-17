import Link from "next/link";

export default function OnboardingSuccessPage() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* Success hero */}
      <section className="nk-page-header-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="nk-kicker">Onboarding complete</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Your workspace is ready
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              You&apos;ve completed setup and your first listing audit is ready to explore.
              From here, you can review your report, add more listings and start improving
              booking performance.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-base font-semibold text-slate-950">
                ✓
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Setup complete
                </p>
                <p className="mt-1 text-[13px] leading-6 text-emerald-50">
                  You&apos;re ready to use Listing Conversion Optimizer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is ready block */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">What is ready</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Your account now has everything needed for you to start making better decisions
          about your short-term rental portfolio.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold">
                ✓
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Workspace created</p>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              A dedicated workspace is set up to organize your listings, audits and
              performance data.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold">
                ✓
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Listing added</p>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Your first short-term rental listing is connected and ready for ongoing
              optimization.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold">
                ✓
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">First audit generated</p>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              An initial conversion audit is ready so you can see strengths, gaps and
              high-impact opportunities.
            </p>
          </div>
        </div>
      </section>

      {/* Suggested next actions */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <p className="nk-section-title">Suggested next actions</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          To get the most value from Listing Conversion Optimizer in the next few minutes,
          we recommend starting with these steps.
        </p>
        <div className="mt-5 grid gap-4 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              1. Review your first report
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Open the audit to see your conversion score, potential score and the
              prioritized list of recommended changes.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              2. Add more listings
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Add other key properties so you can compare performance and spot patterns
              across your portfolio.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              3. Explore the dashboard
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Use the dashboard to track audits, follow progress over time and focus on the
              listings with the biggest upside.
            </p>
          </div>
        </div>
      </section>

      {/* CTA block */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Jump into your workspace
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Start by exploring your first audit, then roll out improvements and new
            listings as you go.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end text-xs font-semibold uppercase tracking-[0.18em]">
          <Link href="/dashboard" className="nk-primary-btn">
            Go to dashboard
          </Link>
          <Link href="/dashboard/audits" className="nk-ghost-btn">
            View first audit
          </Link>
        </div>
      </section>
    </main>
  );
}
