import Link from "next/link";
import { buildHreflangAlternates } from "@/lib/seo/hreflang";
import { defaultLocale } from "@/data/i18n";
import { tools } from "@/data/tools";

export const metadata = {
  title: "Free Airbnb Tools & Calculators | Norixo",
  description:
    "Free Airbnb tools and calculators for ADR, occupancy, RevPAR, revenue, pricing, and other indicative hosting decisions.",
  alternates: buildHreflangAlternates("/tools", { locales: [defaultLocale] }),
};

export default function ToolsHubPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Free Airbnb tools
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Airbnb Tools & Calculators
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          Use free Airbnb calculators to estimate ADR, occupancy, RevPAR,
          revenue, pricing targets and profit before optimizing your listing
          with Norixo.
        </p>

        <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
          This hub is for practical decision support. Use it when you want a
          quick formula-based output, then combine that result with a guide,
          report, or audit before making bigger pricing decisions.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#10231F]">
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            {tools.length} interactive tools
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Formula-based outputs
          </span>
          <span className="rounded-full border border-[#10231F]/10 bg-white px-4 py-2 font-semibold">
            Indicative, not financial advice
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">How to use the tools hub</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                01
              </p>
              <h3 className="mt-3 text-xl font-semibold">Pick the right calculator</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Choose the tool that matches the question you need to answer:
                ADR, occupancy, RevPAR, revenue, pricing, or profitability.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                02
              </p>
              <h3 className="mt-3 text-xl font-semibold">Enter your own numbers</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Each tool uses values you provide and shows the underlying
                formula on the detail page so the result stays transparent.
              </p>
            </article>
            <article className="rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
                03
              </p>
              <h3 className="mt-3 text-xl font-semibold">Interpret the result carefully</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                Treat every output as an indicative aid, then add market and
                listing context before you translate it into action.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl bg-[#ECFDF5] p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            How Norixo builds these resources
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Transparent formulas for hosting decisions</h2>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            The tools hub is made of practical calculators for short-term
            rental questions. Each tool page explains the formula used and lets
            you test a scenario with your own inputs.
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-[#4C5C55]">
            These outputs are indicative. They are meant to support reasoning,
            not to guarantee revenue, profitability, or market performance on
            their own.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold">Browse all tools</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Choose the calculator that matches your question, then continue
            into guides or market reports if you need deeper context before you
            act on the result.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold">{tool.title}</h3>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {tool.description}
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
              Learn how to act on the numbers once you understand what the
              calculator output is really telling you.
            </p>
          </Link>
          <Link
            href="/articles"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">Explore editorial articles</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Add broader strategy context when a number alone is not enough to
              decide how aggressive your next move should be.
            </p>
          </Link>
          <Link
            href="/reports"
            className="rounded-2xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-xl font-semibold">View market reports</h3>
            <p className="mt-3 leading-7 text-[#4C5C55]">
              Compare a formula output with city-level pricing and competition
              context before you make a stronger assumption.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
