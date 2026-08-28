import Link from "next/link";

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
            Research, methodology & review
          </h2>

          <p className="mt-4 leading-7 text-[#4C5C55]">
            Norixo educational content combines listing-analysis principles,
            market context, pricing research, listing-quality evaluation and
            competitive benchmarking. Public research should be read with the
            scope, freshness and limitations documented by Norixo.
          </p>

          <ul className="mt-6 space-y-2 text-sm text-[#4C5C55]">
            <li>• Updated: {updated}</li>
            <li>• Published and reviewed by Norixo</li>
            <li>• Methodology and corrections are publicly documented</li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#23483B]">
            <Link className="underline underline-offset-4" href="/research/methodology">
              Research methodology
            </Link>
            <Link className="underline underline-offset-4" href="/research">
              Research hub
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D96C3B]">
            Publisher accountability
          </p>

          <h2 className="mt-3 text-2xl font-semibold">
            Norixo
          </h2>

          <p className="mt-4 leading-7 text-[#4C5C55]">
            Norixo is operated and published by CONCIERGERIE SHORT RENTAL. The
            legal representative published in the Norixo legal notice is
            Mohamed Sobhy, Manager.
          </p>

          <div className="mt-6 rounded-2xl bg-[#FAF7F2] p-5">
            <p className="font-semibold">Independent publication</p>
            <p className="mt-2 text-sm leading-6 text-[#4C5C55]">
              Norixo documents its methodology, limitations and correction path
              so readers can distinguish public research from private listing
              audits and commercial recommendations.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#23483B]">
            <Link className="underline underline-offset-4" href="/about">
              About Norixo
            </Link>
            <Link className="underline underline-offset-4" href="/legal">
              Legal notice
            </Link>
            <Link className="underline underline-offset-4" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
