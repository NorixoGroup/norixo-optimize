import Link from "next/link";
import type { Country } from "@/data/countries";

type RelatedCountriesProps = {
  countries: Country[];
  limit?: number;
};

export function RelatedCountries({
  countries,
  limit = 6,
}: RelatedCountriesProps) {
  const items = countries.slice(0, limit);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h2 className="text-2xl font-semibold">Explore Airbnb markets by country</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((country) => (
          <Link
            key={country.slug}
            href={`/countries/${country.slug}`}
            className="rounded-2xl border border-[#10231F]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
              {country.continent}
            </p>
            <p className="mt-2 font-semibold">{country.name}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
