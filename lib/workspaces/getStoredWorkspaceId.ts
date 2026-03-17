const STORAGE_KEY = "currentWorkspaceId";

export function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value || null;
  } catch (error) {
    console.warn("getStoredWorkspaceId error", error);
    return null;
  }
}

export function clearStoredWorkspaceId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("clearStoredWorkspaceId error", error);
  }
}
