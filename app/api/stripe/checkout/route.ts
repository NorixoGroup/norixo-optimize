import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/stripe/server";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, plan, interval, auditPreview } = (await request.json()) as {
      workspaceId?: string;
      plan?: "audit_test" | "pro" | "scale";
      interval?: "month" | "year";
      auditPreview?: {
        listingUrl?: string | null;
        title?: string | null;
        platform?: string | null;
        generatedAt?: string | null;
        score?: number | null;
        summary?: string | null;
      };
    };

    const { client, user, workspace } = await getRequestUserAndWorkspace(request);

    if (!user || !client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspace && !workspaceId) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    let effectiveWorkspace = workspace;

    if (workspaceId) {
      const { data: membership, error: membershipError } = await client
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (membershipError) {
        console.error("[stripe][checkout] Failed to verify workspace membership", {
          membershipError,
          requestedWorkspaceId: workspaceId,
          userId: user.id,
        });
        return NextResponse.json({ error: "Unable to verify workspace" }, { status: 500 });
      }

      if (!membership?.workspace_id) {
        const { data: ownedWorkspace, error: ownedWorkspaceError } = await client
          .from("workspaces")
          .select("id,name,slug,owner_user_id,created_at,updated_at")
          .eq("id", workspaceId)
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (ownedWorkspaceError) {
          console.error("[stripe][checkout] Failed to verify owned workspace", {
            ownedWorkspaceError,
            requestedWorkspaceId: workspaceId,
            userId: user.id,
          });
          return NextResponse.json({ error: "Unable to verify workspace" }, { status: 500 });
        }

        if (!ownedWorkspace?.id) {
          return NextResponse.json({ error: "Forbidden workspace" }, { status: 403 });
        }

        effectiveWorkspace = ownedWorkspace;
      } else {
        const { data: requestedWorkspace, error: requestedWorkspaceError } = await client
          .from("workspaces")
          .select("id,name,slug,owner_user_id,created_at,updated_at")
          .eq("id", workspaceId)
          .maybeSingle();

        if (requestedWorkspaceError) {
          console.error("[stripe][checkout] Failed to load requested workspace", {
            requestedWorkspaceError,
            requestedWorkspaceId: workspaceId,
            userId: user.id,
          });
          return NextResponse.json({ error: "Unable to load workspace" }, { status: 500 });
        }

        effectiveWorkspace = requestedWorkspace ?? null;
      }
    }

    if (!effectiveWorkspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    console.info("[stripe][checkout] workspace_id received", {
      requestedWorkspaceId: workspaceId ?? null,
      resolvedWorkspaceId: workspace?.id ?? null,
      effectiveWorkspaceId: effectiveWorkspace.id,
      plan: plan ?? null,
    });

    const normalizedPlan =
      plan === "audit_test" ? "audit_test" : plan === "scale" ? "scale" : "pro";
    const normalizedInterval = interval === "year" ? "year" : "month";
    const priceId =
      normalizedPlan === "audit_test"
        ? process.env.STRIPE_AUDIT_TEST_PRICE_ID
        : normalizedPlan === "scale"
        ? normalizedInterval === "year"
          ? process.env.STRIPE_SCALE_YEARLY_PRICE_ID
          : process.env.STRIPE_SCALE_MONTHLY_PRICE_ID
        : normalizedInterval === "year"
          ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
          : process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId || !appUrl) {
      console.error("[stripe][checkout][audit_test] Missing configuration", {
        normalizedPlan,
        hasPriceId: Boolean(priceId),
        hasAppUrl: Boolean(appUrl),
      });
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const { data: subscription, error: subscriptionError } = await client
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("workspace_id", effectiveWorkspace.id)
      .maybeSingle();

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

    const session = await stripe.checkout.sessions.create({
      mode: normalizedPlan === "audit_test" ? "payment" : "subscription",
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: user.email ?? undefined }),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        workspace_id: effectiveWorkspace.id,
        user_id: user.id,
        plan: normalizedPlan,
        billing_interval: normalizedInterval,
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
      ...(normalizedPlan === "audit_test"
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
        normalizedPlan === "audit_test"
          ? `${appUrl}/dashboard/billing?checkout=success&plan=audit_test`
          : `${appUrl}/dashboard?success=true`,
      cancel_url:
        normalizedPlan === "audit_test"
          ? `${appUrl}/dashboard/billing?canceled=true&plan=audit_test`
          : `${appUrl}/dashboard/billing?canceled=true`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe][checkout] Session creation failed", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
