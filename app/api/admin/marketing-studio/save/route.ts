import { NextResponse } from "next/server";
import { requireMarketingStudioAdmin } from "@/lib/auth/adminAccess";

function parseOutput(output: unknown) {
  if (typeof output !== "string") return null;

  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = body.result ?? null;
    const campaignName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : `Campagne - ${new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date())}`;
    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : null;

    if (!result) {
      return NextResponse.json({ ok: false, error: "Missing campaign result." }, { status: 400 });
    }

    const admin = await requireMarketingStudioAdmin(request);
    if (!admin.ok) return admin.response;
    const { client: supabase, user, workspace } = admin.access;

    if (campaignId) {
      const { data: existingCampaign, error: existingCampaignError } = await supabase
        .from("marketing_campaigns")
        .select("status")
        .eq("id", campaignId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();

      if (existingCampaignError) {
        return NextResponse.json(
          { ok: false, error: existingCampaignError.message },
          { status: 500 }
        );
      }

      if (!existingCampaign) {
        return NextResponse.json(
          { ok: false, error: "Campaign not found." },
          { status: 404 }
        );
      }

      if (existingCampaign.status === "approved") {
        return NextResponse.json(
          { ok: false, error: "Approved campaigns are locked." },
          { status: 409 }
        );
      }
    }

    const plannerJson = parseOutput(result?.planner?.output);
    const socialJson = parseOutput(result?.social?.output);
    const creativeJson = parseOutput(result?.creative?.output);
    const videoJson = parseOutput(result?.video?.output);

    const payload = {
      name: campaignName,
      objective:
        plannerJson?.objective ??
        body.objective ??
        "Campagne marketing Norixo",
      language: body.language ?? "fr",
      timeframe: plannerJson?.timeframe ?? body.timeframe ?? "7 jours",
      channels: body.channels ?? ["Instagram", "Facebook", "LinkedIn", "SEO"],
      status: "draft",
      planner_json: plannerJson,
      social_json: socialJson,
      creative_json: creativeJson,
      video_json: videoJson,
      raw_result: result,
      updated_at: new Date().toISOString(),
    };

    const query = campaignId
      ? supabase
          .from("marketing_campaigns")
          .update(payload)
          .eq("id", campaignId)
          .eq("workspace_id", workspace.id)
          .select("id, created_at, updated_at")
          .single()
      : supabase
          .from("marketing_campaigns")
          .insert({
            workspace_id: workspace.id,
            created_by: user.id,
            ...payload,
          })
          .select("id, created_at, updated_at")
          .single();

    const { data, error } = await query;

    if (error) {
      console.error("[marketing-studio] save failed", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: campaignId ? "updated" : "created",
      campaign: data,
    });
  } catch (error) {
    console.error("[marketing-studio] save route failed", error);
    return NextResponse.json({ ok: false, error: "Save route failed." }, { status: 500 });
  }
}
