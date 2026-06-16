import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { marketReports } from "@/data/marketReports";

export const metadata = {
  title: "Airbnb Market Reports | Norixo",
  description:
    "Explore Airbnb market reports with pricing, competition, guest expectations and listing optimization insights.",
  alternates: buildHreflangAlternates("/reports"),
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
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {marketReports.map((report) => (
            <Link
              key={report.slug}
              href={`/reports/${report.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{report.title}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {report.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
