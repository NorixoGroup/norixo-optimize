import { Suspense } from "react";
import AuditNewContent from "./AuditNewContent";

export const dynamic = "force-dynamic";

export default function PublicAuditPage() {
  return (
    <div className="nk-audit-new-shell">
      <Suspense fallback={<div aria-busy="true">…</div>}>
        <AuditNewContent />
      </Suspense>
    </div>
  );
}
