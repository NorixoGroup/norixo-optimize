"use client";

import { useState } from "react";
import Link from "next/link";

export default function AnalyzeListingPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setHasPreview(false);

    // Simulate an audit run; in real usage this would call an API.
    setTimeout(() => {
      setIsLoading(false);
      setHasPreview(true);
    }, 1200);
  }

  return (
    <main className="nk-section mx-auto max-w-3xl space-y-12 md:space-y-16">
      {/* Hero */}
      <section className="text-center">
        <p className="nk-kicker-muted">Listing Conversion Optimizer</p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          Analyze your Airbnb listing
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-700">
          Paste your listing URL and discover what prevents bookings: weak photos, missing
          trust signals, poor positioning or pricing gaps.
        </p>
      </section>

      {/* Input form */}
      <section className="nk-card nk-card-hover p-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-xl flex-col gap-4 text-sm text-slate-800"
        >
          <label className="text-left text-[13px] font-medium text-slate-700">
            Listing URL
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://airbnb.com/rooms/123456"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] outline-none ring-0 transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="nk-primary-btn flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Analyzing listing…" : "Run audit"}
            </button>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Free audit preview
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                No signup required
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Takes less than 10 seconds
              </span>
            </div>
          </div>
        </form>

        {/* Loading state */}
        {isLoading && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            <p>
              Analyzing listing… pulling competitors, evaluating photos and measuring
              conversion signals.
            </p>
          </div>
        )}
      </section>

      {/* Preview results */}
      <section className="nk-card nk-card-hover p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="nk-section-title">Audit preview</p>
            <h2 className="mt-2 text-base font-semibold text-slate-900 md:text-lg">
              See the kind of insight you&apos;ll get.
            </h2>
          </div>
          {hasPreview && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Preview ready
            </span>
          )}
        </div>

        {hasPreview ? (
          <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Conversion Score
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-600">
                    6.2<span className="text-sm text-emerald-500"> / 10</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Below top competitors – strong upside after fixes.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Listing Quality Index
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    71<span className="text-sm text-slate-500"> / 100</span>
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700">Competitive with room to improve.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Top recommendations
                </p>
                <ul className="mt-3 space-y-1.5 text-[12px] leading-5 text-slate-800">
                  <li>• Improve first photo to highlight the main selling point.</li>
                  <li>• Expand description with clear benefits and trust signals.</li>
                  <li>• Add missing amenities guests expect at this price level.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  What this preview shows
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-700">
                  This is a mocked preview of the type of insights your real audit will
                  return. The full report goes deeper into competitors, photos, copy and
                  pricing.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[13px] leading-6 text-slate-600">
            Run a quick audit above to see a preview of your conversion score, Listing
            Quality Index and the kind of recommendations you&apos;ll receive.
          </p>
        )}
      </section>

      {/* Conversion gate */}
      <section className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">
            Unlock the full audit to see more.
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Go from a quick preview to the complete report with:
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700">
            <li>• Full competitor benchmark with comparable listings in your area.</li>
            <li>• Revenue upside estimate for your optimized listing.</li>
            <li>• Detailed improvement checklist you can apply step by step.</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <Link
            href="/sign-up"
            className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Create free account
          </Link>
        </div>
      </section>
    </main>
  );
}
