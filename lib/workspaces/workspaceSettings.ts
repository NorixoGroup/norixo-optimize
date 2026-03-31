export type OwnerProfileDraft = {
  logoDataUrl: string;
  firstName: string;
  lastName: string;
  conciergeName: string;
  email: string;
  phone: string;
  jobTitle: string;
  bio: string;
};

export type PreferencesDraft = {
  language: string;
  currency: string;
  notifications: string;
};

export const emptyOwnerProfile: OwnerProfileDraft = {
  logoDataUrl: "",
  firstName: "",
  lastName: "",
  conciergeName: "",
  email: "",
  phone: "",
  jobTitle: "",
  bio: "",
};

export const emptyPreferencesDraft: PreferencesDraft = {
  language: "",
  currency: "",
  notifications: "",
};

export function loadStoredOwnerProfile(params: {
  accountId?: string | null;
  workspaceId?: string | null;
  displayName?: string | null;
  email?: string | null;
  workspaceName?: string | null;
  roleLabel?: string | null;
}): OwnerProfileDraft {
  const fallback: OwnerProfileDraft = {
    logoDataUrl: "",
    firstName: params.displayName?.split(" ")[0] ?? "",
    lastName: params.displayName?.split(" ").slice(1).join(" ") ?? "",
    conciergeName: params.workspaceName ?? "",
    email: params.email ?? "",
    phone: "",
    jobTitle:
      params.roleLabel && params.roleLabel !== "Indisponible" ? params.roleLabel : "",
    bio: "",
  };

  if (!params.accountId || typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(
      `settings-owner-profile:${params.accountId}:${params.workspaceId ?? "no-workspace"}`
    );

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<OwnerProfileDraft>;

    return {
      logoDataUrl: typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : "",
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : fallback.firstName,
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : fallback.lastName,
      conciergeName:
        typeof parsed.conciergeName === "string"
          ? parsed.conciergeName
          : fallback.conciergeName,
      email: typeof parsed.email === "string" ? parsed.email : fallback.email,
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : fallback.jobTitle,
      bio: typeof parsed.bio === "string" ? parsed.bio : "",
    };
  } catch {
    return fallback;
  }
}

export function loadStoredPreferences(params: {
  accountId?: string | null;
  workspaceId?: string | null;
}): PreferencesDraft {
  if (!params.accountId || typeof window === "undefined") {
    return emptyPreferencesDraft;
  }

  try {
    const raw = window.localStorage.getItem(
      `settings-preferences:${params.accountId}:${params.workspaceId ?? "no-workspace"}`
    );

    if (!raw) {
      return emptyPreferencesDraft;
    }

    const parsed = JSON.parse(raw) as Partial<PreferencesDraft>;

    return {
      language: typeof parsed.language === "string" ? parsed.language : "",
      currency: typeof parsed.currency === "string" ? parsed.currency : "",
      notifications: typeof parsed.notifications === "string" ? parsed.notifications : "",
    };
  } catch {
    return emptyPreferencesDraft;
  }
}
