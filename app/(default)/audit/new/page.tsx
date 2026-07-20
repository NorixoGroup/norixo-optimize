import { Suspense } from "react";
import AuditNewContent from "./AuditNewContent";

export const dynamic = "force-dynamic";

export default function PublicAuditPage() {
  return (
    <div className="nk-audit-new-shell">
      <Suspense fallback={<div>Chargement...</div>}>
        <AuditNewContent />
      </Suspense>
    </div>
  );
}
