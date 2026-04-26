import Link from "next/link";
import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo-optimize.vercel.app").replace(
  /\/$/,
  ""
);

const pageTitle = "Booking.com listing optimization | Listing Conversion Optimizer";
const pageDescription =
  "Improve your Booking.com property listing for higher conversion: clearer positioning, stronger photos, and fixes guests notice before they book.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: `${siteUrl}/booking-optimization`,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: `${siteUrl}/booking-optimization`,
    type: "website",
    locale: "en_US",
    siteName: "Listing Conversion Optimizer",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: pageTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/og-cover.png"],
  },
};

export default function BookingOptimizationPage() {
  return (
    <MarketingPageShell>
      <main className="nk-section space-y-12 md:space-y-14">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] nk-border bg-[radial-gradient(circle_at_0_0,rgba(251,146,60,0.10),transparent_58%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.10),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.98)_100%)] p-6 shadow-[0_18px_52px_rgba(15,23,42,0.12)] md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500">
            Booking.com · Conversion
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Optimize your Booking.com listing for more qualified bookings
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
            Guests decide in seconds. Norixo Optimize audits how your property reads on Booking.com—photos,
            copy, amenities, and trust—and ranks what to fix first.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/audit/new"
              className="nk-primary-btn text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Run your listing audit
            </Link>
            <p className="text-xs leading-5 text-slate-500">
              Paste your listing URL. Same workflow as Airbnb—built for conversion clarity.
            </p>
          </div>
        </section>

        {/* Why */}
        <section className="nk-card nk-card-hover p-6 md:p-8" aria-labelledby="why-heading">
          <h2 id="why-heading" className="nk-section-title">
            Why Booking.com optimization matters
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-700">
            On Booking.com, travelers compare dozens of properties with similar rates. Small gaps—weak cover
            photos, vague room descriptions, missing filters, or inconsistent amenities—push clicks to
            competitors before anyone reads your full story.
          </p>
        </section>

        {/* Friction */}
        <section className="grid gap-6 md:grid-cols-2" aria-labelledby="friction-heading">
          <div className="nk-card nk-card-hover p-6">
            <h2 id="friction-heading" className="nk-section-title">
              Common friction points
            </h2>
            <ul className="mt-4 space-y-3 text-[13px] leading-6 text-slate-700">
              <li>• Cover image and gallery order that do not show the property&apos;s best proof.</li>
              <li>• Titles and opening lines that sound generic or do not match guest intent.</li>
              <li>• Amenities and policies that are easy to misread or incomplete vs. filters guests use.</li>
              <li>• Weak trust signals where reviews, photos, and copy do not line up.</li>
            </ul>
          </div>
          <div className="nk-card nk-card-hover p-6">
            <h2 className="nk-section-title">What you get with Norixo Optimize</h2>
            <ul className="mt-4 space-y-3 text-[13px] leading-6 text-slate-700">
              <li>• A structured audit: scores, gaps, and prioritized actions—not a vague checklist.</li>
              <li>• Clear language on what to change first so your listing earns the next click.</li>
              <li>• A workflow built for hosts and operators who manage real revenue, not experiments.</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/audit/new"
                className="inline-flex rounded-2xl bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:-translate-y-[1px] hover:brightness-105"
              >
                Start with an audit
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="nk-card nk-card-hover p-6 md:p-8" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="nk-section-title">
            Short answers
          </h2>
          <dl className="mt-6 space-y-6 text-sm text-slate-800">
            <div>
              <dt className="font-semibold text-slate-900">Does this replace my Booking.com account tools?</dt>
              <dd className="mt-2 text-[13px] leading-6 text-slate-700">
                No. It complements them with an outside-in view of how your listing reads to guests—and what to
                improve first for conversion.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Do I need an Airbnb URL?</dt>
              <dd className="mt-2 text-[13px] leading-6 text-slate-700">
                Norixo Optimize works from your listing URL. Use your Booking.com property link when you run the
                audit.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Is this only for hotels?</dt>
              <dd className="mt-2 text-[13px] leading-6 text-slate-700">
                It applies to any property type on Booking.com where photos, copy, and clarity drive the booking
                decision.
              </dd>
            </div>
          </dl>
        </section>

        {/* Final CTA */}
        <section
          className="nk-card nk-card-hover flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
          aria-labelledby="final-cta-heading"
        >
          <div className="max-w-xl">
            <h2 id="final-cta-heading" className="text-base font-semibold text-slate-900 md:text-lg">
              Ready to tighten your Booking.com listing?
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              Run one audit, see your scores, and leave with a clear order of fixes.
            </p>
          </div>
          <Link
            href="/audit/new"
            className="nk-primary-btn shrink-0 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Run your listing audit
          </Link>
        </section>
      </main>
    </MarketingPageShell>
  );
}
