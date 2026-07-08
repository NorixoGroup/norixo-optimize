import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

const MAX_VERSION_OUTPUT_LENGTH = 300;

function getFfmpegExecutablePath(): string | null {
  const configured = process.env.FFMPEG_PATH?.trim();

  if (configured) {
    return configured;
  }

  try {
    const resolved = require("ffmpeg-static") as string | null;
    return typeof resolved === "string" && resolved.trim().length > 0
      ? resolved
      : null;
  } catch {
    return null;
  }
}

function truncateOutput(value: string): string {
  return value.length <= MAX_VERSION_OUTPUT_LENGTH
    ? value
    : value.slice(0, MAX_VERSION_OUTPUT_LENGTH);
}

export async function GET(request: NextRequest) {
  try {
    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!isAdminPrivateEmail(user.email)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    const resolvedPath = getFfmpegExecutablePath();
    const exists = Boolean(resolvedPath && fs.existsSync(resolvedPath));
    const executable = Boolean(
      resolvedPath &&
        exists &&
        (() => {
          try {
            fs.accessSync(resolvedPath, fs.constants.X_OK);
            return true;
          } catch {
            return false;
          }
        })(),
    );

    const versionResult = resolvedPath
      ? spawnSync(resolvedPath, ["-version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        })
      : null;
    const combinedOutput = versionResult
      ? `${versionResult.stdout ?? ""}${versionResult.stderr ?? ""}`.trim()
      : "";

    return NextResponse.json(
      {
        ok: true,
        resolvedPath,
        exists,
        executable,
        versionStatus: versionResult?.status ?? null,
        versionOutputPrefix: combinedOutput
          ? truncateOutput(combinedOutput)
          : null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[marketing-studio][debug][ffmpeg] failed", error);

    return NextResponse.json(
      { ok: false, error: "FFmpeg debug route failed." },
      { status: 500 },
    );
  }
}
