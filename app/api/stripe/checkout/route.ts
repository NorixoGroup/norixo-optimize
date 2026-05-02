import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/stripe/server";
import { getWorkspaceAuditCredits } from "@/lib/billing/getWorkspaceAuditCredits";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, plan, interval, quantity, checkoutMode, auditPreview } = (await request.json()) as {
      workspaceId?: string;
      plan?: "audit_test" | "pro" | "scale" | "starter";
      interval?: "month" | "year";
      quantity?: number;
      checkoutMode?: "one_shot";
      auditPreview?: {
        listingUrl?: string | null;
        title?: string | null;
        platform?: string | null;
        generatedAt?: string | null;
        score?: number | null;
        summary?: string | null;
      };
    };

    /** Auth + canonical workspace résolus côté serveur (JWT) — sans localStorage ni body.workspaceId comme source de vérité */
    const { client, user, workspace: sessionWorkspace } = await getRequestUserAndWorkspace(request);

    if (!user || !client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!sessionWorkspace?.id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    /** Ne jamais utiliser cette valeur comme binding Stripe ; seule référence : serverWorkspace ci-dessous */
    const clientWorkspaceIdRaw = typeof workspaceId === "string" ? workspaceId.trim() : "";

    /** Workspace Stripe / DB : résolution serveur exclusive (pas le body client) */
    const serverWorkspace = sessionWorkspace;

    if (clientWorkspaceIdRaw && clientWorkspaceIdRaw !== serverWorkspace.id) {
      console.warn("[stripe][checkout][security] client_workspace_id_ignored_mismatch", {
        userId: user.id,
        clientWorkspaceId: clientWorkspaceIdRaw,
        serverWorkspaceId: serverWorkspace.id,
        planFromBody: plan ?? null,
      });
    }

    const effectiveWorkspace = serverWorkspace;

    const normalizedPlan =
      plan === "audit_test"
        ? "audit_test"
        : plan === "scale"
          ? "scale"
          : plan === "starter"
            ? "starter"
            : "pro";
    const normalizedInterval = interval === "year" ? "year" : "month";
    /** Pro / Scale / Starter / audit_test = paiement unique (pack ou flux invité), pas d’abonnement pour Pro. */
    const isOneShotCheckout =
      checkoutMode === "one_shot" ||
      normalizedPlan === "scale" ||
      normalizedPlan === "pro" ||
      normalizedPlan === "starter" ||
      (normalizedPlan === "audit_test" && normalizedInterval === "month");
    const normalizedQuantity =
      normalizedPlan === "audit_test"
        ? Math.min(50, Math.max(1, Number(quantity ?? 1) || 1))
        : 1;
    const packCreditQuantity =
      normalizedPlan === "scale"
        ? 15
        : normalizedPlan === "pro"
          ? 5
          : normalizedPlan === "starter"
            ? 1
            : normalizedQuantity;
    const auditTestPriceId =
      process.env.STRIPE_AUDIT_TEST_PRICE_ID ?? process.env.STRIPE_STARTER_PRICE_ID;
    const proPack5PriceId = process.env.STRIPE_PACK_5_PRICE_ID;
    const scalePack15PriceId = process.env.STRIPE_PACK_15_PRICE_ID;
    const priceId =
      normalizedPlan === "audit_test" || normalizedPlan === "starter"
        ? auditTestPriceId
        : normalizedPlan === "scale"
          ? scalePack15PriceId
          : normalizedPlan === "pro"
            ? proPack5PriceId
            : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId || !appUrl) {
      console.error("[stripe][checkout] Missing configuration", {
        normalizedPlan,
        normalizedInterval,
        isOneShotCheckout,
        checkoutMode: checkoutMode ?? null,
        hasPriceId: Boolean(priceId),
        hasAppUrl: Boolean(appUrl),
      });
      const userMessage = !appUrl
        ? "Le service de paiement est momentanément indisponible. Réessayez plus tard."
        : normalizedPlan === "scale"
          ? "Le pack Scale (15 audits) est momentanément indisponible. Réessayez plus tard ou contactez le support."
          : normalizedPlan === "audit_test"
            ? "L’achat d’audit test est momentanément indisponible. Réessayez plus tard."
            : normalizedPlan === "starter"
              ? "Le pack Starter est momentanément indisponible. Réessayez plus tard."
              : normalizedPlan === "pro"
                ? "Le pack Pro (5 audits) est momentanément indisponible. Réessayez plus tard ou contactez le support."
                : "Le paiement est momentanément indisponible. Réessayez plus tard.";
      return NextResponse.json({ error: userMessage }, { status: 500 });
    }

    const [balanceResult, { data: subscription, error: subscriptionError }] = await Promise.all([
      getWorkspaceAuditCredits(effectiveWorkspace.id, client)
        .then((balance) => ({ ok: true as const, balance }))
        .catch((error: unknown) => ({
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        })),
      client
        .from("subscriptions")
        .select("stripe_customer_id, plan_code")
        .eq("workspace_id", effectiveWorkspace.id)
        .maybeSingle(),
    ]);

    console.info("[billing][checkout] workspace_resolved_server_side", {
      userId: user.id,
      selectedWorkspaceId: effectiveWorkspace.id,
      reason: "jwt_session_workspace",
      clientWorkspaceIgnored: Boolean(clientWorkspaceIdRaw),
      availableCredits: balanceResult.ok ? balanceResult.balance.available : null,
      availableCreditsError: balanceResult.ok ? null : balanceResult.error,
      planCode: String((subscription as { plan_code?: string | null } | null)?.plan_code ?? "free"),
      checkoutPlanCodeRequested: plan ?? null,
    });

    if (subscriptionError) {
      console.error("Failed to load workspace subscription before checkout", subscriptionError);
      return NextResponse.json(
        { error: "Unable to load billing profile" },
        { status: 500 }
      );
    }

    const stripeCustomerId =
      subscription && "stripe_customer_id" in subscription
        ? (subscription.stripe_customer_id as string | null)
        : null;

    let checkoutIntentId: string | null = null;
    let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null = null;

    if (isOneShotCheckout) {
      supabaseAdmin = createSupabaseAdminClient();
      const { data: intentRow, error: intentInsertError } = await supabaseAdmin
        .from("checkout_intents")
        .insert({
          workspace_id: effectiveWorkspace.id,
          user_id: user.id,
          plan_code: normalizedPlan,
          price_id: priceId,
          currency: "eur",
          status: "pending",
          stripe_customer_id: stripeCustomerId,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (intentInsertError || !intentRow?.id) {
        console.error("[stripe][checkout] checkout_intent_insert_failed", {
          intentInsertError,
          workspaceId: effectiveWorkspace.id,
          userId: user.id,
        });
        return NextResponse.json(
          { error: "Impossible d’initialiser le paiement. Réessayez dans quelques instants." },
          { status: 500 }
        );
      }
      checkoutIntentId = intentRow.id;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
      mode: isOneShotCheckout ? "payment" : "subscription",
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : {
            customer_email: user.email ?? undefined,
            ...(isOneShotCheckout ? { customer_creation: "always" as const } : {}),
          }),
      line_items: [
        {
          price: priceId,
          quantity: normalizedQuantity,
        },
      ],
      metadata: {
        workspace_id: effectiveWorkspace.id,
        user_id: user.id,
        plan: normalizedPlan,
        plan_code: normalizedPlan,
        credit_quantity: String(packCreditQuantity),
        ...(checkoutIntentId ? { checkout_intent_id: checkoutIntentId } : {}),
        billing_interval:
          normalizedPlan === "scale" ||
          normalizedPlan === "pro" ||
          normalizedPlan === "starter"
            ? "pack"
            : normalizedInterval,
        ...(normalizedPlan === "audit_test"
          ? { audit_quantity: String(normalizedQuantity) }
          : {}),
        ...(normalizedPlan === "audit_test"
          ? {
              audit_listing_url: auditPreview?.listingUrl?.slice(0, 500) ?? "",
              audit_title: auditPreview?.title?.slice(0, 500) ?? "",
              audit_platform: auditPreview?.platform?.slice(0, 100) ?? "",
              audit_generated_at: auditPreview?.generatedAt?.slice(0, 100) ?? "",
              audit_score:
                typeof auditPreview?.score === "number"
                  ? String(auditPreview.score)
                  : "",
              audit_summary: auditPreview?.summary?.slice(0, 500) ?? "",
            }
          : {}),
      },
      ...(isOneShotCheckout
        ? {}
        : {
            subscription_data: {
              metadata: {
                workspace_id: effectiveWorkspace.id,
                user_id: user.id,
                plan: normalizedPlan,
                billing_interval: normalizedInterval,
              },
            },
          }),
      success_url:
        isOneShotCheckout
          ? `${appUrl}/dashboard/billing?checkout=success&plan=${normalizedPlan}`
          : `${appUrl}/dashboard?success=true`,
      cancel_url:
        isOneShotCheckout
          ? `${appUrl}/dashboard/billing?canceled=true&plan=${normalizedPlan}`
          : `${appUrl}/dashboard/billing?canceled=true`,
    });
    } catch (stripeCreateErr) {
      if (checkoutIntentId && supabaseAdmin) {
        const message =
          stripeCreateErr instanceof Error ? stripeCreateErr.message : String(stripeCreateErr);
        await supabaseAdmin
          .from("checkout_intents")
          .update({
            status: "failed",
            metadata: { error: "stripe_session_create_failed", message },
          })
          .eq("id", checkoutIntentId);
      }
      throw stripeCreateErr;
    }

    if (checkoutIntentId && supabaseAdmin && session?.id) {
      const { error: intentSessionUpdateError } = await supabaseAdmin
        .from("checkout_intents")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", checkoutIntentId);

      if (intentSessionUpdateError) {
        console.error("[stripe][checkout] checkout_intent_session_link_failed", {
          intentSessionUpdateError,
          checkoutIntentId,
          sessionId: session.id,
        });
        try {
          await stripe.checkout.sessions.expire(session.id);
        } catch (expireErr) {
          console.error("[stripe][checkout] session_expire_after_link_failed", {
            sessionId: session.id,
            expireErr,
          });
        }
        await supabaseAdmin
          .from("checkout_intents")
          .update({
            status: "failed",
            metadata: {
              error: "checkout_intent_session_link_failed",
              session_id: session.id,
            },
          })
          .eq("id", checkoutIntentId);
        return NextResponse.json(
          {
            error:
              "Impossible de finaliser l’ouverture du paiement. Réessayez dans quelques instants.",
          },
          { status: 500 }
        );
      }
    }

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            "Impossible d’ouvrir la page de paiement pour le moment. Réessayez dans quelques instants.",
        },
        { status: 500 }
      );
    }

    console.info("[billing][checkout][workspace_binding]", {
      userId: user.id,
      clientWorkspaceId: clientWorkspaceIdRaw || null,
      serverWorkspaceId: serverWorkspace.id,
      metadataWorkspaceId: serverWorkspace.id,
      plan: normalizedPlan,
      priceId,
      sessionId: session.id ?? null,
    });

    if (checkoutIntentId) {
      console.info("[billing][checkout] session_created", {
        workspaceId: serverWorkspace.id,
        planCode: normalizedPlan,
        checkoutIntentId,
        stripeCheckoutSessionId: session.id,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe][checkout] Session creation failed", error);
    return NextResponse.json(
      {
        error:
          "Impossible d’ouvrir la page de paiement pour le moment. Réessayez dans quelques instants.",
      },
      { status: 500 }
    );
  }
}
