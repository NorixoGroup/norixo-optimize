"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResultContent() {
  const conversionScore = 6.4;
  const conversionScoreMax = 10;
  const lqiScore = 71;
  const lqiMax = 100;

  const scorePercent = (conversionScore / conversionScoreMax) * 100;
  const lqiPercent = (lqiScore / lqiMax) * 100;

  const searchParams = useSearchParams();
  const listingUrl = searchParams.get("url") ?? "";

  const recommendations = useMemo(
    () => [
      "Upgrade the first photo to showcase the main value of the property.",
      "Expand the description with clear benefits, social proof and stay scenarios.",
      "Add missing amenities guests expect at this price point (e.g. workspace, coffee, toiletries).",
      "Clarify pricing and fees so the total stay cost is transparent and reassuring.",
    ],
    []
  );

  useEffect(() => {
    try {
      const pendingAudit = {
        listingUrl,
        score: conversionScore,
        lqi: lqiScore,
        recommendations,
        createdAt: new Date().toISOString(),
      };

      window.localStorage.setItem("pendingAudit", JSON.stringify(pendingAudit));
    } catch (error) {
      console.warn("Failed to persist pending audit preview", error);
    }
  }, [listingUrl, conversionScore, lqiScore, recommendations]);

  return (
    <main className="nk-section mx-auto max-w-5xl space-y-10 md:space-y-14">
      {/* Score hero */}
      <section className="nk-card nk-card-hover p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="nk-kicker-muted">Audit preview</p>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
              Conversion Score for your listing
            </h1>
            <p className="text-[15px] leading-7 text-slate-700">
              This is a preview of your conversion performance based on photos, description,
              amenities and positioning. Create an account to unlock the full report.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 md:min-w-[220px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Conversion Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-emerald-600">
                {conversionScore.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500">/ {conversionScoreMax}</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Decent, but still below top-performing competitors in your area.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Conversion potential</span>
            <span className="font-medium text-emerald-600">{Math.round(scorePercent)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-600"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* LQI + recommendations */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="nk-card nk-card-hover p-6">
            <p className="nk-section-title">Listing Quality Index</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Overall quality snapshot</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-700">
                  Your Listing Quality Index combines visual appeal, information quality and
                  competitiveness. A higher score means your listing is easier to choose and trust.
                </p>
              </div>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right sm:mt-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  LQI
                </p>
                <div className="mt-1 flex items-baseline justify-end gap-1">
                  <span className="text-2xl font-semibold text-slate-900">{lqiScore}</span>
                  <span className="text-sm text-slate-500">/ {lqiMax}</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-700">Solid base with room to optimize.</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Quality positioning vs. ideal listing</span>
                <span className="font-medium text-slate-900">{lqiPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-400 via-orange-300 to-emerald-500"
                  style={{ width: `${lqiPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="nk-card nk-card-hover p-6">
            <p className="nk-section-title">Recommendations preview</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Here are a few examples of the improvements your full audit will highlight. The
              complete report contains a longer, prioritized checklist.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-800">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span>Upgrade the first photo to showcase the main value of the property.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span>Expand the description with clear benefits, social proof and stay scenarios.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span>Add missing amenities guests expect at this price point (e.g. workspace, coffee, toiletries).</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span>Clarify pricing and fees so the total stay cost is transparent and reassuring.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="nk-card nk-card-hover p-6">
            <p className="nk-section-title">What this preview shows</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              You are seeing a limited preview of the audit engine. The real report goes deeper
              into competitors, photo sequencing, copy, amenities and pricing to surface the
              biggest levers for more bookings.
            </p>
          </div>

          <div className="nk-card nk-card-hover flex flex-col justify-between gap-4 p-6">
            <div>
              <p className="nk-section-title">Unlock full audit</p>
              <h2 className="mt-2 text-base font-semibold text-slate-900 md:text-lg">
                Create a free account to see the complete report.
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">
                The full audit includes everything you need to reposition your listing and
                capture more revenue:
              </p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-slate-700">
                <li>• Competitor benchmark across similar listings in your area.</li>
                <li>• Revenue upside estimate based on your optimized Conversion Score.</li>
                <li>• Detailed optimization checklist grouped by photos, copy, amenities and pricing.</li>
              </ul>
            </div>

            <p className="mt-3 text-[12px] text-slate-600">
              Create a free account to unlock the full audit report and save your analysis.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 md:justify-between">
              <p className="text-[11px] text-slate-500">
                No credit card required. Designed for hosts, operators and conciergeries.
              </p>
              <Link
                href="/auth/signup"
                className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
              >
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
