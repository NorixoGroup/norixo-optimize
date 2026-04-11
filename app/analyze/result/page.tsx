import { Suspense } from "react";
import ResultContent from "./ResultContent";

export default function AuditResultPreviewPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <ResultContent />
    </Suspense>
  );
}
