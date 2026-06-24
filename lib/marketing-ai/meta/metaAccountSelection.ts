export type MetaReadOnlyConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "missing_permissions"
  | "error";

export type MetaFacebookPageSummary = {
  pageId: string;
  pageName: string;
  tasks?: string[];
  hasLinkedInstagramBusiness: boolean;
};

export type MetaInstagramBusinessSummary = {
  instagramBusinessAccountId: string;
  username: string;
  profilePictureUrl?: string;
  linkedFacebookPageId: string;
};

export type MetaAccountSelectionState = {
  connected: boolean;
  readOnly: true;
  status: MetaReadOnlyConnectionStatus;
  facebookPages: MetaFacebookPageSummary[];
  instagramAccounts: MetaInstagramBusinessSummary[];
  selectedFacebookPageId?: string;
  selectedInstagramBusinessAccountId?: string;
  warnings: string[];
  updatedAt: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeDateString(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function isMetaReadOnlyConnectionStatus(
  value: unknown,
): value is MetaReadOnlyConnectionStatus {
  return (
    value === "not_connected" ||
    value === "connecting" ||
    value === "connected" ||
    value === "missing_permissions" ||
    value === "error"
  );
}

function isMetaFacebookPageSummary(
  value: unknown,
): value is MetaFacebookPageSummary {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.pageId === "string" &&
    typeof value.pageName === "string" &&
    (value.tasks === undefined || isStringArray(value.tasks)) &&
    typeof value.hasLinkedInstagramBusiness === "boolean"
  );
}

function isMetaInstagramBusinessSummary(
  value: unknown,
): value is MetaInstagramBusinessSummary {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.instagramBusinessAccountId === "string" &&
    typeof value.username === "string" &&
    (value.profilePictureUrl === undefined ||
      typeof value.profilePictureUrl === "string") &&
    typeof value.linkedFacebookPageId === "string"
  );
}

export function createEmptyMetaAccountSelectionState(): MetaAccountSelectionState {
  return {
    connected: false,
    readOnly: true,
    status: "not_connected",
    facebookPages: [],
    instagramAccounts: [],
    warnings: [],
    updatedAt: new Date().toISOString(),
  };
}

export function isMetaAccountSelectionState(
  value: unknown,
): value is MetaAccountSelectionState {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.connected === "boolean" &&
    value.readOnly === true &&
    isMetaReadOnlyConnectionStatus(value.status) &&
    Array.isArray(value.facebookPages) &&
    value.facebookPages.every(isMetaFacebookPageSummary) &&
    Array.isArray(value.instagramAccounts) &&
    value.instagramAccounts.every(isMetaInstagramBusinessSummary) &&
    (value.selectedFacebookPageId === undefined ||
      typeof value.selectedFacebookPageId === "string") &&
    (value.selectedInstagramBusinessAccountId === undefined ||
      typeof value.selectedInstagramBusinessAccountId === "string") &&
    isStringArray(value.warnings) &&
    typeof value.updatedAt === "string" &&
    normalizeDateString(value.updatedAt) !== null
  );
}
