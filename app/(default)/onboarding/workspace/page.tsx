import Link from "next/link";

export default function OnboardingWorkspacePage() {
  return (
    <main className="nk-section space-y-16 md:space-y-20">
      {/* Header / intro */}
      <section className="nk-page-header-card">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="nk-kicker">Onboarding</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Set up your workspace
            </h1>
            <p className="text-[15px] leading-7 text-slate-200">
              Your workspace is where you&apos;ll organize listings, audits and performance
              data. A clear setup makes it easier to understand which assets are driving
              bookings across your portfolio.
            </p>
          </div>
          <div className="max-w-sm rounded-2xl border border-slate-700/50 bg-slate-950/70 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Why this matters
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              Think of your workspace as the home for a group of listings: a brand, a
              building, a city or a client portfolio. You can add more later, but we&apos;ll
              start with one.
            </p>
          </div>
        </div>
      </section>

      {/* Workspace form card */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="nk-card nk-card-hover p-6 md:p-8">
          <p className="nk-section-title">Workspace details</p>
          <p className="mt-2 text-sm text-slate-300">
            This information helps Listing Conversion Optimizer tailor insights to the way
            you operate.
          </p>

          <form className="mt-6 space-y-5 text-sm text-slate-200">
            <div className="space-y-2">
              <label htmlFor="workspace-name" className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Workspace name
              </label>
              <input
                id="workspace-name"
                name="workspace-name"
                type="text"
                placeholder="e.g. Medina Riads, Paris Portfolio, Sunset Villas"
                className="nk-input w-full placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-400">
                Use something you and your team will recognize at a glance.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="portfolio-type" className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Portfolio type
              </label>
              <select
                id="portfolio-type"
                name="portfolio-type"
                className="nk-select w-full text-sm text-slate-100"
                defaultValue=""
              >
                <option value="" disabled>
                  Select portfolio type
                </option>
                <option value="host">Host</option>
                <option value="property-manager">Property manager</option>
                <option value="conciergerie">Conciergerie</option>
                <option value="investor">Investor</option>
              </select>
              <p className="text-[11px] text-slate-400">
                This helps us frame recommendations for individual hosts vs. operators.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="listing-count" className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Approximate number of listings
              </label>
              <input
                id="listing-count"
                name="listing-count"
                type="number"
                min={1}
                placeholder="e.g. 1, 5, 20, 50+"
                className="nk-input w-full placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-400">
                A rough number is enough. It helps choose the right starting plan and
                dashboard views.
              </p>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70 pt-5 text-xs">
            <p className="text-[11px] text-slate-400">
              This is a mock setup step. Values are not yet saved to a real database.
            </p>
          </div>
        </div>

        {/* Helpful setup note */}
        <aside className="nk-card nk-card-hover flex flex-col justify-between p-6 md:p-8">
          <div className="space-y-3 text-sm text-slate-200">
            <p className="nk-section-title">Helpful setup note</p>
            <p className="text-[13px] leading-6 text-slate-300">
              If you manage several distinct portfolios (for example &quot;personal listings&quot; and
              &quot;client listings&quot;), you can mirror that structure with multiple workspaces
              later.
            </p>
            <p className="text-[13px] leading-6 text-slate-300">
              For now, choose the scope where you most want to improve bookings. You&apos;ll add
              listings under this workspace in the next step.
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 text-[12px] text-slate-300">
            <p className="font-medium text-slate-200">Tip</p>
            <p className="mt-1 leading-6">
              Many users start with the one property or portfolio they&apos;re most worried
              about, get an audit, then roll out improvements to the rest.
            </p>
          </div>
        </aside>
      </section>

      {/* Continue CTA */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-white md:text-2xl">
            Continue to adding your first listing
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-300">
            Once your workspace is defined, the next step is to paste a listing URL so we
            can generate your first audit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end text-xs font-semibold uppercase tracking-[0.18em]">
          <Link href="/onboarding/welcome" className="nk-ghost-btn">
            Back
          </Link>
          <Link href="/dashboard/listings/new" className="nk-primary-btn">
            Continue
          </Link>
        </div>
      </section>
    </main>
  );
}
