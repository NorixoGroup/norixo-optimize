"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getSharedSession } from "@/lib/supabase/sharedAuth";

type DiagnosticMode = "fixed" | "serp";

type DiagnosticState =
  | { status: "idle" }
  | { status: "loading"; mode: DiagnosticMode }
  | { status: "unauthenticated" }
  | {
      status: "failed";
      mode: DiagnosticMode;
      message: string;
      httpStatus: number | null;
      body: unknown;
    }
  | {
      status: "loaded";
      mode: DiagnosticMode;
      httpStatus: number;
      body: unknown;
    };

const DIAGNOSTIC_PATH =
  "/api/admin/marketing-studio/debug/booking-cross-platform-quality";
const CONFIRM_VALUE = "fixed-y3-booking-quality";

export default function BookingCrossPlatformQualityDiagnosticClient() {
  const router = useRouter();
  const [state, setState] = useState<DiagnosticState>({ status: "idle" });

  async function runDiagnostic(mode: DiagnosticMode) {
    setState({ status: "loading", mode });

    const {
      data: { session },
    } = await getSharedSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      setState({ status: "unauthenticated" });
      router.replace("/login");
      return;
    }

    try {
      const search = new URLSearchParams({
        confirm: CONFIRM_VALUE,
        mode,
      });

      const response = await fetch(`${DIAGNOSTIC_PATH}?${search.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setState({
          status: "failed",
          mode,
          message: "Diagnostic request failed.",
          httpStatus: response.status,
          body,
        });
        return;
      }

      setState({
        status: "loaded",
        mode,
        httpStatus: response.status,
        body,
      });
    } catch {
      setState({
        status: "failed",
        mode,
        message: "Diagnostic request could not be completed.",
        httpStatus: null,
        body: null,
      });
    }
  }

  const loading = state.status === "loading";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Preview-only diagnostic
      </p>

      <h1 className="mt-2 text-3xl font-semibold text-slate-950">
        Booking cross-platform comparable quality
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Use the fixed-candidate diagnostic for the existing extraction and
        quality checks, or run the SERP metadata diagnostic to inspect only
        scoped Booking search-result card evidence before individual listing
        extraction or comparable evaluation.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void runDiagnostic("fixed")}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run fixed-candidate quality diagnostic
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => void runDiagnostic("serp")}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run Booking SERP metadata diagnostic
        </button>
      </div>

      {state.status === "loading" ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          Running {state.mode === "serp" ? "SERP metadata" : "fixed-candidate"}{" "}
          diagnostic with the current authenticated dashboard session…
        </section>
      ) : null}

      {state.status === "unauthenticated" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No authenticated browser session was found. Redirecting to sign in…
        </section>
      ) : null}

      {state.status === "failed" ? (
        <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-medium">{state.message}</p>
          <p className="mt-1">
            Mode: {state.mode} · HTTP status:{" "}
            {state.httpStatus ?? "network_error"}
          </p>
          <pre className="mt-4 max-h-[34rem] overflow-auto rounded-xl bg-white p-4 text-xs text-slate-900">
            {JSON.stringify(state.body, null, 2)}
          </pre>
        </section>
      ) : null}

      {state.status === "loaded" ? (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-medium">Diagnostic response received.</p>
          <p className="mt-1">
            Mode: {state.mode} · HTTP status: {state.httpStatus}
          </p>
          <pre className="mt-4 max-h-[42rem] overflow-auto rounded-xl bg-white p-4 text-xs text-slate-900">
            {JSON.stringify(state.body, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
