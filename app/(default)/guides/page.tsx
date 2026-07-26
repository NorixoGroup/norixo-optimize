import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { guides } from "@/data/guides";

const socialImage = "/og/airbnb-optimization-guides.png";

export const metadata = {
  title: "Airbnb Optimization Guides | Norixo",
  description:
    "Explore step-by-step Airbnb optimization guides about SEO, pricing, photos, conversion, listing quality, and audit preparation.",
  alternates: buildHreflangAlternates("/guides", { locales: [defaultLocale] }),
  openGraph: {
    title: "Airbnb Optimization Guides | Norixo",
    description:
      "Explore step-by-step Airbnb optimization guides about SEO, pricing, photos, conversion, listing quality, and audit preparation.",
    url: "/guides",
    siteName: "Norixo",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Airbnb Optimization Guides",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Airbnb Optimization Guides | Norixo",
    description:
      "Explore step-by-step Airbnb optimization guides about SEO, pricing, photos, conversion, listing quality, and audit preparation.",
    images: [socialImage],
  },
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
          descriptions, ranking, and conversion with practical resources built
          for hosts and property managers who want clear next steps.
        </p>

        <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
          This hub is designed for durable, structured topics. Use it when you
          want to understand a method, work through a problem step by step, and
          then apply the same logic to your own listing.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#10231F]">
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {guides.length} step-by-step guides
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Built for hosts and managers
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Durable optimization topics
          </span>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            Audit my Airbnb listing
          </Link>
          <Link
            href="/reports"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            View market reports
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">How to use the guides hub</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                01
              </p>
              <h3 className="mt-3 text-xl font-semibold">Choose the topic</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Start with the subject that is blocking performance most:
                pricing, SEO, photos, conversion, trust, or listing structure.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                02
              </p>
              <h3 className="mt-3 text-xl font-semibold">Follow the method</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Use the sections and FAQs on each page to understand the logic
                behind the topic before you change your listing.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                03
              </p>
              <h3 className="mt-3 text-xl font-semibold">Apply and compare</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Move from the guide to a market report, a tool, or a full audit
                when you need market context or listing-specific validation.
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
          <h2 className="mt-3 text-3xl font-semibold">Practical guidance, not generic filler</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            The guides hub is organized around durable short-term rental topics
            such as SEO, pricing, photos, conversion, and listing quality.
            Each detail page is structured into clear sections with related FAQs
            and adjacent resources.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            These pages are educational resources. They help you understand a
            method and apply it more carefully, but they do not replace
            market-specific context or a personalized audit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Browse all guides</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            These guides are meant to be read as working resources. Start with
            the topic that matches your current bottleneck, then continue into
            reports, articles, or tools when you need more context.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">{guide.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-3xl font-semibold">Explore related resource hubs</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Link
            href="/articles"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Explore articles</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Go deeper into targeted Airbnb questions, strategy debates, and
              editorial analysis around ranking, pricing, and conversion.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">View market reports</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Add city-level market context when you need pricing signals,
              competition angles, and guest expectation summaries.
            </p>
          </Link>
          <Link
            href="/tools"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Use free tools</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Run quick calculations for ADR, occupancy, RevPAR, revenue, and
              pricing inputs before making larger listing decisions.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
