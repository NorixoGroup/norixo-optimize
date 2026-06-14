import Link from "next/link";
import { solutions } from "@/data/solutions";

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
          Norixo Solutions
        </p>

        <h1 className="text-5xl font-semibold tracking-tight">
          Airbnb Optimization Solutions
        </h1>

        <p className="mt-6 max-w-3xl text-lg text-[#4C5C55]">
          Discover Norixo solutions designed to improve Airbnb SEO,
          pricing, listing quality, conversion, revenue and overall
          booking performance.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {solutions.map((solution) => (
            <Link
              key={solution.slug}
              href={`/solutions/${solution.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <h2 className="text-2xl font-semibold">
                {solution.title}
              </h2>

              <p className="mt-4 leading-7 text-[#5F6F68]">
                {solution.description}
              </p>

              <span className="mt-6 inline-block font-semibold text-[#D96C3B]">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
