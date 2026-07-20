import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { articles } from "@/data/articles";

export const metadata = {
  title: "Airbnb Optimization Articles | Norixo",
  description:
    "Explore editorial Airbnb optimization articles about SEO, ranking, pricing, conversion, listing strategy, and market questions.",
  alternates: buildHreflangAlternates("/articles", { locales: [defaultLocale] }),
};

export default function ArticlesHubPage() {
  const articleClusterCount = new Set(articles.map((article) => article.cluster))
    .size;

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb topical authority
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Optimization Articles
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Practical editorial analysis about Airbnb SEO, ranking, visibility,
          pricing, listing optimization, and booking conversion.
        </p>

        <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
          Use this hub when you want to explore a focused question, compare
          strategic angles, or understand why a specific Airbnb topic matters
          before you move into a guide, report, or tool.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#10231F]">
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {articles.length} editorial articles
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {articleClusterCount} topic clusters
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Durable analysis, not live news
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">How to use the articles hub</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                01
              </p>
              <h3 className="mt-3 text-xl font-semibold">Explore a question</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Start with the specific issue you want to understand better:
                ranking, pricing pressure, visibility, guest behavior, or
                conversion.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                02
              </p>
              <h3 className="mt-3 text-xl font-semibold">Compare the angles</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Use the cluster labels and summaries to distinguish between
                tactical topics, broader strategy questions, and supporting
                market context.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                03
              </p>
              <h3 className="mt-3 text-xl font-semibold">Go deeper where needed</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Move into a guide for step-by-step execution, a report for local
                context, or a tool when you need an indicative calculation.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-[#EFF6FF] p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            How Norixo builds these resources
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Editorial analysis for short-term rental professionals</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            The articles hub is used for focused editorial analysis. These
            pages help explain targeted Airbnb questions, recurring strategic
            issues, and the logic behind common optimization choices.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            Articles are not presented as live news or real-time market feeds.
            When a topic needs direct action or validation, the content should
            be paired with a guide, a market report, a tool, or a listing
            audit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Browse all articles</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Use the article list below to explore specific topics, then follow
            the connected resources that best match the type of decision you
            need to make.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                {article.cluster}
              </p>
              <h3 className="mt-3 text-xl font-semibold">{article.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {article.description}
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
              Move from editorial analysis to step-by-step implementation when
              you need a clearer method for improving a listing.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">View market reports</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Add market-level pricing, trust, and competition context when the
              topic depends on where the listing actually operates.
            </p>
          </Link>
          <Link
            href="/tools"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Use free tools</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Test an assumption quickly with an indicative calculator before
              you change pricing, revenue targets, or occupancy expectations.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
