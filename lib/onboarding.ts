type UserLike = {
  user_metadata?: Record<string, unknown> | null;
} | null;

export function hasCompletedOnboarding(user: UserLike): boolean {
  return user?.user_metadata?.onboarding_completed === true;
}

export function canAccessOnboardingInDev(): boolean {
  return process.env.NODE_ENV === "development";
}
