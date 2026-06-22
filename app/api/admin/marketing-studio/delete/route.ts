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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const campaignId =
      typeof body.campaignId === "string" && body.campaignId.trim()
        ? body.campaignId.trim()
        : null;

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: "Missing campaign id." },
        { status: 400 }
      );
    }

    const supabase = createRouteClient(request);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError || !member?.workspace_id) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", campaignId)
      .eq("workspace_id", member.workspace_id);

    if (error) {
      console.error("[marketing-studio] delete failed", error);
      return NextResponse.json(
        { ok: false, error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[marketing-studio] delete route failed", error);
    return NextResponse.json(
      { ok: false, error: "Delete route failed." },
      { status: 500 }
    );
  }
}
