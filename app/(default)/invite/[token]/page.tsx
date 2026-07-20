"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acceptWorkspaceInvitation } from "@/lib/invitations/acceptWorkspaceInvitation";
import { setStoredWorkspaceId } from "@/lib/workspaces/setStoredWorkspaceId";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token;

  const [status, setStatus] = useState<string>("Validating invitation…");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    async function run() {
      if (!token || typeof token !== "string") {
        setStatus("Invalid invitation link.");
        setDone(true);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data?.user) {
          setStatus("You need to sign in before accepting this invitation.");
          setDone(true);
          return;
        }

        const user = data.user;

        const result = await acceptWorkspaceInvitation({
          token,
          userId: user.id,
          userEmail: user.email ?? null,
          client: supabase,
        });

        if (!active) return;

        if (!result.success || !result.workspaceId) {
          setStatus(result.reason || "Unable to accept this invitation.");
          setDone(true);
          return;
        }

        setStoredWorkspaceId(result.workspaceId);
        setStatus("Invitation accepted. Redirecting to your dashboard…");
        setDone(true);

        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      } catch (e) {
        if (!active) return;
        console.warn("AcceptInvitePage error", e);
        setStatus("Something went wrong while accepting your invitation.");
        setDone(true);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 text-sm text-neutral-100 shadow-xl">
        <h1 className="text-lg font-semibold text-white">Join workspace</h1>
        <p className="mt-2 text-[13px] text-neutral-300">{status}</p>
        {!done && (
          <p className="mt-4 text-[11px] text-neutral-500">
            This page will update automatically once the invitation is processed.
          </p>
        )}
      </div>
    </main>
  );
}
