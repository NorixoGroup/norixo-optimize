import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

const PAID_GENERATION_DISABLED_ERROR = "Paid generation disabled by safety guard.";

function isPaidGenerationEnabled() {
  return process.env.MARKETING_STUDIO_PAID_GENERATION_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, requestId, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!isAdminPrivateEmail(user.email)) {
      return NextResponse.json(
        { ok: false, requestId, error: "Forbidden." },
        { status: 403 },
      );
    }

    const { data: member } = await requestClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.workspace_id) {
      return NextResponse.json(
        { ok: false, requestId, error: "Workspace not found." },
        { status: 400 },
      );
    }

    if (!isPaidGenerationEnabled()) {
      return NextResponse.json(
        { ok: false, requestId, error: PAID_GENERATION_DISABLED_ERROR },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const target = typeof body.target === "string" ? body.target : "";

    if (target === "planner") {
      const { runContentPlanner } = await import("@/lib/marketing-ai/agents/contentPlanner");
      const result = await runContentPlanner({
        marketingBrief: "Préparer une campagne marketing pour Norixo.io uniquement.",
        objective: "Faire découvrir Norixo aux conciergeries et aux hôtes professionnels.",
        language: "fr",
        timeframe: "7 jours",
        channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
      });
      return NextResponse.json({ ok: true, target, result });
    }

    if (target === "social") {
      const { runSocialContent } = await import("@/lib/marketing-ai/agents/socialContent");
      const result = await runSocialContent({
        channel: "instagram",
        format: "carousel",
        topic: "Identifier les points de friction d'une annonce",
        goal: "awareness",
        audience: "Conciergeries et hôtes professionnels",
        cta: "Découvrir Norixo.io",
        language: "fr",
      });
      return NextResponse.json({ ok: true, target, result });
    }

    if (target === "creative") {
      const { runCreativeDirector } = await import("@/lib/marketing-ai/agents/creativeDirector");
      const result = await runCreativeDirector({
        contentTitle: "Identifier les points de friction d'une annonce",
        hook: "Voir plus clairement ce qui peut freiner une annonce",
        channel: "instagram",
        format: "carousel",
        visualGoal: "Créer une direction visuelle premium pour un carrousel Instagram Norixo.io",
        language: "fr",
      });
      return NextResponse.json({ ok: true, target, result });
    }

    if (target === "video") {
      const { runVideoScript } = await import("@/lib/marketing-ai/agents/videoScript");
      const result = await runVideoScript({
        title: "Voir plus clairement ce qui peut freiner une annonce",
        hook: "Et si vous pouviez identifier vos priorités plus facilement ?",
        topic: "Présenter Norixo comme outil pour identifier les points de friction et clarifier les priorités",
        audience: "Conciergeries et hôtes professionnels",
        cta: "Découvrir Norixo.io",
        language: "fr",
        duration: "30 secondes",
        format: "reel",
      });
      return NextResponse.json({ ok: true, target, result });
    }

    return NextResponse.json(
      { ok: false, requestId, error: "Unknown regenerate target." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[marketing-studio] regenerate failed", { requestId, error });
    return NextResponse.json(
      { ok: false, requestId, error: "Regeneration failed." },
      { status: 500 },
    );
  }
}
