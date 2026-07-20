import type { Metadata } from "next";

import AnalyzeListingPageClient from "./AnalyzeListingPageClient";

export const metadata: Metadata = {
  title: "Analyze your Airbnb listing | Norixo",
  description:
    "Preview Norixo's listing analysis experience before unlocking the full audit.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AnalyzeListingPage() {
  return <AnalyzeListingPageClient />;
}
