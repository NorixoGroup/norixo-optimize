import { NextResponse } from "next/server";
import { runContentPlanner } from "@/lib/marketing-ai/agents/contentPlanner";
import { runSocialContent } from "@/lib/marketing-ai/agents/socialContent";
import { runCreativeDirector } from "@/lib/marketing-ai/agents/creativeDirector";
import { runVideoScript } from "@/lib/marketing-ai/agents/videoScript";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const target = typeof body.target === "string" ? body.target : "";

    if (target === "planner") {
      const result = await runContentPlanner({
        marketingBrief: "Préparer une campagne marketing pour Norixo.io uniquement.",
        objective: "Faire découvrir Norixo Optimize aux conciergeries et aux hôtes professionnels.",
        language: "fr",
        timeframe: "7 jours",
        channels: ["Instagram", "Facebook", "LinkedIn", "SEO"],
      });

      return NextResponse.json({ ok: true, target, result });
    }

    if (target === "social") {
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
      const result = await runVideoScript({
        title: "Voir plus clairement ce qui peut freiner une annonce",
        hook: "Et si vous pouviez identifier vos priorités plus facilement ?",
        topic: "Présenter Norixo Optimize comme outil pour identifier les points de friction et clarifier les priorités",
        audience: "Conciergeries et hôtes professionnels",
        cta: "Découvrir Norixo.io",
        language: "fr",
        duration: "30 secondes",
        format: "reel",
      });

      return NextResponse.json({ ok: true, target, result });
    }

    return NextResponse.json({ ok: false, error: "Unknown regenerate target." }, { status: 400 });
  } catch (error) {
    console.error("[marketing-studio] regenerate failed", error);
    return NextResponse.json({ ok: false, error: "Regeneration failed." }, { status: 500 });
  }
}
