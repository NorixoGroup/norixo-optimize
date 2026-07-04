import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createRouteClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

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

    const supabase = createRouteClient(request);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { data: member } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member?.workspace_id) {
      return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 400 });
    }

    if (campaignId) {
      const { data: existingCampaign, error: existingCampaignError } = await supabase
        .from("marketing_campaigns")
        .select("status")
        .eq("id", campaignId)
        .eq("workspace_id", member.workspace_id)
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
          .eq("workspace_id", member.workspace_id)
          .select("id, created_at, updated_at")
          .single()
      : supabase
          .from("marketing_campaigns")
          .insert({
            workspace_id: member.workspace_id,
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
