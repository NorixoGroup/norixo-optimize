"use client";

import { useEffect, useState } from "react";
import { getMockIsPro, setMockIsPro } from "@/lib/mock-subscription";

export default function BillingPage() {
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    setIsPro(getMockIsPro());
  }, []);
  return (
    <div className="space-y-8">
      <div className="nk-card nk-card-hover nk-page-header-card py-7 md:py-9">
        <div className="space-y-2">
          <p className="nk-kicker-muted">BILLING</p>
          <h1 className="nk-heading-xl text-2xl font-semibold text-slate-900 md:text-3xl lg:text-4xl">
            Pricing
          </h1>
          <p className="nk-body-muted max-w-2xl text-[15px] leading-relaxed text-slate-700">
            Choose the plan that matches how many listings you want to optimize. You can start
            small and upgrade as you grow.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Starter */}
        <div className="nk-card nk-card-hover flex flex-col border-slate-200/90 bg-white p-6">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Starter
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">19€/month</p>
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-slate-800">
            <li className="ml-4 list-disc">5 audits</li>
            <li className="ml-4 list-disc">basic insights</li>
          </ul>
          <button
            type="button"
            className="mt-5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-sm transition hover:border-slate-400"
          >
            {isPro ? "Available" : "Current plan"}
          </button>
        </div>

        {/* Pro (highlighted) */}
        <div className="nk-card nk-card-hover relative flex flex-col border-emerald-300 bg-emerald-50 p-6 shadow-[0_20px_60px_rgba(16,185,129,0.25)]">
          <div className="absolute right-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            {isPro ? "Current plan" : "Most popular"}
          </div>
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Pro
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800">39€/month</p>
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-emerald-900">
            <li className="ml-4 list-disc">unlimited audits</li>
            <li className="ml-4 list-disc">optimized listing</li>
            <li className="ml-4 list-disc">revenue insights</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              if (!isPro) {
                setMockIsPro(true);
                setIsPro(true);
              }
            }}
            className="mt-5 nk-primary-btn w-full text-[11px] font-semibold uppercase tracking-[0.18em]"
          >
            {isPro ? "Pro active" : "Upgrade to Pro"}
          </button>
          <p className="mt-2 text-[11px] text-emerald-800">
            {isPro ? "You are on the Pro plan (mock)" : "Checkout coming soon"}
          </p>
        </div>

        {/* Scale */}
        <div className="nk-card nk-card-hover flex flex-col border-slate-200/90 bg-white p-6">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Scale
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">79€/month</p>
          </div>
          <ul className="mt-2 flex-1 space-y-2 text-sm leading-6 text-slate-800">
            <li className="ml-4 list-disc">multi listings</li>
            <li className="ml-4 list-disc">export</li>
            <li className="ml-4 list-disc">advanced insights</li>
          </ul>
          <a
            href="mailto:contact@listingconversionoptimizer.com"
            className="mt-5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-sm transition hover:border-slate-400"
          >
            Talk to us
          </a>
        </div>
      </div>
    </div>
  );
}