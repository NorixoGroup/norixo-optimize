import { makeGuideClaimSafe } from "@/lib/seo/guideClaimSafety";

type GuideSectionProps = {
  title: string;
  body: string;
};

export function GuideSection({ title, body }: GuideSectionProps) {
  return (
    <article className="rounded-3xl bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold">{makeGuideClaimSafe(title)}</h2>
      <p className="mt-4 leading-8 text-[#4C5C55]">{makeGuideClaimSafe(body)}</p>
    </article>
  );
}
