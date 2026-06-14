import Link from "next/link";
import { articles } from "@/data/articles";

export const metadata = {
  title: "Airbnb Optimization Articles | Norixo",
  description:
    "Explore Airbnb optimization articles about SEO, ranking, visibility, pricing, photos, conversion, and listing performance.",
  alternates: {
    canonical: "https://norixo.io/articles",
  },
};

export default function ArticlesHubPage() {
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
          Practical articles about Airbnb SEO, ranking, visibility, listing
          optimization, pricing, and booking conversion.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
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
              <h2 className="mt-3 text-xl font-semibold">{article.title}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {article.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
