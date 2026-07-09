import { buildMediaAssetRequestsFromBundle } from "../lib/marketing-ai/media/mediaAssetRequestBuilder";
import { buildMediaAssets } from "../lib/marketing-ai/media/mediaAssetBuilder";
import {
  buildMarketingStudioMediaPreflight,
  buildFfmpegMuxArgv,
  falKokoroFrenchNarrationProvider,
  fakeMediaProvider,
  fakeNarrationProvider,
  fakeMediaMuxer,
  ffmpegMediaMuxer,
  getMediaConfiguration,
  getMediaProviderById,
  isProductionReadyMediaConfiguration,
  listMediaProviders,
  listMediaProvidersByCapability,
  selectMediaProvidersForRequests,
  buildMediaGenerationJobs,
  executeMediaGenerationJobs,
  pollMediaGenerationJobsStatus,
  applyMediaGenerationJobsToAssets,
  runMediaEngine,
  runMediaGenerationPipeline,
  runNarratedVideoAssembly,
  uploadMediaBinaryForAsset,
} from "../lib/marketing-ai/media";
import { buildMarketingCampaignBundle } from "../lib/marketing-ai/bundle/campaignBundleBuilder";
import {
  runMediaProviderForRequests,
  runMediaProviderSelectionForRequests,
} from "../lib/marketing-ai/media/mediaProviderRunner";
import { buildNarrationRequestFromBundle } from "../lib/marketing-ai/media/mediaNarrationRequestBuilder";
import { buildPrompt as buildCreativeDirectorPrompt } from "../lib/marketing-ai/prompts/creative.prompt";
import {
  buildMarketingStudioOrchestratorInput,
  sanitizeMarketingStudioRunError,
} from "../lib/marketing-ai/runs/marketingStudioGenerationRunStore";
import type {
  MarketingStudioGenerationRunProcessorStore,
  MarketingStudioGenerationRunRecord,
} from "../lib/marketing-ai/runs/marketingStudioGenerationRunStore";
import {
  MARKETING_STUDIO_WORKER_DISABLED_ERROR,
  MARKETING_STUDIO_WORKER_MEDIA_RUNTIME_ERROR,
  processMarketingStudioGenerationRun,
  processNextMarketingStudioGenerationRun,
} from "../lib/marketing-ai/runs/marketingStudioGenerationWorker";
import {
  buildMarketingStudioSubmissionFingerprint,
  clearMarketingStudioPendingSubmission,
  readMarketingStudioPendingSubmission,
  resolveMarketingStudioPendingSubmission,
} from "../lib/marketing-ai/runs/marketingStudioPendingSubmission";
import { resolveTikTokUploadMediaAsset } from "../lib/marketing-ai/tiktok/tiktokApi";
import { executeMarketingStudioRun } from "../app/api/admin/marketing-studio/run/route";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonEmptyString(value: string | null | undefined, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is empty.`);
  }
}

function isVideoLikeKind(kind: string) {
  return kind === "video" || kind === "reel";
}

const SEEDANCE_MODEL = "fal-ai/bytedance/seedance/v1.5/pro/text-to-video";
const KOKORO_MODEL = "fal-ai/kokoro/french";

type InMemoryQueuedRun = MarketingStudioGenerationRunRecord & {
  rawResult: unknown | null;
};

function createInMemoryRunProcessorStore() {
  const runs = new Map<string, InMemoryQueuedRun>();
  let claimLock = false;

  function buildRun(params: {
    runId: string;
    campaignId: string;
    requestId: string;
    submissionKey: string;
    input: MarketingStudioGenerationRunRecord["input"];
  }): InMemoryQueuedRun {
    const now = new Date().toISOString();

    return {
      id: params.runId,
      campaignId: params.campaignId,
      workspaceId: "workspace-test",
      createdBy: "user-test",
      submissionKey: params.submissionKey,
      requestId: params.requestId,
      status: "queued",
      input: params.input,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      createdAt: now,
      updatedAt: now,
      rawResult: null,
    };
  }

  const store: MarketingStudioGenerationRunProcessorStore & {
    enqueue: (params: {
      submissionKey: string;
      requestId: string;
      input: MarketingStudioGenerationRunRecord["input"];
    }) => Promise<{
      runId: string;
      campaignId: string;
      status: "queued";
      wasCreated: boolean;
    }>;
    read: (runId: string) => InMemoryQueuedRun | null;
    claimCount: number;
  } = {
    claimCount: 0,
    async enqueue(params) {
      const existing = [...runs.values()].find(
        (run) => run.submissionKey === params.submissionKey,
      );

      if (existing) {
        return {
          runId: existing.id,
          campaignId: existing.campaignId,
          status: "queued",
          wasCreated: false,
        };
      }

      const runId = `run-${runs.size + 1}`;
      const campaignId = `campaign-${runs.size + 1}`;
      const run = buildRun({
        runId,
        campaignId,
        requestId: params.requestId,
        submissionKey: params.submissionKey,
        input: params.input,
      });
      runs.set(runId, run);

      return {
        runId,
        campaignId,
        status: "queued",
        wasCreated: true,
      };
    },
    read(runId) {
      return runs.get(runId) ?? null;
    },
    async claimNextQueuedRun() {
      if (claimLock) {
        return null;
      }

      claimLock = true;
      try {
        const run = [...runs.values()].find((candidate) => candidate.status === "queued");
        if (!run) {
          return null;
        }

        const claimed = {
          ...run,
          status: "running" as const,
          startedAt: run.startedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        runs.set(claimed.id, {
          ...claimed,
          rawResult: run.rawResult,
        });
        store.claimCount += 1;
        return claimed;
      } finally {
        claimLock = false;
      }
    },
    async completeRun(params) {
      const current = runs.get(params.runId);
      if (!current) {
        throw new Error("Run not found.");
      }

      runs.set(params.runId, {
        ...current,
        status: "completed",
        errorMessage: null,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rawResult: params.result,
      });
    },
    async failRun(params) {
      const current = runs.get(params.runId);
      if (!current) {
        throw new Error("Run not found.");
      }

      runs.set(params.runId, {
        ...current,
        status: "failed",
        errorMessage:
          params.error instanceof Error ? params.error.message : String(params.error),
        failedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  };

  return store;
}

function createInMemorySessionStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function buildTestBundle() {
  return {
    id: "marketing-studio-media-layer-test-bundle",
    campaign: {
      id: "marketing-studio-media-layer-test-campaign",
      name: "Campagne media layer smoke test",
      objective: "education",
      audience: "Hôtes et conciergeries",
      tone: "professional",
      cta: "Découvrir Norixo.io",
      websiteUrl: "https://norixo.io",
      language: "fr",
      platforms: ["facebook", "instagram", "linkedin", "tiktok"],
      formats: ["post", "reel"],
      durationDays: 30,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      hashtags: ["#Norixo"],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    creative: {
      creativeConcept:
        "Mettre en scène un audit concret d'annonce courte durée avec analyse photo, friction points et priorités d'amélioration.",
      visualStyle: "premium saas editorial",
      layout: "single-focus composition",
      overlays: [],
      imagePrompt:
        "Create a premium Norixo campaign visual showing a short-term rental listing audit with clear photo analysis, friction points and prioritized recommendations.",
      negativePrompt: "No watermarks. No unreadable text.",
      videoPrompt:
        "Show a short-term rental listing being analyzed and improved with one strong visual progression from friction to clarity.",
      brandChecklist: ["Norixo", "premium", "audit"],
    },
    video: {
      storyboard:
        "Scene 1: listing photos audit. Scene 2: friction points highlighted. Scene 3: prioritized improvements.",
      script:
        "Norixo aide les hotes a reperer les photos faibles et a transformer les points de friction en actions claires.",
      timeline: "0-5s hook | 5-10s improvements",
      scenes: [
        {
          scene: 1,
          duration: "0-5s",
          visual: "Audit photo d'annonce courte durée",
          onScreenText: "Audit photo",
          voiceOver: "Repérez les photos qui freinent la réservation.",
          transition: "cut",
        },
        {
          scene: 2,
          duration: "5-10s",
          visual: "Recommandations Norixo priorisées",
          onScreenText: "Priorités claires",
          voiceOver: "Passez des frictions aux actions prioritaires.",
          transition: "fade",
        },
      ],
      voice: "professional",
      transitions: ["cut", "fade"],
      captions: "Audit listing photos with Norixo",
      videoPrompt:
        "Vertical reel showing a short-term rental listing photo audit, visible friction points and clear improvement priorities for hosts.",
    },
    publisher: {
      mode: "draft_only",
      canPublish: false,
      requiresApproval: true,
      channels: {
        facebook: {
          platform: "facebook",
          status: "draft",
          copy: "Analysez vos photos d'annonce avec Norixo.",
          caption:
            "Identifiez les visuels faibles, les points de friction et les actions à prioriser.",
          hashtags: ["#Norixo", "#AirbnbHost"],
          assetPrompt:
            "Create a Facebook visual showing a listing photo audit and prioritized recommendations.",
          videoPrompt:
            "Short reel about listing photo audit and actionable recommendations.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        instagram: {
          platform: "instagram",
          status: "draft",
          copy: "Passez d'une annonce moyenne à une annonce plus claire.",
          caption:
            "Montrez visuellement comment Norixo détecte les frictions photo et les priorités d'amélioration.",
          hashtags: ["#Norixo", "#ShortTermRental"],
          assetPrompt:
            "Create an Instagram visual showing photo friction points and clearer listing presentation.",
          videoPrompt:
            "Vertical reel about photo audit, friction points and improved listing clarity.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        linkedin: {
          platform: "linkedin",
          status: "draft",
          copy: "Structurez l'analyse qualité de vos annonces avec Norixo.",
          caption:
            "Mettre en avant une lecture plus analytique des photos, des frictions et des recommandations.",
          hashtags: ["#Norixo", "#PropertyManagement"],
          assetPrompt:
            "Create a LinkedIn cover showing structured listing analysis and prioritized improvements.",
          videoPrompt:
            "Professional reel angle about listing analysis and optimization priorities.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
        tiktok: {
          platform: "tiktok",
          status: "draft",
          copy: "Photo faible, confiance perdue.",
          caption:
            "Photo faible. Confiance plus basse. Voyez la friction principale et l'action a prioriser.",
          hashtags: ["#Norixo", "#TikTokHosts", "#ShortTermRental"],
          assetPrompt:
            "Create a TikTok-native visual hook around one weak listing photo and one clear action cue.",
          videoPrompt:
            "TikTok-native 10 second reel with a visual hook, one friction point and one immediate action cue.",
          localizedVariants: {},
          approvalRequired: true,
          publishAction: "manual_review_required",
        },
      },
    },
  } as const;
}

function installFalFetchMock() {
  const originalFetch = globalThis.fetch;
  let generationStatusCalls = 0;
  let submitCalls = 0;
  let resultCalls = 0;
  let mp4DownloadCalls = 0;
  let kokoroSubmitCalls = 0;
  let kokoroStatusCalls = 0;
  let kokoroResultCalls = 0;
  let kokoroAudioDownloadCalls = 0;
  const statusUrls: string[] = [];
  const resultUrls: string[] = [];
  const submitPayloads: unknown[] = [];
  const kokoroPayloads: unknown[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (
      url ===
        `https://queue.fal.run/${SEEDANCE_MODEL}` &&
      method === "POST"
    ) {
      submitCalls += 1;
      submitPayloads.push(
        typeof init?.body === "string" ? JSON.parse(init.body) : null,
      );
      return new Response(
        JSON.stringify({
          request_id: "fal-generation-test-id",
          status: "IN_QUEUE",
          status_url:
            `https://queue.fal.run/${SEEDANCE_MODEL}/requests/fal-generation-test-id/status-from-submit`,
          response_url:
            `https://queue.fal.run/${SEEDANCE_MODEL}/requests/fal-generation-test-id/result-from-submit`,
          cancel_url:
            `https://queue.fal.run/${SEEDANCE_MODEL}/requests/fal-generation-test-id/cancel`,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url === `https://queue.fal.run/${KOKORO_MODEL}` &&
      method === "POST"
    ) {
      kokoroSubmitCalls += 1;
      kokoroPayloads.push(
        typeof init?.body === "string" ? JSON.parse(init.body) : null,
      );
      return new Response(
        JSON.stringify({
          request_id: "fal-kokoro-test-id",
          status: "IN_QUEUE",
          status_url:
            `https://queue.fal.run/${KOKORO_MODEL}/requests/fal-kokoro-test-id/status-from-submit`,
          response_url:
            `https://queue.fal.run/${KOKORO_MODEL}/requests/fal-kokoro-test-id/result-from-submit`,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        `https://queue.fal.run/${SEEDANCE_MODEL}/requests/fal-generation-test-id/status-from-submit` &&
      method === "GET"
    ) {
      statusUrls.push(url);
      generationStatusCalls += 1;

      if (generationStatusCalls === 1) {
        return new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          status: "COMPLETED",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        `https://queue.fal.run/${SEEDANCE_MODEL}/requests/fal-generation-test-id/result-from-submit` &&
      method === "GET"
    ) {
      resultCalls += 1;
      resultUrls.push(url);
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          video: {
            url: "https://cdn.fal.test/reel.mp4",
          },
          thumbnail: {
            url: "https://cdn.fal.test/reel.jpg",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url === "https://cdn.fal.test/reel.mp4" && method === "GET") {
      mp4DownloadCalls += 1;
      return new Response(Buffer.from("fake-fal-mp4-binary"), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    }

    if (
      url ===
        `https://queue.fal.run/${KOKORO_MODEL}/requests/fal-kokoro-test-id/status-from-submit` &&
      method === "GET"
    ) {
      kokoroStatusCalls += 1;
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (
      url ===
        `https://queue.fal.run/${KOKORO_MODEL}/requests/fal-kokoro-test-id/result-from-submit` &&
      method === "GET"
    ) {
      kokoroResultCalls += 1;
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          audio: {
            url: "https://cdn.fal.test/kokoro.wav",
            content_type: "audio/wav",
            file_name: "kokoro.wav",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url === "https://cdn.fal.test/kokoro.wav" && method === "GET") {
      kokoroAudioDownloadCalls += 1;
      return new Response(Buffer.from("fake-kokoro-wav-binary"), {
        status: 200,
        headers: { "content-type": "audio/wav" },
      });
    }

    if (typeof originalFetch === "function") {
      return originalFetch(input, init);
    }

    throw new Error(`Unhandled fetch mock request: ${method} ${url}`);
  }) as typeof globalThis.fetch;

  return {
    restore() {
      globalThis.fetch = originalFetch;
    },
    getGenerationStatusCalls() {
      return generationStatusCalls;
    },
    getSubmitCalls() {
      return submitCalls;
    },
    getResultCalls() {
      return resultCalls;
    },
    getMp4DownloadCalls() {
      return mp4DownloadCalls;
    },
    getKokoroSubmitCalls() {
      return kokoroSubmitCalls;
    },
    getKokoroStatusCalls() {
      return kokoroStatusCalls;
    },
    getKokoroResultCalls() {
      return kokoroResultCalls;
    },
    getKokoroAudioDownloadCalls() {
      return kokoroAudioDownloadCalls;
    },
    getStatusUrls() {
      return [...statusUrls];
    },
    getResultUrls() {
      return [...resultUrls];
    },
    getSubmitPayloads() {
      return [...submitPayloads];
    },
    getKokoroPayloads() {
      return [...kokoroPayloads];
    },
  };
}

async function createFakeFfmpegExecutable() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "norixo-fake-ffmpeg-"));
  const executablePath = path.join(directory, "fake-ffmpeg.js");
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const videoPath = args[args.indexOf("-i") + 1];
const audioPath = args[args.lastIndexOf("-i") + 1];
const outputPath = args[args.length - 1];
const video = fs.readFileSync(videoPath);
const audio = fs.readFileSync(audioPath);
fs.writeFileSync(outputPath, Buffer.concat([Buffer.from("muxed:"), video, Buffer.from("::"), audio]));
process.stderr.write("fake-ffmpeg-ok");
`;

  await fs.writeFile(executablePath, script, { mode: 0o755 });
  await fs.chmod(executablePath, 0o755);

  return {
    executablePath,
    async cleanup() {
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}

function withTemporaryEnv<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const previousEntries = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return run().finally(() => {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function main() {
  const bundle = buildTestBundle();
  const creativeDirectorPrompt = buildCreativeDirectorPrompt({
    contentTitle: "Identifier les points de friction d'une annonce",
    hook: "Voir plus clairement ce qui peut freiner une annonce",
    channel: "facebook",
    format: "post",
    visualGoal: "Créer une direction visuelle premium pour une image marketing Norixo.io",
    language: "fr",
  });
  const rebuiltRequests = buildMediaAssetRequestsFromBundle(bundle as never);
  const bundleAssets = buildMediaAssets(rebuiltRequests);

  assert(rebuiltRequests.length > 0, "buildMediaAssetRequestsFromBundle() returned no requests.");
  assert(bundleAssets.length === rebuiltRequests.length, "buildMediaAssets() length is invalid.");
  assert(
    creativeDirectorPrompt.includes(
      "`gptImagePrompt` is the source of truth for image generation and must communicate the campaign idea primarily through visual objects and composition.",
    ),
    "Expected Creative Director instructions to make visual objects and composition the primary image prompt strategy.",
  );
  assert(
    creativeDirectorPrompt.includes("- Do not request title overlays."),
    "Expected Creative Director instructions to forbid title overlays.",
  );
  assert(
    creativeDirectorPrompt.includes("- Do not request subtitle overlays."),
    "Expected Creative Director instructions to forbid subtitle overlays.",
  );
  assert(
    creativeDirectorPrompt.includes("- Do not request marketing copy inside the image."),
    "Expected Creative Director instructions to forbid marketing copy inside the image.",
  );
  assert(
    creativeDirectorPrompt.includes("- Do not embed CTA text inside the image."),
    "Expected Creative Director instructions to forbid CTA text inside the image.",
  );

  const heroRequest = rebuiltRequests.find((request) => request.id.endsWith("-hero-image"));
  const facebookRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-facebook-post-image"),
  );
  const linkedInRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-linkedin-cover-image"),
  );
  const thumbnailRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-video-thumbnail"),
  );
  const reelRequest = rebuiltRequests.find((request) =>
    request.id.endsWith("-instagram-reel"),
  );

  assert(heroRequest, "Hero media request is missing.");
  assert(facebookRequest, "Facebook media request is missing.");
  assert(linkedInRequest, "LinkedIn media request is missing.");
  assert(thumbnailRequest, "Thumbnail media request is missing.");
  assert(reelRequest, "Reel media request is missing.");
  const reelRequestId = reelRequest.id;

  const promptOrderChecks = [
    {
      request: heroRequest,
      role: "Asset role: premium hero image for the campaign.",
    },
    {
      request: facebookRequest,
      role: "Asset role: scroll-stopping Facebook post image.",
    },
    {
      request: linkedInRequest,
      role: "Asset role: professional LinkedIn cover image.",
    },
    {
      request: thumbnailRequest,
      role: "Asset role: high-impact video thumbnail.",
    },
  ] as const;

  for (const item of promptOrderChecks) {
    assert(
      item.request.prompt.includes(item.role),
      `Expected media prompt to include asset role: ${item.role}`,
    );
    const roleIndex = item.request.prompt.indexOf(item.role);
    const creativeDirectionIndex = item.request.prompt.indexOf(
      "Supporting campaign creative direction:",
    );

    assert(
      roleIndex !== -1 && creativeDirectionIndex !== -1 && roleIndex < creativeDirectionIndex,
      `Expected asset role to appear before supporting creative direction for ${item.request.id}.`,
    );
  }

  const imagePromptChecks = [
    heroRequest,
    facebookRequest,
    linkedInRequest,
    thumbnailRequest,
  ] as const;

  for (const request of imagePromptChecks) {
    assert(
      request.prompt.includes("Premium editorial B2B SaaS campaign visual for hospitality technology."),
      `Expected ${request.id} prompt to include the premium editorial B2B SaaS direction.`,
    );
    assert(
      request.prompt.includes(
        "Norixo-inspired product analysis visual, not a reproduction of the real Norixo interface.",
      ),
      `Expected ${request.id} prompt to include the Norixo-inspired product analysis direction.`,
    );
    assert(
      request.prompt.includes("Clean neutral premium background with restrained blue and cyan accents."),
      `Expected ${request.id} prompt to include restrained blue and cyan accents.`,
    );
    assert(
      request.prompt.includes("One dominant visual idea."),
      `Expected ${request.id} prompt to include a dominant visual idea instruction.`,
    );
    assert(
      request.prompt.includes("listing photo audit") ||
        request.prompt.includes("visual friction markers"),
      `Expected ${request.id} prompt to include listing/photo analysis or friction marker guidance.`,
    );
    assert(
      request.prompt.includes(
        "Avoid generic stock SaaS visuals, generic futuristic AI imagery, glowing brains, humanoid robots, random holograms, crypto aesthetics and cyberpunk styling.",
      ),
      `Expected ${request.id} prompt to forbid generic futuristic AI imagery.`,
    );
    assert(
      request.prompt.includes(
        "Do not ask for the exact Norixo dashboard, the exact Norixo interface, or a real Norixo screenshot.",
      ),
      `Expected ${request.id} prompt to forbid exact Norixo interface reproduction.`,
    );
  }

  const videoRequests = rebuiltRequests.filter((request) => isVideoLikeKind(request.kind));
  const videoAssets = bundleAssets.filter((asset) => isVideoLikeKind(asset.kind));

  assert(videoRequests.length === 1, "Expected exactly one reel request in the test bundle.");
  assert(videoAssets.length === 1, "Expected exactly one reel asset in the test bundle.");
  assert(
    reelRequest.expectedDurationSeconds === 10,
    "Expected reel request to target a 10 second duration.",
  );
  assert(
    reelRequest.targetLanguage === "fr",
    "Expected reel request targetLanguage to stay aligned with the campaign language.",
  );
  assert(
    !reelRequest.prompt.includes("French voice-over") &&
      !reelRequest.prompt.includes("The narrator says exactly:") &&
      !reelRequest.prompt.includes("spoken dialogue"),
    "Expected reel prompt to stay visual-only and not contain narration instructions.",
  );
  assert(
    reelRequest.prompt.includes("Silent visual-only video.") &&
      reelRequest.prompt.includes(
        "Do not generate narration, voice-over or character speech.",
      ) &&
      reelRequest.prompt.includes(
        "Do not rely on audio to communicate the story.",
      ),
    "Expected reel prompt to explicitly avoid spoken dialogue dependency.",
  );

  const narrationRequest = buildNarrationRequestFromBundle({
    bundle: bundle as never,
    videoAsset: {
      id: reelRequest.id,
      kind: reelRequest.kind,
      status: "generated",
      platform: reelRequest.platform,
      ratio: reelRequest.ratio,
      language: reelRequest.targetLanguage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  assert(narrationRequest, "Expected narration request to be built from bundle video content.");
  assert(
    narrationRequest.language === "fr",
    "Expected narration request language to stay aligned with campaign.language.",
  );
  assert(
    narrationRequest.text.trim().length > 0,
    "Expected narration request text to be non-empty.",
  );
  assert(
    narrationRequest.text === bundle.video.script,
    "Expected narration request text to come from bundle.video.script first.",
  );
  const facebookCaption = String(bundle.publisher.channels.facebook.caption);
  const instagramCaption = String(bundle.publisher.channels.instagram.caption);
  const tikTokCaption = String(bundle.publisher.channels.tiktok.caption);
  assert(
    narrationRequest.text !== facebookCaption &&
      narrationRequest.text !== instagramCaption &&
      narrationRequest.text !== tikTokCaption,
    "Expected narration request text to avoid Facebook, Instagram or TikTok caption fallback.",
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      const productionConfiguration = getMediaConfiguration();
      const productionPreflight = buildMarketingStudioMediaPreflight(
        productionConfiguration,
      );
      assert(
        productionConfiguration.imageProvider === "openai" &&
          productionConfiguration.videoProvider === "fal" &&
          productionConfiguration.storageProvider === "supabase" &&
          productionConfiguration.uploadEnabled === true &&
          productionConfiguration.pollingEnabled === true,
        "Expected production-ready media configuration to resolve to openai + fal + supabase.",
      );
      assert(
        isProductionReadyMediaConfiguration(productionConfiguration),
        "Expected production-ready media configuration to pass the strict preflight.",
      );
      assert(
        productionPreflight.productionReady === true,
        "Expected strict marketing studio preflight to pass in production-ready mode.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: undefined,
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      let enqueueCalls = 0;
      const runResult = await executeMarketingStudioRun({
        body: {
          name: "Preflight fail image provider",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "preflight-fail-image-provider",
        },
        requestId: "preflight-fail-image-provider",
        enqueueRun: async () => {
          enqueueCalls += 1;
          throw new Error("enqueue should not be called.");
        },
      });
      assert(runResult.ok === false, "Expected image provider preflight to fail.");
      assert(
        runResult.mediaConfiguration,
        "Expected image provider preflight failure to expose a media configuration snapshot.",
      );
      assert(
        runResult.mediaConfiguration.imageProvider === "fake",
        "Expected image provider preflight failure to surface the fake provider snapshot.",
      );
      assert(
        enqueueCalls === 0,
        "Expected enqueue not to be called when image provider preflight fails.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: undefined,
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      let enqueueCalls = 0;
      const runResult = await executeMarketingStudioRun({
        body: {
          name: "Preflight fail storage provider",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "preflight-fail-storage-provider",
        },
        requestId: "preflight-fail-storage-provider",
        enqueueRun: async () => {
          enqueueCalls += 1;
          throw new Error("enqueue should not be called.");
        },
      });
      assert(runResult.ok === false, "Expected storage provider preflight to fail.");
      assert(
        runResult.mediaConfiguration,
        "Expected storage provider preflight failure to expose a media configuration snapshot.",
      );
      assert(
        runResult.mediaConfiguration.storageProvider === "none",
        "Expected storage provider preflight failure to surface the none storage snapshot.",
      );
      assert(
        enqueueCalls === 0,
        "Expected enqueue not to be called when storage provider preflight fails.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: undefined,
      FAL_KEY: undefined,
      FAL_VIDEO_MODEL: undefined,
      MEDIA_POLL_INTERVAL_MS: "0",
      MEDIA_MAX_POLL_ATTEMPTS: "2",
      NODE_ENV: "production",
    },
    async () => {
      let enqueueCalls = 0;
      const fallbackConfiguration = getMediaConfiguration();
      assert(
        fallbackConfiguration.imageProvider === "openai",
        "Expected image provider to remain openai in fallback mode.",
      );
      assert(
        fallbackConfiguration.videoProvider === "fake",
        "Expected video provider to remain fake when fal is disabled.",
      );
      assert(
        fallbackConfiguration.storageProvider === "supabase",
        "Expected storage provider to remain supabase when storage is enabled in the video preflight failure scenario.",
      );
      const runResult = await executeMarketingStudioRun({
        body: {
          name: "Preflight fail video provider",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "preflight-fail-video-provider",
        },
        requestId: "preflight-fail-video-provider",
        enqueueRun: async () => {
          enqueueCalls += 1;
          throw new Error("enqueue should not be called.");
        },
      });
      assert(runResult.ok === false, "Expected video provider preflight to fail.");
      assert(
        runResult.mediaConfiguration,
        "Expected video provider preflight failure to expose a media configuration snapshot.",
      );
      assert(
        runResult.mediaConfiguration.videoProvider === "fake",
        "Expected video provider preflight failure to surface the fake video snapshot.",
      );
      assert(
        enqueueCalls === 0,
        "Expected enqueue not to be called when video provider preflight fails.",
      );

      const fallbackProviders = listMediaProviders();
      const fallbackProviderStatusById = new Map(
        fallbackProviders.map((provider) => [provider.id, provider.status]),
      );
      assert(
        fallbackProviderStatusById.get("openai") === "available",
        "Expected openai media provider to stay available in fallback mode.",
      );
      assert(
        fallbackProviderStatusById.get("fal") === "unconfigured",
        "Expected fal media provider to be unconfigured in fallback mode.",
      );

      const fallbackSelections = selectMediaProvidersForRequests(rebuiltRequests);
      assert(
        fallbackSelections.some((selection) => selection.provider?.id === "fake"),
        "Expected fake provider fallback to remain available for video requests.",
      );
      assert(
        fallbackSelections.some(
          (selection) =>
            !isVideoLikeKind(selection.requestId) && selection.provider?.id === "openai",
        ) || fallbackSelections.some((selection) => selection.provider?.id === "openai"),
        "Expected openai to remain selectable for image requests in fallback mode.",
      );

      const fallbackSelectedResults =
        await runMediaProviderSelectionForRequests(videoRequests);
      assert(
        fallbackSelectedResults.every(
          (item) => item.provider === "fake" && item.status === "generated",
        ),
        "Expected video requests to resolve through fake provider when fal is disabled.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: undefined,
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      let enqueueCalls = 0;
      const runResult = await executeMarketingStudioRun({
        body: {
          name: "Paid generation guard disabled",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "paid-generation-guard-disabled",
        },
        requestId: "paid-generation-guard-disabled",
        enqueueRun: async () => {
          enqueueCalls += 1;
          throw new Error("enqueue should not be called.");
        },
      });
      assert(runResult.ok === false, "Expected paid generation guard to fail closed.");
      assert(
        runResult.error === "Paid generation disabled by safety guard.",
        "Expected paid generation guard to return the explicit safety error.",
      );
      assert(
        enqueueCalls === 0,
        "Expected enqueue not to be called when paid generation is disabled.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: undefined,
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      const store = createInMemoryRunProcessorStore();
      await store.enqueue({
        submissionKey: "worker-disabled",
        requestId: "worker-disabled-request",
        input: buildMarketingStudioOrchestratorInput({
          name: "Worker disabled",
          objective: "education",
          language: "fr",
          channels: ["facebook", "instagram"],
        }),
      });

      let orchestratorCalls = 0;
      const result = await processNextMarketingStudioGenerationRun({
        store,
        runOrchestrator: async () => {
          orchestratorCalls += 1;
          throw new Error("runOrchestrator should not be called.");
        },
      });

      assert(
        result.status === "disabled",
        "Expected worker to return disabled when paid generation guard is off.",
      );
      assert(
        result.error === MARKETING_STUDIO_WORKER_DISABLED_ERROR,
        "Expected worker disabled guard to return the explicit safety message.",
      );
      assert(store.claimCount === 0, "Expected worker disabled guard to block claim.");
      assert(
        orchestratorCalls === 0,
        "Expected worker disabled guard to block orchestrator execution.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: undefined,
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      const store = createInMemoryRunProcessorStore();
      await store.enqueue({
        submissionKey: "worker-preflight-image",
        requestId: "worker-preflight-image-request",
        input: buildMarketingStudioOrchestratorInput({
          name: "Worker preflight image",
          objective: "education",
          language: "fr",
          channels: ["facebook", "instagram"],
        }),
      });

      let orchestratorCalls = 0;
      const result = await processNextMarketingStudioGenerationRun({
        store,
        runOrchestrator: async () => {
          orchestratorCalls += 1;
          throw new Error("runOrchestrator should not be called.");
        },
      });

      assert(
        result.status === "preflight_blocked",
        "Expected worker preflight to block fake image runtime before claim.",
      );
      assert(
        result.error === MARKETING_STUDIO_WORKER_MEDIA_RUNTIME_ERROR,
        "Expected worker preflight to return the explicit runtime error.",
      );
      assert(store.claimCount === 0, "Expected worker preflight to block claim.");
      assert(
        orchestratorCalls === 0,
        "Expected worker preflight to block orchestrator execution.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: undefined,
      FAL_KEY: undefined,
      NODE_ENV: "production",
    },
    async () => {
      const store = createInMemoryRunProcessorStore();
      await store.enqueue({
        submissionKey: "worker-preflight-video",
        requestId: "worker-preflight-video-request",
        input: buildMarketingStudioOrchestratorInput({
          name: "Worker preflight video",
          objective: "education",
          language: "fr",
          channels: ["facebook", "instagram"],
        }),
      });

      let orchestratorCalls = 0;
      const result = await processNextMarketingStudioGenerationRun({
        store,
        runOrchestrator: async () => {
          orchestratorCalls += 1;
          throw new Error("runOrchestrator should not be called.");
        },
      });

      assert(
        result.status === "preflight_blocked",
        "Expected worker preflight to block fake video runtime before claim.",
      );
      assert(store.claimCount === 0, "Expected fake video runtime to block claim.");
      assert(
        orchestratorCalls === 0,
        "Expected fake video runtime to block orchestrator execution.",
      );
    },
  );

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: undefined,
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      const store = createInMemoryRunProcessorStore();
      await store.enqueue({
        submissionKey: "worker-preflight-storage",
        requestId: "worker-preflight-storage-request",
        input: buildMarketingStudioOrchestratorInput({
          name: "Worker preflight storage",
          objective: "education",
          language: "fr",
          channels: ["facebook", "instagram"],
        }),
      });

      let orchestratorCalls = 0;
      const result = await processNextMarketingStudioGenerationRun({
        store,
        runOrchestrator: async () => {
          orchestratorCalls += 1;
          throw new Error("runOrchestrator should not be called.");
        },
      });

      assert(
        result.status === "preflight_blocked",
        "Expected worker preflight to block none storage runtime before claim.",
      );
      assert(store.claimCount === 0, "Expected none storage runtime to block claim.");
      assert(
        orchestratorCalls === 0,
        "Expected none storage runtime to block orchestrator execution.",
      );
    },
  );

  {
    const migrationSql = await fs.readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260709120000_create_marketing_studio_generation_runs.sql",
      ),
      "utf8",
    );

    assert(
      !migrationSql.includes(") to authenticated, service_role;"),
      "Expected queue RPC grants to stop exposing authenticated execution.",
    );
    assert(
      !/grant execute on function public\.enqueue_marketing_studio_generation_run[\s\S]*to authenticated\b/i.test(
        migrationSql,
      ),
      "Expected enqueue RPC not to grant authenticated execution.",
    );
    assert(
      !/grant execute on function public\.claim_marketing_studio_generation_run\(\)[\s\S]*to authenticated\b/i.test(
        migrationSql,
      ),
      "Expected claim RPC not to grant authenticated execution.",
    );
    assert(
      /grant execute on function public\.enqueue_marketing_studio_generation_run[\s\S]*to service_role;/i.test(
        migrationSql,
      ),
      "Expected enqueue RPC to remain executable by service_role.",
    );
    assert(
      /grant execute on function public\.claim_marketing_studio_generation_run\(\)\s+to service_role;/i.test(
        migrationSql,
      ),
      "Expected claim RPC to remain executable by service_role.",
    );
    assert(
      /revoke all on function public\.enqueue_marketing_studio_generation_run[\s\S]*from public;/i.test(
        migrationSql,
      ) &&
        /revoke all on function public\.enqueue_marketing_studio_generation_run[\s\S]*from anon;/i.test(
          migrationSql,
        ) &&
        /revoke all on function public\.enqueue_marketing_studio_generation_run[\s\S]*from authenticated;/i.test(
          migrationSql,
        ),
      "Expected enqueue RPC to revoke public, anon, and authenticated execution.",
    );
    assert(
      /revoke all on function public\.claim_marketing_studio_generation_run\(\)\s+from public;/i.test(
        migrationSql,
      ) &&
        /revoke all on function public\.claim_marketing_studio_generation_run\(\)\s+from anon;/i.test(
          migrationSql,
        ) &&
        /revoke all on function public\.claim_marketing_studio_generation_run\(\)\s+from authenticated;/i.test(
          migrationSql,
        ),
      "Expected claim RPC to revoke public, anon, and authenticated execution.",
    );
    assert(
      migrationSql.includes("pg_try_advisory_xact_lock"),
      "Expected claim RPC to use an advisory transaction lock.",
    );
    assert(
      migrationSql.includes("where status = 'running'"),
      "Expected claim RPC to refuse a new claim while a run is already running.",
    );
  }

  {
    const storage = createInMemorySessionStorage();
    const sharedFingerprint = buildMarketingStudioSubmissionFingerprint({
      name: "Campagne",
      objective: "education",
      channels: ["facebook", "instagram"],
    });
    const changedFingerprint = buildMarketingStudioSubmissionFingerprint({
      name: "Campagne",
      objective: "education",
      channels: ["facebook", "instagram", "tiktok"],
    });

    const firstPending = resolveMarketingStudioPendingSubmission({
      storage,
      fingerprint: sharedFingerprint,
      now: "2026-07-09T12:00:00.000Z",
      createSubmissionKey: () => "submission-1",
    });
    const reusedPending = resolveMarketingStudioPendingSubmission({
      storage,
      fingerprint: sharedFingerprint,
      now: "2026-07-09T12:00:10.000Z",
      createSubmissionKey: () => "submission-2",
    });
    const changedPending = resolveMarketingStudioPendingSubmission({
      storage,
      fingerprint: changedFingerprint,
      now: "2026-07-09T12:01:00.000Z",
      createSubmissionKey: () => "submission-3",
    });

    assert(
      firstPending.submissionKey === reusedPending.submissionKey,
      "Expected the same payload fingerprint to reuse the pending submissionKey.",
    );
    assert(
      changedPending.submissionKey !== reusedPending.submissionKey,
      "Expected a different payload fingerprint to create a new submissionKey.",
    );
    assert(
      readMarketingStudioPendingSubmission(storage)?.submissionKey ===
        changedPending.submissionKey,
      "Expected the latest pending submission to stay persisted before fetch success.",
    );
    clearMarketingStudioPendingSubmission(storage);
    assert(
      readMarketingStudioPendingSubmission(storage) === null,
      "Expected pending submission cleanup to remove the sessionStorage entry.",
    );
  }

  await withTemporaryEnv(
    {
      OPENAI_API_KEY: "sk-test-openai-secret",
      FAL_KEY: "fal-secret-value",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value",
    },
    async () => {
      const sanitized = sanitizeMarketingStudioRunError(
        'Authorization: Bearer jwt.secret.token OPENAI=sk-test-openai-secret FAL=fal-secret-value SERVICE=service-role-secret-value https://example.test/file.mp4?token=abc123&access_token=def456&api_key=ghi789&key=jkl000&signature=sig999',
      );

      assert(
        !sanitized.includes("jwt.secret.token"),
        "Expected bearer token values to be redacted from persisted errors.",
      );
      assert(
        !sanitized.includes("sk-test-openai-secret"),
        "Expected OpenAI secret values to be redacted from persisted errors.",
      );
      assert(
        !sanitized.includes("fal-secret-value"),
        "Expected FAL secret values to be redacted from persisted errors.",
      );
      assert(
        !sanitized.includes("service-role-secret-value"),
        "Expected service role secret values to be redacted from persisted errors.",
      );
      assert(
        sanitized.includes("[REDACTED]"),
        "Expected persisted errors to include explicit redaction markers.",
      );
      assert(
        !sanitized.includes("token=abc123") &&
          !sanitized.includes("access_token=def456") &&
          !sanitized.includes("api_key=ghi789") &&
          !sanitized.includes("key=jkl000") &&
          !sanitized.includes("signature=sig999"),
        "Expected sensitive URL query parameters to be redacted from persisted errors.",
      );
      assert(
        sanitizeMarketingStudioRunError(`x${"y".repeat(2000)}`).length <= 1000,
        "Expected persisted error messages to respect the maximum length cap.",
      );
    },
  );

  {
    const marketingStudioPageSource = await fs.readFile(
      path.join(
        process.cwd(),
        "app/dashboard/admin/marketing-studio/page.tsx",
      ),
      "utf8",
    );

    assert(
      marketingStudioPageSource.includes("RUN_STATUS_POLL_ERROR_THRESHOLD"),
      "Expected Marketing Studio polling to track consecutive status failures.",
    );
    assert(
      marketingStudioPageSource.includes("RUN_STATUS_TEMPORARY_ERROR_MESSAGE"),
      "Expected Marketing Studio polling to expose a temporary follow-up error.",
    );
    assert(
      /setTimeout\(\(\)\s*=>\s*\{\s*void pollRun\(\);\s*\},\s*RUN_STATUS_POLL_INTERVAL_MS\)/.test(
        marketingStudioPageSource,
      ),
      "Expected Marketing Studio polling failures to schedule another status poll.",
    );
  }

  await withTemporaryEnv(
    {
      MARKETING_STUDIO_PAID_GENERATION_ENABLED: "true",
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "true",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      NODE_ENV: "production",
    },
    async () => {
      const store = createInMemoryRunProcessorStore();
      const firstRun = await executeMarketingStudioRun({
        body: {
          name: "Async enqueue idempotent",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "async-enqueue-idempotent",
        },
        requestId: "async-enqueue-idempotent-1",
        enqueueRun: async ({ submissionKey, requestId, input }) =>
          store.enqueue({ submissionKey, requestId, input }),
      });

      assert(firstRun.ok === true, "Expected async enqueue to succeed.");
      assert(firstRun.status === 202, "Expected async enqueue to return 202.");
      assert(
        typeof firstRun.runId === "string" && typeof firstRun.campaignId === "string",
        "Expected async enqueue to return runId and campaignId.",
      );
      assert(firstRun.wasCreated === true, "Expected first enqueue to create a new run.");

      const secondRun = await executeMarketingStudioRun({
        body: {
          name: "Async enqueue idempotent",
          objective: "education",
          audience: "Hôtes",
          language: "fr",
          channels: ["facebook", "instagram"],
          submissionKey: "async-enqueue-idempotent",
        },
        requestId: "async-enqueue-idempotent-2",
        enqueueRun: async ({ submissionKey, requestId, input }) =>
          store.enqueue({ submissionKey, requestId, input }),
      });

      assert(secondRun.ok === true, "Expected second async enqueue to succeed.");
      assert(
        secondRun.runId === firstRun.runId &&
          secondRun.campaignId === firstRun.campaignId,
        "Expected duplicate submissionKey to reuse the same run and campaign.",
      );
      assert(
        secondRun.wasCreated === false,
        "Expected duplicate submissionKey to avoid creating a second run.",
      );

      const [claimedA, claimedB] = await Promise.all([
        store.claimNextQueuedRun(),
        store.claimNextQueuedRun(),
      ]);

      assert(
        [claimedA, claimedB].filter(Boolean).length === 1,
        "Expected atomic claim simulation to return a single claimed queued run.",
      );

      const claimedRun = claimedA ?? claimedB;
      assert(claimedRun, "Expected one run to be claimed.");

      const processedStatus = await processMarketingStudioGenerationRun(claimedRun, {
        store,
        runOrchestrator: async () => {
          throw new Error("Synthetic worker failure for zero-cost test.");
        },
      });

      assert(
        processedStatus === "failed",
        "Expected worker failure path to resolve to failed status.",
      );

      const failedRun = store.read(claimedRun.id);
      assert(failedRun, "Expected failed run to remain persisted.");
      assert(failedRun.status === "failed", "Expected failed run status to persist.");
      assert(
        failedRun.errorMessage === "Synthetic worker failure for zero-cost test.",
        "Expected failed run to persist the sanitized error message.",
      );
      assert(
        failedRun.rawResult === null,
        "Expected failed run not to persist a result payload.",
      );
    },
  );

  const fakeFfmpeg = await createFakeFfmpegExecutable();

  await withTemporaryEnv(
    {
      OPENAI_MEDIA_IMAGE_PROVIDER_ENABLED: "true",
      SUPABASE_MEDIA_STORAGE_ENABLED: "false",
      FAL_VIDEO_PROVIDER_ENABLED: "true",
      FAL_KEY: "test-fal-key",
      FAL_VIDEO_MODEL: SEEDANCE_MODEL,
      FAL_KOKORO_FRENCH_VOICE: "ff_siwis",
      FAL_KOKORO_FRENCH_SPEED: "1.1",
      FFMPEG_PATH: fakeFfmpeg.executablePath,
      FFMPEG_MUX_TIMEOUT_MS: "5000",
      MEDIA_POLL_INTERVAL_MS: "0",
      MEDIA_MAX_POLL_ATTEMPTS: "3",
    },
    async () => {
      const fetchMock = installFalFetchMock();

      try {
        const mediaConfiguration = getMediaConfiguration();
        assert(
          mediaConfiguration.imageProvider === "openai",
          "Expected image provider to remain openai when enabled.",
        );
        assert(
          mediaConfiguration.videoProvider === "fal",
          "Expected video provider to switch to fal when enabled and configured.",
        );
        assert(
          mediaConfiguration.pollingEnabled === true,
          "Expected media polling to be enabled for async fal video generation.",
        );
        assert(
          mediaConfiguration.uploadEnabled === false,
          "Expected media upload to remain disabled in the test to avoid real storage calls.",
        );
        const persistedBundle = buildMarketingCampaignBundle({
          ...(bundle as any),
          media: {
            requests: rebuiltRequests,
            assets: bundleAssets,
            configuration: mediaConfiguration,
          },
        });
        assert(
          persistedBundle.media?.configuration?.imageProvider === "openai" &&
            persistedBundle.media?.configuration?.videoProvider === "fal" &&
            persistedBundle.media?.configuration?.storageProvider === "none" &&
            persistedBundle.media?.configuration?.uploadEnabled === false &&
            persistedBundle.media?.configuration?.pollingEnabled === true,
          "Expected the final bundle to persist media.configuration.",
        );

        assert(
          mediaConfiguration.pollingEnabled === true,
          "Expected fal polling to stay enabled in configured mode.",
        );

        const registeredProviders = listMediaProviders();
        const providerStatusById = new Map(
          registeredProviders.map((provider) => [provider.id, provider.status]),
        );

        assert(
          providerStatusById.get("fake") === "available",
          "Expected fake media provider to remain available.",
        );
        assert(
          providerStatusById.get("openai") === "available",
          "Expected openai media provider to stay available.",
        );
        assert(
          providerStatusById.get("fal") === "available",
          "Expected fal media provider to be available.",
        );

        const falProvider = getMediaProviderById("fal");
        assert(falProvider, "Expected fal provider to be registered.");
        assert(
          listMediaProvidersByCapability("video").some(
            (provider) => provider.id === "fal",
          ),
          "Expected fal provider to be available for video capability.",
        );

        const selections = selectMediaProvidersForRequests(rebuiltRequests);
        const reelSelection = selections.find(
          (selection) => selection.requestId === reelRequestId,
        );
        assert(reelSelection, "Expected a provider selection for the reel request.");
        assert(
          reelSelection.provider?.id === "fal",
          "Expected reel request to select fal provider.",
        );

        assert(
          fetchMock.getSubmitCalls() === 0,
          "Expected no fal submit call before provider execution starts.",
        );

        const jobs = buildMediaGenerationJobs(videoRequests);
        assert(jobs.length === videoRequests.length, "Media generation jobs length is invalid.");
        assert(
          jobs.every((job) => job.status === "queued"),
          "Expected all video generation jobs to start queued.",
        );

        const executedJobs = await executeMediaGenerationJobs(jobs);
        assert(
          executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "running" &&
              (job.result?.status === "queued" || job.result?.status === "generating"),
          ),
          "Expected initial fal execution to stay async and running.",
        );
        assert(
          fetchMock.getSubmitCalls() === 1,
          "Expected exactly one fal submit POST for the reel request.",
        );
        assertNonEmptyString(
          executedJobs[0]?.externalJobId ?? null,
          "executedJobs[0].externalJobId",
        );
        assert(
          fetchMock.getResultCalls() === 0,
          "Expected no fal result request before completion.",
        );
        assert(
          fetchMock.getMp4DownloadCalls() === 0,
          "Expected no mp4 download before completion.",
        );

        const submitPayload = fetchMock.getSubmitPayloads()[0] as
          | Record<string, unknown>
          | undefined;
        assert(submitPayload, "Expected a fal submit payload to be captured.");
        assert(
          typeof submitPayload.prompt === "string" &&
            submitPayload.prompt.length > 0,
          "Expected fal submit payload to include a prompt.",
        );
        assert(
          submitPayload.duration === 10,
          "Expected fal submit payload to use duration 10 for the reel request.",
        );
        assert(
          submitPayload.aspect_ratio === "9:16",
          "Expected fal submit payload to use a 9:16 aspect ratio.",
        );
        assert(
          submitPayload.resolution === "720p",
          "Expected fal submit payload to target 720p resolution.",
        );
        assert(
          submitPayload.generate_audio === false,
          "Expected fal submit payload to disable native Seedance audio generation.",
        );
        assert(
          submitPayload.enable_safety_checker === true,
          "Expected fal submit payload to keep the safety checker enabled.",
        );
        assert(
          typeof submitPayload.prompt === "string" &&
            !submitPayload.prompt.includes("French voice-over") &&
            !submitPayload.prompt.includes("The narrator says exactly:") &&
            !submitPayload.prompt.includes("spoken dialogue"),
          "Expected fal submit payload to stay visual-only with no narration instruction.",
        );
        assert(
          typeof submitPayload.prompt === "string" &&
            submitPayload.prompt.includes(
              "Do not generate narration, voice-over or character speech.",
            ),
          "Expected fal submit payload to explicitly reject narration dependency.",
        );

        const firstPollResults = await pollMediaGenerationJobsStatus(executedJobs);
        assert(
          firstPollResults.every(
            (item) =>
              item.providerStatus?.provider === "fal" &&
              item.job.status === "running",
          ),
          "Expected first fal poll to remain in running state.",
        );
        assert(
          fetchMock.getSubmitCalls() === 1,
          "Expected no additional fal submit POST during polling.",
        );
        assert(
          fetchMock.getGenerationStatusCalls() === 1,
          "Expected one fal status call after the first poll.",
        );
        assert(
          fetchMock.getStatusUrls().every((url) =>
            url.endsWith("/requests/fal-generation-test-id/status-from-submit"),
          ),
          "Expected fal status polling to use the canonical status_url returned by fal submit.",
        );

        const pipelineResult = await runMediaGenerationPipeline(
          videoRequests,
          videoAssets,
        );
        assert(
          pipelineResult.executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "completed" &&
              job.result?.status === "generated",
          ),
          "Expected video pipeline jobs to resolve to generated through fal.",
        );
        assert(
          fetchMock.getSubmitCalls() === 2,
          "Expected exactly one fal submit POST per pipeline run.",
        );
        assert(
          fetchMock.getResultCalls() === 1,
          "Expected exactly one fal result fetch during the pipeline run.",
        );
        assert(
          fetchMock.getMp4DownloadCalls() === 1,
          "Expected exactly one MP4 download during the pipeline run.",
        );
        assert(
          fetchMock.getResultUrls().every((url) =>
            url.endsWith("/requests/fal-generation-test-id/result-from-submit"),
          ),
          "Expected fal result retrieval to use the canonical response_url returned by fal submit.",
        );
        assert(
          pipelineResult.assets.every(
            (asset) =>
              asset.status === "generated" &&
              asset.generationProvider === "fal" &&
              asset.metadata?.model === SEEDANCE_MODEL &&
              typeof asset.previewUrl === "string" &&
              typeof asset.downloadUrl === "string",
          ),
          "Expected pipeline video assets to expose preview and download URLs from fal with the Seedance model metadata.",
        );

        const updatedAssets = applyMediaGenerationJobsToAssets(
          pipelineResult.executedJobs,
          videoAssets,
        );
        assert(
          updatedAssets.every(
            (asset) =>
              asset.generationProvider === "fal" &&
              asset.status === "generated",
          ),
          "Expected updated video assets to preserve the fal provider.",
        );

        const engineResult = await runMediaEngine({
          requests: videoRequests,
          assets: videoAssets,
        });
        assert(
          engineResult.executedJobs.every(
            (job) =>
              job.providerId === "fal" &&
              job.result?.provider === "fal" &&
              job.status === "completed",
          ),
          "Expected media engine to complete the fal reel job.",
        );
        assert(
          fetchMock.getSubmitCalls() === 3,
          "Expected exactly one fal submit POST per independent engine run.",
        );
        assert(
          fetchMock.getResultCalls() === 2,
          "Expected exactly one fal result fetch per completed asynchronous run.",
        );
        assert(
          fetchMock.getMp4DownloadCalls() === 2,
          "Expected exactly one MP4 download per completed asynchronous run.",
        );
        assert(
          engineResult.assets.every(
            (asset) =>
              asset.status === "generated" &&
              asset.generationProvider === "fal" &&
              asset.metadata?.model === SEEDANCE_MODEL &&
              typeof asset.previewUrl === "string" &&
              asset.previewUrl.trim().length > 0 &&
              typeof asset.downloadUrl === "string" &&
              asset.downloadUrl.trim().length > 0,
          ),
          "Expected media engine reel asset to expose previewUrl/downloadUrl, the correct provider and the Seedance model metadata.",
        );

        const generatedVisualAsset = engineResult.assets[0];
        assert(generatedVisualAsset, "Expected one generated visual reel asset.");
        assert(
          generatedVisualAsset.language === "fr",
          "Expected generated visual asset to preserve the campaign language metadata.",
        );

        const kokoroNarrationResult =
          await falKokoroFrenchNarrationProvider.generateNarration(
            narrationRequest,
          );
        assert(
          kokoroNarrationResult.provider === "fal" &&
            kokoroNarrationResult.status === "generated" &&
            kokoroNarrationResult.asset?.language === "fr",
          "Expected Kokoro narration provider to return a generated French narration asset.",
        );
        assert(
          typeof kokoroNarrationResult.internalBinary?.base64 === "string" &&
            kokoroNarrationResult.internalBinary.base64.length > 0,
          "Expected Kokoro narration provider to convert remote audio to internalBinary.",
        );
        assert(
          kokoroNarrationResult.asset?.metadata?.voice === "ff_siwis" &&
            kokoroNarrationResult.asset?.metadata?.speed === 1.1,
          "Expected Kokoro narration metadata to preserve the configured voice and speed.",
        );
        assert(
          fetchMock.getKokoroSubmitCalls() === 1 &&
            fetchMock.getKokoroStatusCalls() === 1 &&
            fetchMock.getKokoroResultCalls() === 1 &&
            fetchMock.getKokoroAudioDownloadCalls() === 1,
          "Expected Kokoro narration provider to use submit -> status -> result -> audio download exactly once.",
        );
        const kokoroPayload = fetchMock.getKokoroPayloads()[0] as
          | Record<string, unknown>
          | undefined;
        assert(kokoroPayload, "Expected a Kokoro submit payload to be captured.");
        assert(
          kokoroPayload.prompt === bundle.video.script,
          "Expected Kokoro payload prompt to match the French narration script exactly.",
        );
        assert(
          kokoroPayload.voice === "ff_siwis" &&
            kokoroPayload.speed === 1.1,
          "Expected Kokoro payload to include the configured voice and speed.",
        );
        assert(
          !("language" in kokoroPayload),
          "Expected Kokoro payload to respect the official schema without a language field.",
        );

        const ffmpegArgv = buildFfmpegMuxArgv({
          videoPath: "/tmp/video.mp4",
          audioPath: "/tmp/audio.wav",
          outputPath: "/tmp/final.mp4",
        });
        assert(
          Array.isArray(ffmpegArgv) &&
            ffmpegArgv.includes("-c:v") &&
            ffmpegArgv.includes("copy") &&
            ffmpegArgv.includes("-c:a") &&
            ffmpegArgv.includes("aac") &&
            ffmpegArgv.includes("-shortest"),
          "Expected ffmpeg argv to copy video, encode audio to AAC and use -shortest.",
        );

        const realNarrationPipeline = await runNarratedVideoAssembly({
          bundle: bundle as never,
          videoAsset: generatedVisualAsset,
          sourceVideoBinary: engineResult.executedJobs[0]?.result?.internalBinary ?? null,
          narrationProvider: falKokoroFrenchNarrationProvider,
          muxer: ffmpegMediaMuxer,
        });

        assert(
          realNarrationPipeline.narrationRequest?.language === "fr",
          "Expected real narration pipeline request language to be fr.",
        );
        assert(
          realNarrationPipeline.narrationRequest?.text === bundle.video.script,
          "Expected real narration pipeline request text to keep the bundle video script.",
        );
        assert(
          realNarrationPipeline.muxResult?.provider === "ffmpeg" &&
            realNarrationPipeline.muxResult.status === "generated",
          "Expected real narration pipeline to mux through ffmpeg.",
        );
        assert(
          typeof realNarrationPipeline.muxResult.internalBinary?.base64 === "string" &&
            realNarrationPipeline.muxResult.internalBinary.base64.length > 0,
          "Expected real mux result to contain a non-empty MP4 internalBinary.",
        );
        assert(
          realNarrationPipeline.finalAsset?.metadata?.hasMuxedNarration === true &&
            realNarrationPipeline.finalAsset.metadata?.sourceVideoAssetId ===
              generatedVisualAsset.id &&
            realNarrationPipeline.finalAsset.metadata?.sourceAudioAssetId ===
              realNarrationPipeline.narrationResult?.asset?.id &&
            realNarrationPipeline.finalAsset.metadata?.narrationLanguage === "fr",
          "Expected real muxed asset metadata to preserve source video/audio references and French narration language.",
        );

        const uploadedBinaries: Array<{
          filename: string;
          mimeType: string;
          extension: string;
          sizeBytes: number | null | undefined;
        }> = [];
        const uploadedMuxedAsset = await uploadMediaBinaryForAsset({
          binary: {
            id: generatedVisualAsset.id,
            kind: generatedVisualAsset.kind as
              | "image"
              | "video"
              | "thumbnail"
              | "reel"
              | "story"
              | "carousel"
              | "cover",
            provider: "ffmpeg",
            mimeType:
              realNarrationPipeline.muxResult.internalBinary?.mimeType ?? "video/mp4",
            extension:
              realNarrationPipeline.muxResult.internalBinary?.extension ?? "mp4",
            filename:
              realNarrationPipeline.muxResult.internalBinary?.filename ??
              "ffmpeg/test.mp4",
            encoding: "base64",
            base64: realNarrationPipeline.muxResult.internalBinary?.base64 ?? null,
            buffer: null,
            sourceUrl: null,
            sizeBytes: realNarrationPipeline.muxResult.internalBinary?.base64
              ? Buffer.from(
                  realNarrationPipeline.muxResult.internalBinary.base64,
                  "base64",
                ).byteLength
              : null,
            createdAt: new Date().toISOString(),
          },
          asset: realNarrationPipeline.finalAsset!,
          storage: {
            id: "fake-storage",
            label: "Fake Storage",
            async upload(binary) {
              uploadedBinaries.push({
                filename: binary.filename,
                mimeType: binary.mimeType,
                extension: binary.extension,
                sizeBytes: binary.sizeBytes,
              });

              return {
                provider: "fake-storage",
                path: `uploaded/${binary.filename}`,
                previewUrl: `https://storage.test/${binary.filename}`,
                downloadUrl: `https://storage.test/${binary.filename}`,
              };
            },
            async delete() {
              return;
            },
          },
        });
        assert(
          uploadedBinaries.length === 1 &&
            uploadedBinaries[0]?.mimeType === "video/mp4" &&
            uploadedBinaries[0]?.extension === "mp4",
          "Expected final upload to receive the muxed MP4 binary.",
        );
        assert(
          uploadedMuxedAsset.asset.previewUrl === uploadedMuxedAsset.upload.previewUrl &&
            uploadedMuxedAsset.asset.downloadUrl === uploadedMuxedAsset.upload.downloadUrl,
          "Expected uploaded muxed asset to point to the final uploaded media URLs.",
        );

        const narrationPipeline = await runNarratedVideoAssembly({
          bundle: bundle as never,
          videoAsset: generatedVisualAsset,
          sourceVideoBinary: engineResult.executedJobs[0]?.result?.internalBinary ?? null,
          narrationProvider: fakeNarrationProvider,
          muxer: fakeMediaMuxer,
        });

        assert(
          narrationPipeline.narrationRequest?.language === "fr",
          "Expected narration pipeline request language to be fr.",
        );
        assert(
          typeof narrationPipeline.narrationRequest?.text === "string" &&
            narrationPipeline.narrationRequest.text.trim().length > 0,
          "Expected narration pipeline request text to be non-empty.",
        );
        assert(
          narrationPipeline.narrationRequest?.text === bundle.video.script,
          "Expected narration pipeline request text to come from bundle.video.script.",
        );
        assert(
          narrationPipeline.narrationResult?.provider === "fake-tts" &&
            narrationPipeline.narrationResult.asset?.status === "generated",
          "Expected fake TTS to return a typed generated narration asset.",
        );
        assert(
          narrationPipeline.muxResult?.provider === "fake-mux" &&
            typeof narrationPipeline.muxResult.internalBinary?.base64 === "string" &&
            narrationPipeline.muxResult.internalBinary.base64.length > 0 &&
            narrationPipeline.muxResult.asset?.metadata?.sourceVideoAssetId ===
              generatedVisualAsset.id &&
            narrationPipeline.muxResult.asset?.metadata?.sourceAudioAssetId ===
              narrationPipeline.narrationResult.asset?.id,
          "Expected fake mux to receive and reference both the Seedance video and the TTS audio.",
        );
        assert(
          narrationPipeline.finalAsset?.metadata?.hasMuxedNarration === true &&
            narrationPipeline.finalAsset?.metadata?.narrationLanguage === "fr" &&
            narrationPipeline.finalAsset?.metadata?.narrationProvider ===
              "fake-tts",
          "Expected final video asset to reference muxed narration sources correctly.",
        );
        const bundleForTikTokUpload = {
          ...bundle,
          media: {
            requests: rebuiltRequests,
            assets: [
              ...(bundleAssets as never),
              {
                ...narrationPipeline.finalAsset!,
                platform: "tiktok" as const,
                id: "test-tiktok-final-reel",
                previewUrl: "https://storage.test/test-tiktok-final-reel.mp4",
                downloadUrl: "https://storage.test/test-tiktok-final-reel.mp4",
              },
            ],
          },
        } as unknown as Parameters<typeof resolveTikTokUploadMediaAsset>[0];
        const tikTokUploadAsset =
          resolveTikTokUploadMediaAsset(bundleForTikTokUpload);
        assert(
          tikTokUploadAsset?.platform === "tiktok" &&
            tikTokUploadAsset.kind === "reel" &&
            tikTokUploadAsset.ratio === "9:16" &&
            tikTokUploadAsset.metadata?.hasMuxedNarration === true &&
            tikTokUploadAsset.metadata?.narrationLanguage === "fr",
          "Expected TikTok upload asset resolution to target a final 9:16 muxed reel with French narration.",
        );
        const tikTokSilentFallbackBundle = {
          ...bundle,
          media: {
            requests: rebuiltRequests,
            assets: [
              {
                ...generatedVisualAsset,
                previewUrl: "https://storage.test/silent-reel.mp4",
                downloadUrl: "https://storage.test/silent-reel.mp4",
                warnings: [
                  "Narration échouée / vidéo non prête. fal Kokoro narration timed out before completion.",
                ],
              },
            ],
          },
        } as unknown as Parameters<typeof resolveTikTokUploadMediaAsset>[0];
        assert(
          resolveTikTokUploadMediaAsset(tikTokSilentFallbackBundle) === null,
          "Expected TikTok upload asset resolution to reject a silent reel without muxed narration metadata.",
        );

        const selectedResults =
          await runMediaProviderSelectionForRequests(videoRequests);
        assert(
          selectedResults.every(
            (item) =>
              item.provider === "fal" &&
              (item.status === "queued" || item.status === "generating"),
          ),
          "Expected provider selection runner to return async fal video results.",
        );

        const fakeResults = await runMediaProviderForRequests(
          videoRequests,
          fakeMediaProvider,
        );
        assert(
          fakeResults.every((item) => item.provider === "fake" && item.status === "generated"),
          "Expected fake provider direct execution to remain stable.",
        );

        assert(
          fetchMock.getGenerationStatusCalls() >= 2,
          "Expected mocked fal polling to reach completion through repeated status checks.",
        );

        console.log(
          JSON.stringify(
            {
              bundleId: bundle.id,
              requestCount: rebuiltRequests.length,
              videoRequestIds: videoRequests.map((request) => request.id),
              falProviderAvailable: providerStatusById.get("fal") === "available",
              falSubmitCalls: fetchMock.getSubmitCalls(),
              falStatusCalls: fetchMock.getGenerationStatusCalls(),
              falResultCalls: fetchMock.getResultCalls(),
              falMp4DownloadCalls: fetchMock.getMp4DownloadCalls(),
              falSubmitPayload: submitPayload,
              kokoroSubmitCalls: fetchMock.getKokoroSubmitCalls(),
              kokoroStatusCalls: fetchMock.getKokoroStatusCalls(),
              kokoroResultCalls: fetchMock.getKokoroResultCalls(),
              kokoroAudioDownloadCalls: fetchMock.getKokoroAudioDownloadCalls(),
              kokoroPayload,
              ffmpegArgv,
              selectedProviderIds: selections.map(
                (selection) => selection.provider?.id ?? null,
              ),
              executedJobStatuses: executedJobs.map((job) => ({
                id: job.id,
                providerId: job.providerId ?? null,
                status: job.status,
                providerStatus: job.result?.status ?? null,
              })),
              finalPipelineStatuses: pipelineResult.executedJobs.map((job) => ({
                id: job.id,
                providerId: job.providerId ?? null,
                status: job.status,
                providerStatus: job.result?.status ?? null,
              })),
              narrationRequest: narrationPipeline.narrationRequest,
              narrationAsset: narrationPipeline.narrationResult?.asset
                ? {
                    id: narrationPipeline.narrationResult.asset.id,
                    language: narrationPipeline.narrationResult.asset.language,
                    purpose: narrationPipeline.narrationResult.asset.purpose,
                    provider:
                      narrationPipeline.narrationResult.asset.generationProvider,
                    text: narrationPipeline.narrationResult.asset.text,
                  }
                : null,
              muxedAsset: narrationPipeline.finalAsset
                ? {
                    id: narrationPipeline.finalAsset.id,
                    hasMuxedNarration:
                      narrationPipeline.finalAsset.metadata?.hasMuxedNarration ??
                      false,
                    sourceVideoAssetId:
                      narrationPipeline.finalAsset.metadata?.sourceVideoAssetId ??
                      null,
                    sourceAudioAssetId:
                      narrationPipeline.finalAsset.metadata?.sourceAudioAssetId ??
                      null,
                    narrationLanguage:
                      narrationPipeline.finalAsset.metadata?.narrationLanguage ??
                      null,
                  }
                : null,
              uploadedMuxedAsset: {
                previewUrl: uploadedMuxedAsset.asset.previewUrl,
                downloadUrl: uploadedMuxedAsset.asset.downloadUrl,
                uploadPath: uploadedMuxedAsset.upload.path,
              },
              engineAssets: engineResult.assets.map((asset) => ({
                id: asset.id,
                kind: asset.kind,
                status: asset.status,
                generationProvider: asset.generationProvider,
                model:
                  typeof asset.metadata?.model === "string"
                    ? asset.metadata.model
                    : null,
                hasPreview: Boolean(asset.previewUrl),
                hasDownload: Boolean(asset.downloadUrl),
              })),
            },
            null,
            2,
          ),
        );
      } finally {
        fetchMock.restore();
      }
    },
  ).finally(async () => {
    await fakeFfmpeg.cleanup();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
