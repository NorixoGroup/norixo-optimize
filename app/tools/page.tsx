import Link from "next/link";
import { tools } from "@/data/tools";

export const metadata = {
  title: "Free Airbnb Tools & Calculators | Norixo",
  description:
    "Free Airbnb tools and calculators for ADR, occupancy, RevPAR, revenue, pricing, and profit.",
  alternates: {
    canonical: "https://norixo.io/tools",
  },
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
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="rounded-3xl border border-[#10231F]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold">{tool.title}</h2>
              <p className="mt-3 leading-7 text-[#4C5C55]">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
