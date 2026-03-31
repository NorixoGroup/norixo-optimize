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

    if (workspaceId && workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Forbidden workspace" }, { status: 403 });
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
      .select("id, stripe_customer_id, workspace_id")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load subscription for portal", error);
      return NextResponse.json(
        { error: "Unable to load subscription. Please try again later." },
        { status: 500 }
      );
    }

    const stripeCustomerId =
      subscription && "stripe_customer_id" in subscription
        ? (subscription.stripe_customer_id as string | null)
        : null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe customer found for this workspace. Please contact support if this persists.",
        },
        { status: 400 }
      );
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
