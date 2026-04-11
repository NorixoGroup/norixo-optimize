import { Suspense } from "react";
import AuditNewContent from "./AuditNewContent";

export default function PublicAuditPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <AuditNewContent />
    </Suspense>
  );
}
