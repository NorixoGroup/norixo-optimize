const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://norixo.io";

export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

<url>
<loc>${SITE}/fr/demo</loc>
<video:video>
<video:thumbnail_loc>${SITE}/marketing/norixo-demo-thumbnail.jpg</video:thumbnail_loc>
<video:title>Norixo Optimize Demo (Français)</video:title>
<video:description>Découvrez comment Norixo analyse une annonce Airbnb ou Booking et identifie les optimisations qui augmentent les réservations.</video:description>
<video:content_loc>${SITE}/marketing/norixo-demo-fr.mp4</video:content_loc>
<video:family_friendly>yes</video:family_friendly>
</video:video>
</url>

<url>
<loc>${SITE}/demo</loc>
<video:video>
<video:thumbnail_loc>${SITE}/marketing/norixo-demo-thumbnail.jpg</video:thumbnail_loc>
<video:title>Norixo Optimize Demo (English)</video:title>
<video:description>See how Norixo analyzes Airbnb and Booking listings and turns the analysis into concrete actions that increase bookings.</video:description>
<video:content_loc>${SITE}/marketing/norixo-demo-en.mp4</video:content_loc>
<video:family_friendly>yes</video:family_friendly>
</video:video>
</url>

</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
