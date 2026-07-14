import { NextRequest, NextResponse } from "next/server";
import { normalizeSourceUrl } from "@/lib/listings/normalizeSourceUrl";
import {
  buildStructuredAuditPayloadFromPreview,
  type StructuredAuditResultPayload,
} from "@/lib/audits/formatResultPayload";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ListingPostRow = {
  id: string;
  workspace_id: string;
  source_platform: string | null;
  source_url: string | null;
  title: string | null;
  created_at: string;
};

type ExistingAuditRow = {
  id: string;
  created_at: string;
  result_payload: StructuredAuditResultPayload | null;
};

type CheckoutIntentProofRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  plan_code: string;
  status: string;
  stripe_checkout_session_id: string | null;
  completed_at: string | null;
};

type BillingPaymentProofRow = {
  id: string;
  workspace_id: string;
  status: string | null;
  stripe_checkout_session_id: string | null;
};

export type AuditRestoreResultStatus =
  | "invalid_request"
  | "payment_not_found"
  | "payment_not_confirmed"
  | "already_restored"
  | "restored";

type AuditRestoreErrorStatus = Exclude<
  AuditRestoreResultStatus,
  "already_restored" | "restored"
>;

type EvaluateAuditRestorePaymentProofInput = {
  checkoutSessionId: string | null;
  currentWorkspaceId: string | null;
  currentUserId: string | null;
  checkoutIntent: CheckoutIntentProofRow | null;
  billingPayment: BillingPaymentProofRow | null;
  existingAuditId: string | null;
};

export function evaluateAuditRestorePaymentProof(
  input: EvaluateAuditRestorePaymentProofInput
): {
  ok: boolean;
  status: AuditRestoreResultStatus;
  auditId?: string | null;
} {
  const checkoutSessionId =
    typeof input.checkoutSessionId === "string" ? input.checkoutSessionId.trim() : "";
  if (!checkoutSessionId) {
    return { ok: false, status: "invalid_request" };
  }

  const currentWorkspaceId =
    typeof input.currentWorkspaceId === "string" ? input.currentWorkspaceId.trim() : "";
  const currentUserId =
    typeof input.currentUserId === "string" ? input.currentUserId.trim() : "";
  const checkoutIntent = input.checkoutIntent;

  if (
    !currentWorkspaceId ||
    !currentUserId ||
    !checkoutIntent ||
    checkoutIntent.workspace_id !== currentWorkspaceId ||
    checkoutIntent.user_id !== currentUserId ||
    checkoutIntent.stripe_checkout_session_id !== checkoutSessionId ||
    checkoutIntent.plan_code !== "audit_test"
  ) {
    return { ok: false, status: "payment_not_found" };
  }

  if (input.existingAuditId) {
    return {
      ok: true,
      status: "already_restored",
      auditId: input.existingAuditId,
    };
  }

  if (
    checkoutIntent.status !== "completed" ||
    checkoutIntent.completed_at == null ||
    !input.billingPayment ||
    input.billingPayment.workspace_id !== currentWorkspaceId ||
    input.billingPayment.stripe_checkout_session_id !== checkoutSessionId ||
    input.billingPayment.status !== "succeeded"
  ) {
    return { ok: false, status: "payment_not_confirmed" };
  }

  return { ok: true, status: "restored" };
}

