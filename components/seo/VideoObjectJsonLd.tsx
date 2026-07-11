type VideoObjectJsonLdProps = {
  name: string;
  description: string;
  contentUrl: string;
  pageUrl: string;
  language: string;
};

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io"
).replace(/\/$/, "");

export function VideoObjectJsonLd({
  name,
  description,
  contentUrl,
  pageUrl,
  language,
}: VideoObjectJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl: [
      `${siteUrl}/marketing/norixo-demo-thumbnail.jpg`,
    ],
    uploadDate: "2026-07-11T00:00:00+02:00",
    duration: "PT2M11S",
    contentUrl: `${siteUrl}${contentUrl}`,
    url: `${siteUrl}${pageUrl}`,
    inLanguage: language,
    isFamilyFriendly: true,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
