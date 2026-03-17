"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RunAuditForListingButtonProps = {
  listingId: string;
};

export function RunAuditForListingButton({ listingId }: RunAuditForListingButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.code === "quota_exceeded") {
          setError(
            "Vous avez atteint le quota d’audits de votre offre Free."
          );
        } else {
          setError(data?.error || "Échec du lancement de l’audit");
        }
        setLoading(false);
        return;
      }

      if (data.auditId) {
        router.push(`/dashboard/audits/${data.auditId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur inconnue est survenue"
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="nk-ghost-btn text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-60"
      >
        {loading ? "Audit en cours..." : "Run audit"}
      </button>
      {error && (
        <span className="text-[11px] text-red-600 max-w-[220px]">
          {error}
        </span>
      )}
    </div>
  );
}
