import Link from "next/link";

type GuideCTAProps = {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
};

export function GuideCTA({
  title = "Find what is blocking your Airbnb bookings",
  description = "Norixo analyzes your listing, pricing, description, photos, and market positioning to reveal the highest-impact improvements.",
  href = "/analyze",
  label = "Start an Airbnb listing audit",
}: GuideCTAProps) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-3xl bg-[#10231F] p-8 text-white md:p-10">
        <h2 className="text-3xl font-semibold">{title}</h2>
        <p className="mt-4 max-w-2xl leading-7 text-white/80">
          {description}
        </p>
        <Link
          href={href}
          className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#10231F]"
        >
          {label}
        </Link>
      </div>
    </section>
  );
}
