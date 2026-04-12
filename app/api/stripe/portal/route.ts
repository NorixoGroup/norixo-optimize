import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/stripe/server";
import { getRequestUserAndWorkspace } from "@/lib/server/routeAuth";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = (await request.json()) as { workspaceId?: string };

    const { client, user, workspace } = await getRequestUserAndWorkspace(request);

    if (!user || !client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    let effectiveWorkspace = workspace;

    if (workspaceId && workspaceId !== workspace.id) {
      const { data: membership, error: membershipError } = await client
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (membershipError) {
        console.error("[stripe][portal] Failed to verify workspace membership", {
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
          console.error("[stripe][portal] Failed to verify owned workspace", {
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
          console.error("[stripe][portal] Failed to load requested workspace", {
            requestedWorkspaceError,
            requestedWorkspaceId: workspaceId,
            userId: user.id,
          });
          return NextResponse.json({ error: "Unable to load workspace" }, { status: 500 });
        }

        if (!requestedWorkspace?.id) {
          return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
        }

        effectiveWorkspace = requestedWorkspace;
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      console.error("NEXT_PUBLIC_APP_URL is not configured");
      return NextResponse.json(
        { error: "Billing portal is not configured" },
        { status: 500 }
      );
    }

    const { data: subscription, error } = await client
      .from("subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id, workspace_id, plan_code, status")
      .eq("workspace_id", effectiveWorkspace.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load subscription for portal", error);
      return NextResponse.json(
        { error: "Unable to load subscription. Please try again later." },
        { status: 500 }
      );
    }

    let stripeCustomerId =
      subscription && "stripe_customer_id" in subscription
        ? (subscription.stripe_customer_id as string | null)
        : null;

    if (!stripeCustomerId) {
      const stripeSubscriptionId =
        subscription && "stripe_subscription_id" in subscription
          ? (subscription.stripe_subscription_id as string | null)
          : null;

      if (stripeSubscriptionId) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const customerFromSubscription =
            stripeSubscription &&
            typeof stripeSubscription === "object" &&
            "customer" in stripeSubscription
              ? stripeSubscription.customer
              : null;

          stripeCustomerId =
            typeof customerFromSubscription === "string" ? customerFromSubscription : null;
        } catch (subscriptionError) {
          console.warn("Failed to recover Stripe customer from subscription", {
            workspaceId: effectiveWorkspace.id,
            stripeSubscriptionId,
            subscriptionError,
          });
        }
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: effectiveWorkspace.name ?? undefined,
          metadata: {
            workspace_id: effectiveWorkspace.id,
            user_id: user.id,
          },
        });
        stripeCustomerId = customer.id;
      }

      if (subscription?.id) {
        const { error: updateError } = await client
          .from("subscriptions")
          .update({
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        if (updateError) {
          console.error("Failed to save recovered Stripe customer on subscription", {
            workspaceId: effectiveWorkspace.id,
            subscriptionId: subscription.id,
            updateError,
          });
          return NextResponse.json(
            { error: "Unable to sync billing profile. Please try again later." },
            { status: 500 }
          );
        }
      } else {
        const { error: insertError } = await client.from("subscriptions").insert({
          workspace_id: effectiveWorkspace.id,
          plan_code: "free",
          status: "active",
          stripe_customer_id: stripeCustomerId,
        });

        if (insertError) {
          console.error("Failed to create billing profile with Stripe customer", {
            workspaceId: effectiveWorkspace.id,
            insertError,
          });
          return NextResponse.json(
            { error: "Unable to sync billing profile. Please try again later." },
            { status: 500 }
          );
        }
      }
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Stripe portal error", error);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
