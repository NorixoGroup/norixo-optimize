const STORAGE_KEY = "currentWorkspaceId";

export function setStoredWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, workspaceId);
  } catch (error) {
    console.warn("setStoredWorkspaceId error", error);
  }
}
