import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { solutions, getSolutionBySlug } from "@/data/solutions";
import { guides } from "@/data/guides";
import { articles } from "@/data/articles";
import { rankings } from "@/data/rankings";
import { buildSolutionMetadata } from "@/lib/seo/buildSolutionMetadata";
import EEAT from "@/components/seo/EEAT";

function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Props = {
  params: Promise<{
    solution: string;
  }>;
};

export function generateStaticParams() {
  return solutions.map((solution) => ({
    solution: solution.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { solution: slug } = await params;
  const solution = getSolutionBySlug(slug);

  if (!solution) {
    return {};
  }

  return buildSolutionMetadata(solution);
}

export default async function SolutionPage({ params }: Props) {
  const { solution: slug } = await params;
  const solution = getSolutionBySlug(slug);

  if (!solution) {
    notFound();
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: solution.title,
      description: solution.description,
      url: `https://norixo.io/solutions/${solution.slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Norixo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Norixo helps Airbnb hosts audit listings, improve pricing, strengthen SEO, and identify conversion blockers.",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Norixo",
      url: "https://norixo.io",
    },
    ...(solution.faq
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: solution.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Norixo solutions
        </p>

        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          {solution.heroTitle}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {solution.heroSubtitle}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="rounded-full bg-[#10231F] px-6 py-3 text-sm font-semibold text-white"
          >
            {solution.cta}
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-[#10231F]/20 px-6 py-3 text-sm font-semibold"
          >
            View pricing
          </Link>
        </div>
      </section>

      {solution.sections && solution.sections.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
              Page overview
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              What this solution covers
            </h2>
            <nav className="mt-5 grid gap-3 md:grid-cols-2">
              {solution.sections.map((section) => (
                <a
                  key={section.title}
                  href={`#${slugifyHeading(section.title)}`}
                  className="rounded-2xl border border-[#10231F]/10 px-4 py-3 text-sm font-semibold hover:bg-[#FAF7F2]"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-semibold">Why this matters</h2>
          <p className="mt-5 leading-8 text-[#4C5C55]">{solution.intro}</p>
          <p className="mt-5 leading-8 text-[#4C5C55]">
            Norixo combines market context, pricing signals, listing quality,
            photo presentation, guest expectations, positioning and competitive
            intelligence to help hosts make better Airbnb decisions.
          </p>
        </div>
      </section>

      {solution.sections && solution.sections.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-semibold">
              How Norixo helps with {solution.title}
            </h2>
            <p className="mt-4 leading-7 text-[#4C5C55]">
              Explore the key optimization areas that influence visibility,
              trust, pricing power, and booking conversion.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {solution.sections.map((section) => (
              <article
                key={section.title}
                id={slugifyHeading(section.title)}
                className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold">{section.title}</h3>
                <p className="mt-4 leading-7 text-[#4C5C55]">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Audit</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Identify what may be limiting visibility, trust, pricing power, and
            booking conversion.
          </p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Improve</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Prioritize the changes that can improve photos, descriptions,
            pricing, amenities, and guest confidence.
          </p>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Grow</h2>
          <p className="mt-4 leading-7 text-[#4C5C55]">
            Turn stronger listing quality and market positioning into better
            booking performance.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Optimization checklist
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            What to improve first
          </h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              "Review pricing against local competitors",
              "Improve the first photo and gallery order",
              "Clarify title and main value proposition",
              "Strengthen description and guest reassurance",
              "Check amenities and filtered-search relevance",
              "Reduce booking hesitation with trust signals",
            ].map((item) => (
              <li key={item} className="rounded-2xl border border-[#10231F]/10 p-4 text-sm leading-6 text-[#4C5C55]">
                ✓ {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Related Airbnb guides</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {guides.slice(0, 6).map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{guide.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Related articles</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {articles.slice(0, 8).map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{article.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {article.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl font-semibold">Related Airbnb rankings</h2>
          <Link
            href="/rankings"
            className="text-sm font-semibold text-[#D96C3B] underline-offset-4 hover:underline"
          >
            Explore all Airbnb rankings and market guides
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rankings.slice(0, 6).map((ranking) => (
            <Link
              key={ranking.slug}
              href={`/rankings/${ranking.slug}`}
              className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold">{ranking.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
                {ranking.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {solution.faq && solution.faq.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-3xl font-semibold">Frequently asked questions</h2>

          <div className="mt-6 space-y-4">
            {solution.faq.map((item) => (
              <details key={item.question} className="rounded-2xl bg-white p-5">
                <summary className="cursor-pointer font-semibold">
                  {item.question}
                </summary>
                <p className="mt-3 leading-7 text-[#4C5C55]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <EEAT updated="June 2026" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
          <h2 className="text-3xl font-semibold">
            Start improving your Airbnb listing today
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/80">
            Run a Norixo audit to identify the pricing, photo, description,
            trust, and conversion issues that may be blocking bookings.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
          >
            Start an Airbnb audit
          </Link>
        </div>
      </section>
    </main>
  );
}
