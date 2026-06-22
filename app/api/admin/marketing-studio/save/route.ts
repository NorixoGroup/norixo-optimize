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

    const plannerJson = parseOutput(result?.planner?.output);
    const socialJson = parseOutput(result?.social?.output);
    const creativeJson = parseOutput(result?.creative?.output);
    const videoJson = parseOutput(result?.video?.output);

    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        workspace_id: member.workspace_id,
        created_by: user.id,
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
      })
      .select("id, created_at")
      .single();

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

    return NextResponse.json({ ok: true, campaign: data });
  } catch (error) {
    console.error("[marketing-studio] save route failed", error);
    return NextResponse.json({ ok: false, error: "Save route failed." }, { status: 500 });
  }
}
