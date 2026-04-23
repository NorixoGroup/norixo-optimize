/**
 * Affichage visuel unifié du workspace (brouillon profil local + nom DB).
 * Ne modifie pas la persistance ni les ids — uniquement dérivation d’affichage.
 */

export const NORIXO_OWNER_PROFILE_UPDATED_EVENT = "norixo:owner-profile-updated";

export function buildOwnerProfileStorageKey(accountId: string, workspaceId: string) {
  return `settings-owner-profile:${accountId}:${workspaceId}`;
}

export function getVisibleWorkspaceName(options: {
  conciergeName?: string | null;
  workspaceName?: string | null;
}): string {
  const fromProfile = (options.conciergeName ?? "").trim();
  if (fromProfile) return fromProfile;
  const fromDb = (options.workspaceName ?? "").trim();
  if (fromDb) return fromDb;
  return "";
}

/** Initiales pour le badge : 1 mot → 1 lettre ; 2+ mots → 2 premières lettres (2 premiers mots). */
export function getWorkspaceAvatarLetters(visibleName: string): string {
  const trimmed = (visibleName ?? "").trim();
  if (!trimmed) return "WS";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  const word = parts[0] ?? trimmed;
  const letter = word.charAt(0);
  return letter ? letter.toUpperCase() : "WS";
}
