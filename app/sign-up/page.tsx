"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  clearGuestAuditDraft,
  isGuestAuditDraftExpired,
  loadGuestAuditDraft,
  restoreGuestAuditDraft,
} from "@/lib/guestAuditDraft";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";
import { getOrCreateWorkspaceForUser } from "@/lib/workspaces/ensureWorkspaceForUser";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a3 3 0 104.24 4.24" />
        <path d="M9.88 5.09A10.94 10.94 0 0112 4.91c5.05 0 9.27 3.11 10.5 7.5a10.96 10.96 0 01-3.07 4.67" />
        <path d="M6.61 6.61A10.95 10.95 0 001.5 12.41a10.94 10.94 0 005.18 6.02" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M1.5 12s3.82-7.5 10.5-7.5 10.5 7.5 10.5 7.5-3.82 7.5-10.5 7.5S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handlePostAuthRecovery = useCallback(async function handlePostAuthRecovery(
    user: Parameters<typeof hasCompletedOnboarding>[0]
  ) {
    const storedDraft = loadGuestAuditDraft();

    if (storedDraft && isGuestAuditDraftExpired(storedDraft)) {
      clearGuestAuditDraft();
    }

    const target = hasCompletedOnboarding(user) ? "/dashboard" : "/onboarding";
    const nextTarget = searchParams.get("next") || "/audit/new?restored=1";
    const recoverableDraft = loadGuestAuditDraft();

    if (!recoverableDraft) {
      router.replace(target);
      return;
    }

    setInfo("Nous avons retrouve votre audit temporaire. Restauration en cours...");

    const restoration = await restoreGuestAuditDraft();

    if (restoration.restored) {
      if (restoration.cached) {
        router.replace(nextTarget);
        return;
      }

      router.replace(
        restoration.auditId ? `/dashboard/audits/${restoration.auditId}` : "/dashboard/audits"
      );
      return;
    }

    setInfo("Votre brouillon d’audit n’a pas pu etre restaure automatiquement.");
    router.replace(target);
  }, [router, searchParams]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        await handlePostAuthRecovery(session.user);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [handlePostAuthRecovery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: name.trim() || null,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      let activeUser = signUpData.user;
      let activeSession = signUpData.session;

      if (!activeSession) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

        if (!signInError) {
          activeUser = signInData.user;
          activeSession = signInData.session;
        }
      }

      if (!activeUser) {
        setInfo(
          "Account created. If email confirmation is enabled, confirm your email before signing in."
        );
        router.push("/sign-in");
        return;
      }

      await getOrCreateWorkspaceForUser({
        userId: activeUser.id,
        email: activeUser.email ?? trimmedEmail,
      });

      await handlePostAuthRecovery(activeUser);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="nk-dashboard-bg" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/70 bg-white/95 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Authentication
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Create your account
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Create your account with Supabase Auth and provision your first workspace automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="name"
              >
                Workspace / company name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="Pro Host Co."
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  <PasswordVisibilityIcon visible={showPassword} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="confirmPassword"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  <PasswordVisibilityIcon visible={showConfirmPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            Use this account to access your dashboard and workspace.
          </p>

          <p className="mt-4 text-xs text-slate-600">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-orange-600 hover:text-orange-500"
            >
              Sign in
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
