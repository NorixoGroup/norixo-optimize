import type {
  MetaFacebookPageSummary,
  MetaAccountSelectionState,
} from "@/lib/marketing-ai/meta/metaAccountSelection";
import type { MetaOAuthServerConfig } from "@/lib/marketing-ai/meta/metaOAuth";

type MetaGraphErrorResult = {
  ok: false;
  error: "token_exchange_failed" | "pages_fetch_failed" | "invalid_graph_response";
};

type MetaTokenExchangeResult =
  | {
      ok: true;
      accessToken: string;
    }
  | MetaGraphErrorResult;

type MetaPagesDiscoveryResult =
  | {
      ok: true;
      pages: MetaFacebookPageSummary[];
    }
  | MetaGraphErrorResult;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeFacebookPageSummary(
  value: unknown,
): MetaFacebookPageSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const pageId = typeof value.id === "string" ? value.id.trim() : "";
  const pageName = typeof value.name === "string" ? value.name.trim() : "";
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.filter((task): task is string => typeof task === "string")
    : undefined;

  if (!pageId || !pageName) {
    return null;
  }

  return {
    pageId,
    pageName,
    tasks: tasks && tasks.length > 0 ? tasks : undefined,
    hasLinkedInstagramBusiness: false,
  };
}

export async function exchangeMetaCodeForUserAccessToken(
  config: MetaOAuthServerConfig,
  code: string,
): Promise<MetaTokenExchangeResult> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token`,
  );

  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error: "token_exchange_failed",
    };
  }

  const accessToken =
    body && typeof body.access_token === "string" ? body.access_token.trim() : "";

  if (!accessToken) {
    return {
      ok: false,
      error: "invalid_graph_response",
    };
  }

  return {
    ok: true,
    accessToken,
  };
}

export async function fetchMetaFacebookPages(
  config: MetaOAuthServerConfig,
  accessToken: string,
): Promise<MetaPagesDiscoveryResult> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/me/accounts`,
  );

  url.searchParams.set("fields", "id,name,tasks");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error: "pages_fetch_failed",
    };
  }

  if (!body || !Array.isArray(body.data)) {
    return {
      ok: false,
      error: "invalid_graph_response",
    };
  }

  return {
    ok: true,
    pages: body.data
      .map(sanitizeFacebookPageSummary)
      .filter((page): page is MetaFacebookPageSummary => page !== null),
  };
}

export function createMetaReadOnlySelectionState(
  pages: MetaFacebookPageSummary[],
): MetaAccountSelectionState {
  return {
    connected: true,
    readOnly: true,
    status: "connected",
    facebookPages: pages,
    instagramAccounts: [],
    warnings:
      pages.length > 0
        ? []
        : ["Aucune Page Facebook geree n'a ete detectee pour ce compte Meta."],
    updatedAt: new Date().toISOString(),
  };
}
