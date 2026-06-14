type FaqItem = {
  question: string;
  answer: string;
};

type GuideFAQProps = {
  title?: string;
  items: FaqItem[];
};

export function GuideFAQ({
  title = "Frequently asked questions",
  items,
}: GuideFAQProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="text-3xl font-semibold">{title}</h2>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.question} className="rounded-2xl bg-white p-5">
            <summary className="cursor-pointer font-semibold">
              {item.question}
            </summary>
            <p className="mt-3 leading-7 text-[#4C5C55]">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
