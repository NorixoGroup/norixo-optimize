import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { articles, getArticleBySlug } from "@/data/articles";
import { guides } from "@/data/guides";
import { rankings } from "@/data/rankings";
import { buildArticleMetadata } from "@/lib/seo/buildArticleMetadata";
import EEAT from "@/components/seo/EEAT";

type Props = {
  params: Promise<{
    article: string;
  }>;
};

export function generateStaticParams() {
  return articles.map((article) => ({
    article: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {};
  }

  return buildArticleMetadata(article);
}

export default async function ArticlePage({ params }: Props) {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedGuides = guides.filter((guide) =>
    article.relatedGuides.includes(guide.slug)
  );

  const relatedRankings = rankings.filter((ranking) =>
    article.relatedRankings.includes(ranking.slug)
  );

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      author: {
        "@type": "Organization",
        name: "Norixo",
      },
      publisher: {
        "@type": "Organization",
        name: "Norixo",
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `https://norixo.io/articles/${article.slug}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: article.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#10231F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <nav className="mb-8 text-sm text-[#5F6F68]">
          <Link href="/" className="hover:text-[#10231F]">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/articles" className="hover:text-[#10231F]">
            Articles
          </Link>
          <span className="mx-2">/</span>
          <span>{article.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          {article.cluster}
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {article.heroTitle}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {article.heroSubtitle}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-lg leading-8 text-[#4C5C55]">{article.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          {article.sections.map((section) => (
            <article key={section.title} className="rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="mt-4 leading-8 text-[#4C5C55]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {article.faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
          <h2 className="text-3xl font-semibold">
            Audit your Airbnb listing with Norixo
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/80">
            Find the pricing, photo, description, trust, and ranking signals
            that may be blocking your bookings.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
          >
            Start an Airbnb audit
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-semibold">Continue learning</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {relatedGuides.map((guide) => (
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

          {relatedRankings.map((ranking) => (
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
    </main>
  );
}
