import Link from "next/link";
import type { City } from "@/data/cities";

type RelatedCitiesProps = {
  cities: City[];
  title?: string;
  limit?: number;
};

export function RelatedCities({
  cities,
  title = "Explore Airbnb city optimizers",
  limit = 9,
}: RelatedCitiesProps) {
  const items = cities.slice(0, limit);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((city) => (
          <Link
            key={city.slug}
            href={`/airbnb-optimizer/${city.slug}`}
            className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="font-semibold">{city.name}</p>
            <p className="mt-2 text-sm text-[#5F6F68]">
              {city.country} · qualitative market guide
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
