"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { getSharedUser } from "@/lib/supabase/sharedAuth";

export default function DashboardClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const {
        data: { user },
      } = await getSharedUser();

      if (!mounted) return;

      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const canAccessBillingDuringOnboarding = pathname?.startsWith("/dashboard/billing");
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      let hasWorkspaceAccess = Boolean(membership?.workspace_id);

      if (!hasWorkspaceAccess) {
        const { data: ownedWorkspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_user_id", user.id)
          .limit(1)
          .maybeSingle();

        hasWorkspaceAccess = Boolean(ownedWorkspace?.id);
      }

      const hasOnboardingProgress = Boolean(
        user.user_metadata?.onboarding_property_name ||
          user.user_metadata?.onboarding_link
      );

      const canAccessDuringOnboarding =
        canAccessBillingDuringOnboarding || hasWorkspaceAccess || hasOnboardingProgress;

      if (!hasCompletedOnboarding(user) && !canAccessDuringOnboarding) {
        router.replace("/audit/new");
        return;
      }

      setAllowed(true);
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!allowed) {
    return null;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
