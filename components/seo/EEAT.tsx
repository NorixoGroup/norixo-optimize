type Props = {
  updated?: string;
};

export default function EEAT({
  updated = "June 2026",
}: Props) {
  return (
    <section className="mt-16 rounded-3xl border border-[#10231F]/10 bg-white p-8 shadow-sm">
      <div className="grid gap-8 md:grid-cols-2">

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            About this content
          </p>

          <h2 className="mt-3 text-2xl font-semibold">
            Research & methodology
          </h2>

          <p className="mt-4 leading-7 text-[#4C5C55]">
            This content is based on Airbnb optimization principles,
            market analysis, pricing research, listing quality
            evaluation, competitive benchmarking and practical
            short-term rental experience.
          </p>

          <ul className="mt-6 space-y-2 text-sm text-[#4C5C55]">
            <li>• Updated: {updated}</li>
            <li>• Reviewed by the Norixo research team</li>
            <li>• Continuously improved as market data evolves</li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            About Norixo
          </p>

          <h2 className="mt-3 text-2xl font-semibold">
            Airbnb optimization platform
          </h2>

          <p className="mt-4 leading-7 text-[#4C5C55]">
            Norixo helps Airbnb hosts analyze pricing,
            listing quality, photos, positioning,
            guest confidence and booking performance
            through data-driven audits.
          </p>

          <div className="mt-6 rounded-2xl bg-[#FAF7F2] p-5">
            <p className="font-semibold">
              Independent research
            </p>

            <p className="mt-2 text-sm leading-6 text-[#4C5C55]">
              Our educational resources are designed to help
              hosts make better optimization decisions using
              transparent methodology and practical guidance.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
