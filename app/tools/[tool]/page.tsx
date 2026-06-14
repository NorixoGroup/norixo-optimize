import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tools, getToolBySlug } from "@/data/tools";
import { guides } from "@/data/guides";
import { buildToolMetadata } from "@/lib/seo/buildToolMetadata";
import EEAT from "@/components/seo/EEAT";
import Calculator from "@/components/tools/Calculator";

type Props = {
  params: Promise<{
    tool: string;
  }>;
};

export function generateStaticParams() {
  return tools.map((tool) => ({
    tool: tool.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return {};
  }

  return buildToolMetadata(tool);
}

export default async function ToolPage({ params }: Props) {
  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const relatedGuides = guides.filter((guide) =>
    tool.relatedGuides.includes(guide.slug)
  );

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.title,
      description: tool.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `https://norixo.io/tools/${tool.slug}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faq.map((item) => ({
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
          <Link href="/tools" className="hover:text-[#10231F]">
            Tools
          </Link>
          <span className="mx-2">/</span>
          <span>{tool.title}</span>
        </nav>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Free Airbnb calculator
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {tool.heroTitle}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4C5C55]">
          {tool.heroSubtitle}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <Calculator tool={tool} />
      </section>

      <section className="mx-auto max-w-5xl px-6">
        <EEAT updated="June 2026" />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-3xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {tool.faq.map((item) => (
            <details key={item.question} className="rounded-2xl bg-white p-5">
              <summary className="cursor-pointer font-semibold">
                {item.question}
              </summary>
              <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-semibold">Related Airbnb guides</h2>
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
        </div>
      </section>
    </main>
  );
}
