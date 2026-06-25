import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { guides } from "@/data/guides";

export const metadata = {
  title: "Airbnb Optimization Guides | Norixo",
  description:
    "Explore Norixo guides for Airbnb SEO, listing optimization, pricing, audits, ranking, photos, titles, descriptions, and revenue growth.",
  alternates: buildHreflangAlternates("/guides", { locales: [defaultLocale] }),
};

export default function GuidesHubPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb optimization resources
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Optimization Guides
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Learn how to improve Airbnb SEO, pricing, photos, titles,
          descriptions, ranking, conversion, and revenue with practical guides
          built for hosts and property managers.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Audit my Airbnb listing
          </Link>
          <Link
            href="/countries"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            Explore country markets
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{guide.title}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