function buildRestoreErrorResponse(
  status: AuditRestoreErrorStatus
) {
  if (status === "invalid_request") {
    return NextResponse.json(
      { status, error: "Requête de restauration invalide." },
      { status: 400 }
    );
  }

  if (status === "payment_not_found") {
    return NextResponse.json(
      { status, error: "Paiement introuvable pour cet espace." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      status,
      error: "Le paiement est encore en cours de confirmation.",
    },
    { status: 409 }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    checkoutSessionId?: string;
    url?: string;
    title?: string;
    platform?: string;
    generatedAt?: string;
    preview?: {
      score?: number;
      summary?: string | null;
      insights?: string[];
      recommendations?: string[];
      marketPositioning?: {
        comparableCount?: number;
        status?: string;
      } | null;
      subScores?: Array<{
        key?: string;
        score?: number | null;
      }>;
      [key: string]: unknown;
    };
  };

  const { client, user, workspace } = await getRequestUserAndWorkspace(request);

  if (!user || !client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const checkoutSessionId =
      typeof body.checkoutSessionId === "string" ? body.checkoutSessionId.trim() : "";
    const admin = createSupabaseAdminClient();

    const { data: checkoutIntentRow, error: checkoutIntentError } = await admin
      .from("checkout_intents")
      .select(
        "id, workspace_id, user_id, plan_code, status, stripe_checkout_session_id, completed_at"
      )
      .eq("stripe_checkout_session_id", checkoutSessionId)
      .maybeSingle();

    if (checkoutIntentError) {
      throw new Error(checkoutIntentError.message || "Impossible de verifier le paiement");
    }

    const { data: billingPaymentRow, error: billingPaymentError } = await admin
      .from("billing_payments")
      .select("id, workspace_id, status, stripe_checkout_session_id")
      .eq("stripe_checkout_session_id", checkoutSessionId)
      .maybeSingle();

    if (billingPaymentError) {
      throw new Error(
        billingPaymentError.message || "Impossible de verifier la confirmation du paiement"
      );
    }

    const { data: recentAuditRows, error: recentAuditsError } = await client
      .from("audits")
      .select("id, created_at, result_payload")
      .eq("workspace_id", workspace.id)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (recentAuditsError) {
      throw new Error(
        recentAuditsError.message || "Impossible de verifier les restaurations existantes"
      );
    }

    const existingAudit = ((recentAuditRows ?? []) as ExistingAuditRow[]).find((audit) => {
      const payload = audit.result_payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return false;
      }

      const payloadSessionId =
        "stripe_checkout_session_id" in payload
          ? String(
              (payload as { stripe_checkout_session_id?: string | null })
                .stripe_checkout_session_id ?? ""
            ).trim()
          : "";
      const payloadGeneratedAt =
        "guest_draft_generated_at" in payload
          ? String(
              (payload as { guest_draft_generated_at?: string | null }).guest_draft_generated_at ??
                ""
            ).trim()
          : "";

      return (
        (checkoutSessionId.length > 0 && payloadSessionId === checkoutSessionId) ||
        (typeof body.generatedAt === "string" &&
          body.generatedAt.trim().length > 0 &&
          payloadGeneratedAt === body.generatedAt.trim())
      );
    });

    const proof = evaluateAuditRestorePaymentProof({
      checkoutSessionId,
      currentWorkspaceId: workspace.id,
      currentUserId: user.id,
      checkoutIntent: (checkoutIntentRow as CheckoutIntentProofRow | null) ?? null,
      billingPayment: (billingPaymentRow as BillingPaymentProofRow | null) ?? null,
      existingAuditId: existingAudit?.id ?? null,
    });

    if (!proof.ok) {
      return buildRestoreErrorResponse(proof.status as AuditRestoreErrorStatus);
    }

    if (proof.status === "already_restored") {
      return NextResponse.json({
        status: "already_restored",
        auditId: proof.auditId ?? null,
      });
    }

    if (
      !body.url ||
      !body.preview ||
      typeof body.preview !== "object" ||
      Array.isArray(body.preview)
    ) {
      return buildRestoreErrorResponse("invalid_request");
    }

    const normalizedUrl = normalizeSourceUrl(body.url);

    const { data: existingListings, error: existingListingsError } = await client
      .from("listings")
      .select("id, workspace_id, source_platform, source_url, title, created_at")
      .eq("workspace_id", workspace.id);

    if (existingListingsError) {
      throw new Error(
        existingListingsError.message || "Impossible de verifier les annonces existantes"
      );
    }

    const existingListing = ((existingListings ?? []) as ListingPostRow[]).find(
      (listing) => normalizeSourceUrl(listing.source_url) === normalizedUrl
    );

    let listingRow: ListingPostRow | null = existingListing ?? null;

    if (!listingRow) {
      const { data: createdListing, error: listingError } = await client
        .from("listings")
        .insert({
          workspace_id: workspace.id,
          created_by: user.id,
          source_platform: body.platform ?? null,
          source_url: body.url,
          title: body.title ?? "Annonce sans titre",
          city: null,
          country: null,
          price: null,
          currency: null,
          rating: null,
          reviews_count: null,
          raw_payload: body.preview,
        })
        .select("id, workspace_id, source_platform, source_url, title, created_at")
        .single();

      if (listingError || !createdListing) {
        throw new Error(listingError?.message || "Impossible de creer l'annonce");
      }

      listingRow = createdListing as ListingPostRow;
    }

    if (!listingRow) {
      throw new Error("Impossible de charger l'annonce");
    }

    let structuredPayload: StructuredAuditResultPayload;
    try {
      structuredPayload = buildStructuredAuditPayloadFromPreview(body.preview);
    } catch {
      return buildRestoreErrorResponse("invalid_request");
    }
    const structuredPayloadWithProof = {
      ...structuredPayload,
      source: "audit_restore_verified_checkout",
      restored_after_payment: true,
      stripe_checkout_session_id: checkoutSessionId,
      guest_draft_generated_at:
        typeof body.generatedAt === "string" && body.generatedAt.trim().length > 0
          ? body.generatedAt.trim()
          : null,
    } as StructuredAuditResultPayload & {
      source: string;
      restored_after_payment: boolean;
      stripe_checkout_session_id: string;
      guest_draft_generated_at: string | null;
    };

    const { data: latestAuditRows, error: latestAuditError } = await client
      .from("audits")
      .select("id, created_at, result_payload")
      .eq("workspace_id", workspace.id)
      .eq("listing_id", listingRow.id)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestAuditError) {
      throw new Error(latestAuditError.message || "Impossible de verifier les audits existants");
    }

    const latestAudit = Array.isArray(latestAuditRows)
      ? ((latestAuditRows[0] as ExistingAuditRow | undefined) ?? null)
      : null;

    if (
      latestAudit?.id &&
      latestAudit.result_payload &&
      JSON.stringify(latestAudit.result_payload) === JSON.stringify(structuredPayloadWithProof)
    ) {
      return NextResponse.json({
        status: "already_restored",
        auditId: latestAudit.id,
      });
    }

    const { data: auditRow, error: auditError } = await client
      .from("audits")
      .insert({
        workspace_id: workspace.id,
        listing_id: listingRow.id,
        created_by: user.id,
        overall_score: structuredPayload.score,
        listing_quality_index: structuredPayload.scoreBreakdown.photos,
        market_score: structuredPayload.market.score,
        potential_score: structuredPayload.business.bookingPotential,
        booking_lift_low: null,
        booking_lift_high: null,
        revenue_impact_low: structuredPayload.business.estimatedRevenueLow,
        revenue_impact_high: structuredPayload.business.estimatedRevenueHigh,
        result_payload: structuredPayloadWithProof,
      })
      .select("id")
      .single();

    if (auditError || !auditRow) {
      throw new Error(auditError?.message || "Impossible de persister l'audit");
    }

    return NextResponse.json({
      status: "restored",
      auditId: auditRow.id,
    });
  } catch (error) {
    console.error("Failed to restore paid guest audit", error);
    return NextResponse.json(
      {
        error: "Impossible de restaurer l’audit.",
      },
      { status: 500 }
    );
  }
}
