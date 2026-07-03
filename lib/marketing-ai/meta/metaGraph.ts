import type {
  MetaFacebookPageSummary,
  MetaAccountSelectionState,
  MetaInstagramBusinessSummary,
} from "@/lib/marketing-ai/meta/metaAccountSelection";
import type { MetaOAuthServerConfig } from "@/lib/marketing-ai/meta/metaOAuth";

export type MetaDiscoveredFacebookPage = {
  pageId: string;
  pageName: string;
  tasks?: string[];
  hasLinkedInstagramBusiness: boolean;
  pageAccessToken: string | null;
};

type MetaGraphErrorResult = {
  ok: false;
  error:
    | "token_exchange_failed"
    | "pages_fetch_failed"
    | "instagram_fetch_failed"
    | "invalid_graph_response";
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
      pages: MetaDiscoveredFacebookPage[];
    }
  | MetaGraphErrorResult;

type MetaInstagramDiscoveryResult =
  | {
      ok: true;
      pages: MetaDiscoveredFacebookPage[];
      instagramAccounts: MetaInstagramBusinessSummary[];
      warnings: string[];
    }
  | MetaGraphErrorResult;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeFacebookPageSummary(
  value: unknown,
): MetaDiscoveredFacebookPage | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const pageId = typeof value.id === "string" ? value.id.trim() : "";
  const pageName = typeof value.name === "string" ? value.name.trim() : "";
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.filter((task): task is string => typeof task === "string")
    : undefined;
  const pageAccessToken =
    typeof value.access_token === "string" && value.access_token.trim()
      ? value.access_token.trim()
      : null;

  if (!pageId || !pageName) {
    return null;
  }

  return {
    pageId,
    pageName,
    tasks: tasks && tasks.length > 0 ? tasks : undefined,
    hasLinkedInstagramBusiness: false,
    pageAccessToken,
  };
}

function sanitizeInstagramBusinessSummary(
  pageId: string,
  value: unknown,
): MetaInstagramBusinessSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const instagramBusinessAccountId =
    typeof value.id === "string" ? value.id.trim() : "";
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const profilePictureUrl =
    typeof value.profile_picture_url === "string"
      ? value.profile_picture_url.trim()
      : undefined;

  if (!instagramBusinessAccountId || !username) {
    return null;
  }

  return {
    instagramBusinessAccountId,
    username,
    profilePictureUrl: profilePictureUrl || undefined,
    linkedFacebookPageId: pageId,
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

  url.searchParams.set("fields", "id,name,tasks,access_token");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const pages = body && Array.isArray(body.data)
    ? body.data
        .map(sanitizeFacebookPageSummary)
        .filter((page): page is MetaDiscoveredFacebookPage => page !== null)
    : [];

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
    pages,
  };
}

export async function enrichMetaFacebookPagesWithInstagramAccounts(
  config: MetaOAuthServerConfig,
  accessToken: string,
  pages: MetaDiscoveredFacebookPage[],
): Promise<MetaInstagramDiscoveryResult> {
  if (pages.length === 0) {
    return {
      ok: true,
      pages,
      instagramAccounts: [],
      warnings: [],
    };
  }

  const results = await Promise.all(
    pages.map(async (page) => {
      const url = new URL(
        `https://graph.facebook.com/${config.graphApiVersion}/${page.pageId}`,
      );

      url.searchParams.set(
        "fields",
        "instagram_business_account{id,username,profile_picture_url}",
      );
      url.searchParams.set("access_token", accessToken);

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!response.ok || !body || !isPlainObject(body)) {
        return {
          page,
          instagramAccount: null,
          warning: `Instagram Business inaccessible pour la Page ${page.pageName}.`,
          failed: true,
        };
      }

      const instagramAccount = sanitizeInstagramBusinessSummary(
        page.pageId,
        body.instagram_business_account,
      );

      if (!instagramAccount && body.instagram_business_account !== undefined) {
        return {
          page,
          instagramAccount: null,
          warning: `La reponse Instagram Business est invalide pour la Page ${page.pageName}.`,
          failed: true,
        };
      }

      return {
        page: {
          ...page,
          hasLinkedInstagramBusiness: instagramAccount !== null,
        },
        instagramAccount,
        warning: null,
        failed: false,
      };
    }),
  );

  const failedCount = results.filter((result) => result.failed).length;

  if (failedCount === pages.length) {
    return {
      ok: false,
      error: "instagram_fetch_failed",
    };
  }

  return {
    ok: true,
    pages: results.map((result) => result.page),
    instagramAccounts: results
      .map((result) => result.instagramAccount)
      .filter(
        (instagramAccount): instagramAccount is MetaInstagramBusinessSummary =>
          instagramAccount !== null,
      ),
    warnings: results
      .map((result) => result.warning)
      .filter((warning): warning is string => typeof warning === "string"),
  };
}

export function createMetaReadOnlySelectionState(
  pages: MetaFacebookPageSummary[],
  instagramAccounts: MetaInstagramBusinessSummary[] = [],
  warnings: string[] = [],
  selected?: {
    selectedFacebookPageId?: string;
    selectedInstagramBusinessAccountId?: string;
  },
): MetaAccountSelectionState {
  return {
    connected: true,
    readOnly: true,
    status: "connected",
    facebookPages: pages,
    instagramAccounts,
    selectedFacebookPageId: selected?.selectedFacebookPageId,
    selectedInstagramBusinessAccountId:
      selected?.selectedInstagramBusinessAccountId,
    warnings:
      pages.length > 0
        ? warnings
        : [
            ...warnings,
            "Aucune Page Facebook geree n'a ete detectee pour ce compte Meta.",
          ],
    updatedAt: new Date().toISOString(),
  };
}

export function toMetaFacebookPageSummary(
  page: MetaDiscoveredFacebookPage,
): MetaFacebookPageSummary {
  return {
    pageId: page.pageId,
    pageName: page.pageName,
    tasks: page.tasks,
    hasLinkedInstagramBusiness: page.hasLinkedInstagramBusiness,
  };
}

export async function fetchMetaGrantedScopes(
  config: MetaOAuthServerConfig,
  accessToken: string,
): Promise<string[]> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/me/permissions`,
  );

  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok || !body || !Array.isArray(body.data)) {
    return [];
  }

  return body.data
    .filter((value): value is Record<string, unknown> => isPlainObject(value))
    .filter((value) => value.status === "granted")
    .map((value) =>
      typeof value.permission === "string" ? value.permission.trim() : "",
    )
    .filter(Boolean);
}
