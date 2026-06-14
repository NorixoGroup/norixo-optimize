import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { rankings, getRankingBySlug } from "@/data/rankings";
import { buildRankingMetadata } from "@/lib/seo/buildRankingMetadata";

type Props = {
  params: Promise<{
    ranking: string;
  }>;
};

export function generateStaticParams() {
  return rankings.map((ranking) => ({
    ranking: ranking.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ranking: slug } = await params;
  const ranking = getRankingBySlug(slug);

  if (!ranking) {
    return {};
  }

  return buildRankingMetadata(ranking);
}

export default async function RankingPage({ params }: Props) {
  const { ranking: slug } = await params;
  const ranking = getRankingBySlug(slug);

  if (!ranking) {
    notFound();
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: ranking.title,
      description: ranking.description,
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
        "@id": `https://norixo.io/rankings/${ranking.slug}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: ranking.title,
      itemListElement: ranking.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        description: item.description,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ranking.faq.map((item) => ({
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
          <Link href="/rankings" className="hover:text-[#10231F]">
            Rankings
          </Link>
          <span className="mx-2">/</span>
          <span>{ranking.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Airbnb market ranking
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {ranking.heroTitle}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {ranking.heroSubtitle}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-lg leading-8 text-[#4C5C55]">{ranking.intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-5">
          {ranking.items.map((item, index) => {
            const href = item.citySlug
              ? `/airbnb-optimizer/${item.citySlug}`
              : item.countrySlug
                ? `/countries/${item.countrySlug}`
                : "/rankings";

            return (
              <Link
                key={`${item.name}-${index}`}
                href={href}
                className="block rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-[#D96C3B]">
                  #{index + 1}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{item.name}</h2>
                <p className="mt-3 leading-7 text-[#4C5C55]">
                  {item.description}
                </p>
                <p className="mt-4 text-sm leading-6 text-[#5F6F68]">
                  <strong>Why it matters:</strong> {item.reason}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>

        <div className="mt-6 space-y-4">
          {ranking.faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
          <h2 className="text-3xl font-semibold">
            Improve your Airbnb listing before competitors do
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-white/80">
            Use Norixo to audit your listing, pricing, photos, description, and
            market positioning.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
          >
            Start an Airbnb listing audit
          </Link>
        </div>
      </section>
    </main>
  );
}
