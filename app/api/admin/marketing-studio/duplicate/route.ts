import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function client(req: Request) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: req.headers.get("authorization") ?? "",
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = client(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ ok: false }, { status: 401 });

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member?.workspace_id) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found." },
        { status: 400 }
      );
    }

    const { data: campaign, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", body.campaignId)
      .eq("workspace_id", member.workspace_id)
      .single();

    if (error)
      return NextResponse.json({ ok: false, error: error.message });

    const copy = {
      ...campaign,
      id: undefined,
      created_by: user.id,
      name: `${campaign.name} (copie)`,
      status: "draft",
      created_at: undefined,
      updated_at: undefined,
    };

    const { data, error: insertError } = await supabase
      .from("marketing_campaigns")
      .insert(copy)
      .select("id")
      .single();

    if (insertError) {
      console.error("[marketing-studio] duplicate insert failed", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message, details: insertError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e),
      },
      { status: 500 }
    );
  }
}
