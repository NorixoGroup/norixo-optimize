"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSharedSession } from "@/lib/supabase/sharedAuth";

const DIAGNOSTIC_ENDPOINT =
  "/api/admin/marketing-studio/debug/booking-cross-platform-quality?confirm=fixed-y3-booking-quality";

type DiagnosticState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "loaded"; httpStatus: number; body: unknown }
  | { status: "failed"; httpStatus: number | null; body: unknown; message: string };

export default function BookingCrossPlatformQualityDiagnosticClient() {
  const router = useRouter();
  const [state, setState] = useState<DiagnosticState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    async function loadDiagnostic() {
      const {
        data: { session },
      } = await getSharedSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        if (mounted) {
          setState({ status: "unauthenticated" });
          router.replace(
            `/sign-in?next=${encodeURIComponent(
              "/dashboard/admin/diagnostics/booking-cross-platform-quality"
            )}`
          );
        }
        return;
      }

      try {
        const response = await fetch(DIAGNOSTIC_ENDPOINT, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);

        if (!mounted) return;

        if (response.ok) {
          setState({ status: "loaded", httpStatus: response.status, body });
          return;
        }

        setState({
          status: "failed",
          httpStatus: response.status,
          body,
          message: "Diagnostic request failed.",
        });
      } catch {
        if (!mounted) return;
        setState({
          status: "failed",
          httpStatus: null,
          body: null,
          message: "Diagnostic request could not be completed.",
        });
      }
    }

    void loadDiagnostic();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Preview-only diagnostic
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Booking cross-platform comparable quality
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          This temporary page bridges the authenticated dashboard browser session to the
          protected diagnostic API route. The access token is sent only as an
          Authorization header and is never rendered or stored by this page.
        </p>
      </div>

      {state.status === "loading" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          Running diagnostic with the current authenticated dashboard session…
        </section>
      ) : null}

      {state.status === "unauthenticated" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No authenticated browser session was found. Redirecting to sign in…
        </section>
      ) : null}

      {state.status === "failed" ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-medium">{state.message}</p>
          <p className="mt-1">HTTP status: {state.httpStatus ?? "network_error"}</p>
          <pre className="mt-4 max-h-[34rem] overflow-auto rounded-xl bg-white p-4 text-xs text-slate-900">
            {JSON.stringify(state.body, null, 2)}
          </pre>
        </section>
      ) : null}

      {state.status === "loaded" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-medium">Diagnostic response received.</p>
          <p className="mt-1">HTTP status: {state.httpStatus}</p>
          <pre className="mt-4 max-h-[42rem] overflow-auto rounded-xl bg-white p-4 text-xs text-slate-900">
            {JSON.stringify(state.body, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
