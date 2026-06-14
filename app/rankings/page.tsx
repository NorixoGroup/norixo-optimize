import Link from "next/link";
import { rankings } from "@/data/rankings";

export const metadata = {
  title: "Airbnb Rankings & Market Guides | Norixo",
  description:
    "Explore Airbnb rankings for the best cities, countries, markets, family destinations, and short-term rental optimization opportunities.",
  alternates: {
    canonical: "https://norixo.io/rankings",
  },
};

export default function RankingsHubPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market rankings
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Rankings & Market Guides
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Explore high-potential Airbnb cities, countries, and markets where
          pricing, listing quality, SEO, and conversion strategy can make a real
          difference.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Audit my Airbnb listing
          </Link>
          <Link
            href="/guides"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            Read Airbnb guides
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {rankings.map((ranking) => (
            <Link
              key={ranking.slug}
              href={`/rankings/${ranking.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{ranking.title}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {ranking.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
