import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMediaBinaryFilename, type MediaInternalBinary } from "../mediaBinary";
import type { MediaAsset } from "../mediaAsset";
import type { MediaMuxRequest, MediaMuxResult, MediaMuxerAdapter } from "../mediaMuxer";

const DEFAULT_FFMPEG_MUX_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_STDERR_LENGTH = 8_000;

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

function getMuxTimeoutMs(): number {
  const configured = Number.parseInt(process.env.FFMPEG_MUX_TIMEOUT_MS ?? "", 10);

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_FFMPEG_MUX_TIMEOUT_MS;
}

function decodeInternalBinary(binary: MediaInternalBinary): Buffer {
  return Buffer.from(binary.base64, "base64");
}

function buildMuxedAsset(request: MediaMuxRequest): MediaAsset {
  const now = new Date().toISOString();

  return {
    ...request.videoAsset,
    status: "generated",
    previewUrl: null,
    downloadUrl: null,
    generationProvider: request.videoAsset.generationProvider,
    metadata: {
      ...request.videoAsset.metadata,
      hasMuxedNarration: true,
      muxProvider: "ffmpeg",
      narrationProvider: request.narrationAsset.generationProvider ?? undefined,
      narrationLanguage: request.narrationAsset.language,
      narrationPurpose: request.narrationAsset.purpose,
      sourceVideoAssetId: request.videoAsset.id,
      sourceAudioAssetId: request.narrationAsset.id,
    },
    warnings: [
      ...(request.videoAsset.warnings ?? []).filter(
        (warning) => warning !== "Media asset has not been generated yet.",
      ),
    ],
    updatedAt: now,
  };
}

function buildMuxCommandArgs(params: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}): string[] {
  return [
    "-y",
    "-i",
    params.videoPath,
    "-i",
    params.audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "-shortest",
    params.outputPath,
  ];
}

function truncateStderr(stderr: string): string {
  if (stderr.length <= DEFAULT_MAX_STDERR_LENGTH) {
    return stderr;
  }

  return stderr.slice(-DEFAULT_MAX_STDERR_LENGTH);
}

async function runFfmpeg(params: {
  executablePath: string;
  argv: string[];
  timeoutMs: number;
}): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(params.executablePath, params.argv, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, params.timeoutMs);

    child.stderr.on("data", (chunk: Buffer | string) => {
      const value = typeof chunk === "string" ? chunk : chunk.toString("utf8");

      if (stderr.length < DEFAULT_MAX_STDERR_LENGTH) {
        stderr += value.slice(0, DEFAULT_MAX_STDERR_LENGTH - stderr.length);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error("ffmpeg mux timed out."));
        return;
      }

      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg mux failed with exit code ${code}: ${truncateStderr(stderr) || "No stderr output."}`,
          ),
        );
        return;
      }

      resolve(truncateStderr(stderr));
    });
  });
}

export const ffmpegMediaMuxer: MediaMuxerAdapter = {
  id: "ffmpeg",
  label: "FFmpeg Media Muxer",

  async mux(request): Promise<MediaMuxResult> {
    const executablePath = getFfmpegExecutablePath();

    if (!executablePath) {
      return {
        provider: "ffmpeg",
        status: "failed",
        error: "ffmpeg executable is not available in the current runtime.",
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "norixo-media-mux-"));
    const videoPath = path.join(tempDir, `video.${request.videoBinary.extension}`);
    const audioPath = path.join(tempDir, `audio.${request.narrationBinary.extension}`);
    const outputPath = path.join(tempDir, "final.mp4");
    const argv = buildMuxCommandArgs({
      videoPath,
      audioPath,
      outputPath,
    });

    try {
      await fs.writeFile(videoPath, decodeInternalBinary(request.videoBinary));
      await fs.writeFile(audioPath, decodeInternalBinary(request.narrationBinary));

      await runFfmpeg({
        executablePath,
        argv,
        timeoutMs: getMuxTimeoutMs(),
      });

      const stat = await fs.stat(outputPath).catch(() => null);

      if (!stat || stat.size <= 0) {
        return {
          provider: "ffmpeg",
          status: "failed",
          error: "ffmpeg mux failed: missing or empty output file.",
        };
      }

      const outputBuffer = await fs.readFile(outputPath);

      return {
        provider: "ffmpeg",
        status: "generated",
        asset: buildMuxedAsset(request),
        internalBinary: {
          mimeType: "video/mp4",
          extension: "mp4",
          base64: outputBuffer.toString("base64"),
          filename: createMediaBinaryFilename({
            id: request.videoAsset.id,
            provider: "ffmpeg",
            extension: "mp4",
          }),
        },
      };
    } catch (error) {
      return {
        provider: "ffmpeg",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown ffmpeg muxer error.",
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  },
};

export function buildFfmpegMuxArgv(params: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}): string[] {
  return buildMuxCommandArgs(params);
}
