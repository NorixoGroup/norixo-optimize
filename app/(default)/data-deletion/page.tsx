import type { Metadata } from "next";

import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { DataDeletionContent } from "@/components/marketing/DataDeletionContent";

export const metadata: Metadata = {
  title: "Suppression des données | Norixo",
  description: "Instructions pour demander la suppression des données associées à Norixo.",
};

export default function DataDeletionPage() {
  return (
    <MarketingPageShell>
      <DataDeletionContent />
    </MarketingPageShell>
  );
}
