import { Suspense } from "react";
import ResultContent from "./ResultContent";

export const dynamic = "force-dynamic"; // 👈 AJOUT IMPORTANT

export default function AuditResultPreviewPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <ResultContent />
    </Suspense>
  );
}