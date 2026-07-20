import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { marketReports } from "@/data/marketReports";

export const metadata = {
  title: "Airbnb Market Reports | Norixo",
  description:
    "Explore Airbnb market reports with city-level pricing context, competition signals, guest expectations, and listing optimization insights.",
  alternates: buildHreflangAlternates("/reports", { locales: [defaultLocale] }),
};

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market intelligence
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Market Reports
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Explore market-level Airbnb insights for pricing, competition,
          listing quality and guest expectations.
        </p>

        <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
          This hub is for geographic context. Use it when you want to compare
          markets, understand city-level positioning signals, and frame a
          listing decision against published market information.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#10231F]">
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {marketReports.length} published market reports
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            City-level market context
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Not presented as real-time data
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">How to use the reports hub</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                01
              </p>
              <h3 className="mt-3 text-xl font-semibold">Choose the market</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Start with the city you want to understand better before you
                compare its pricing context, competition, and guest
                expectations.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                02
              </p>
              <h3 className="mt-3 text-xl font-semibold">Read the context and limits</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Use the report to frame a market, not to replace a listing
                audit. These pages summarize published context rather than live
                inventory or personalized advice.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                03
              </p>
              <h3 className="mt-3 text-xl font-semibold">Compare and continue</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Move into guides, tools, or a full audit when you need a method
                to act on the market information you have just reviewed.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-[#FFF7ED] p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            How Norixo builds these resources
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Published market context with visible limits</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            The reports hub summarizes city-level market context from the
            published datasets used across Norixo market pages. Report detail
            pages expose the reference values and narrative context shown for
            each market.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            These reports are designed to help frame a market. They are not
            presented as real-time feeds, investment guarantees, or a
            substitute for listing-specific analysis.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Browse all reports</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Start with the city that matters to you most, then use related
            guides, tools, and optimizer pages to turn high-level market
            context into clearer decisions.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {marketReports.map((report) => (
            <Link
              key={report.slug}
              href={`/reports/${report.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">{report.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {report.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-3xl font-semibold">Explore related resource hubs</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Link
            href="/guides"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Read practical guides</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Turn market context into concrete listing changes with
              step-by-step guides on pricing, photos, SEO, and conversion.
            </p>
          </Link>
          <Link
            href="/articles"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Explore editorial articles</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Add broader Airbnb strategy context when a market question leads
              into ranking, visibility, or performance trade-offs.
            </p>
          </Link>
          <Link
            href="/tools"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Use free tools</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Run indicative calculators for ADR, occupancy, RevPAR, and
              revenue when you want to pressure-test your assumptions.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
