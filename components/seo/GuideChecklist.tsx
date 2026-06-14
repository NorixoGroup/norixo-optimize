type GuideChecklistProps = {
  title: string;
  items: string[];
};

export function GuideChecklist({ title, items }: GuideChecklistProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-3xl font-semibold">{title}</h2>

        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3 leading-7 text-[#4C5C55]">
              <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10231F] text-xs text-white">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
