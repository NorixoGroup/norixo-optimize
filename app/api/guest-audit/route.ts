import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import { extractListing } from "@/lib/extractors";
import { buildGuestAuditPreview } from "@/lib/guestAudit/buildGuestAuditPreview";
import {
  validateExtractedGuestListing,
  validateGuestListingUrl,
} from "@/lib/guestAudit/shared";

const guestAuditCache = new Map<string, ReturnType<typeof buildGuestAuditPreview>>();
const DEBUG_GUEST_AUDIT = process.env.DEBUG_GUEST_AUDIT === "true";

function getAuditCacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    const validation = validateGuestListingUrl(body.url);

    if (!validation.valid || !validation.normalizedUrl) {
      return NextResponse.json(
        { error: validation.reason || "URL invalide" },
        { status: 400 }
      );
    }

    const normalizedUrl = validation.normalizedUrl;
    const auditKey = getAuditCacheKey(normalizedUrl);
    const cachedAudit = guestAuditCache.get(auditKey);

    if (cachedAudit) {
      return NextResponse.json({ guestAudit: cachedAudit });
    }

    const extracted = await extractListing(normalizedUrl);
    const extractionValidation = validateExtractedGuestListing(extracted);

    if (!extractionValidation.valid) {
      return NextResponse.json(
        {
          error:
            extractionValidation.reason ||
            "Page non exploitable : les donnees necessaires n'ont pas pu etre extraites.",
        },
        { status: 422 }
      );
    }

    const competitorBundle = await searchCompetitorsAroundTarget({
      target: extracted,
      maxResults: 5,
      radiusKm: 1,
    });

    if (DEBUG_GUEST_AUDIT) {
      console.log("[guest-audit][comparables][pipeline-debug]", {
        stage: "builder_injection",
        platform: extracted.platform ?? null,
        inputCompetitorsCount: competitorBundle.competitors.length,
      });
    }

    const guestAudit = buildGuestAuditPreview({
      extracted,
      competitors: competitorBundle.competitors,
    });
    guestAuditCache.set(auditKey, guestAudit);

    return NextResponse.json({ guestAudit });
  } catch (error) {
    console.error("Guest audit generation failed:", error);

    const message =
      error instanceof Error &&
      error.message.includes("Extracted listing data is insufficient")
        ? "Page non exploitable : les donnees necessaires n'ont pas pu etre extraites."
        : "Impossible de générer l’audit invité";

    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
