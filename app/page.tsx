import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-24 pt-10 md:px-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-sm font-semibold text-emerald-300">
            LCO
          </div>
          <span className="text-sm font-medium text-neutral-300">
            Listing Conversion Optimizer
          </span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/sign-in"
            className="rounded-full border border-neutral-800 px-4 py-1.5 text-neutral-200 transition hover:border-neutral-500 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-emerald-300"
          >
            Start free audit
          </Link>
        </nav>
      </header>

      <section className="mt-20 grid gap-16 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start">
        <div className="space-y-8">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
            Turn cold scrollers into
            <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
              {" "}
              booked guests.
            </span>
          </h1>
          <p className="max-w-xl text-balance text-sm leading-relaxed text-neutral-300 sm:text-base">
            Listing Conversion Optimizer audits your Airbnb and short–term rental
            listings for photo flow, copy, amenities, SEO, and conversion. No pricing
            games—just clear recommendations to turn more views into bookings.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/sign-up"
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-emerald-300"
            >
              Run my first audit →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-neutral-800 px-4 py-2 text-neutral-200 transition hover:border-neutral-500 hover:text-white"
            >
              View demo dashboard
            </Link>
          </div>

          <div className="mt-6 grid gap-4 text-sm text-neutral-300 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Single Audit
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">€9</div>
              <p className="mt-2 text-xs text-neutral-400">One-off deep dive for a single listing.</p>
            </div>
            <div className="rounded-xl border border-emerald-500/60 bg-neutral-900/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Concierge
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">€39/mo</div>
              <p className="mt-2 text-xs text-neutral-300">
                Includes 5 listings. Extra listing: €4. Designed for pro hosts.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Focused on Conversion
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Not a pricing tool. We exist purely to improve photos, copy, and
                conversion levers so more views become bookings.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-sm text-neutral-100 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                MVP Flow
              </div>
              <div className="text-sm font-medium text-white">How it works</div>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              Mock data
            </span>
          </div>
          <ol className="space-y-2 text-xs text-neutral-300">
            <li>1. Sign up or sign in.</li>
            <li>2. Paste a public listing URL.</li>
            <li>3. We create a mock listing in the dashboard.</li>
            <li>4. A mock audit runs instantly using AI placeholders.</li>
            <li>5. You see an actionable report: scores, strengths, weaknesses, and a rewritten opening paragraph.</li>
          </ol>
          <p className="mt-4 text-xs text-neutral-400">
            In this MVP, everything runs locally with mock data. Supabase, Stripe,
            and OpenAI are stubbed so you can plug in real infrastructure later.
          </p>
        </div>
      </section>
    </main>
  );
}
