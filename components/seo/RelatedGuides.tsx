import Link from "next/link";
import type { Guide } from "@/data/guides";

type RelatedGuidesProps = {
  guides: Guide[];
  currentSlug?: string;
  limit?: number;
};

export function RelatedGuides({
  guides,
  currentSlug,
  limit = 6,
}: RelatedGuidesProps) {
  const relatedGuides = guides
    .filter((guide) => guide.slug !== currentSlug)
    .slice(0, limit);

  if (relatedGuides.length === 0) {
    return null;
  }

  return (
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
  );
}
