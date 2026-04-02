"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentWorkspace } from "@/lib/workspaces/getCurrentWorkspace";
import { runPostAuthRecovery } from "@/lib/auth/postAuthRecovery";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const defaultWorkspaceName = useMemo(() => {
    if (name.trim()) return name.trim();
    if (email.trim()) return `${email.trim().split("@")[0]}'s workspace`;
    return "My workspace";
  }, [name, email]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        await runPostAuthRecovery({
          user: session.user,
          router,
          searchParams,
          setInfo,
        });
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  async function ensureWorkspace(userId: string, workspaceName: string) {
    const existingWorkspace = await getCurrentWorkspace(userId);

    if (existingWorkspace) {
      return existingWorkspace;
    }

    const baseSlug = slugify(workspaceName || "workspace");
    const uniqueSlug = `${baseSlug || "workspace"}-${Date.now()
      .toString()
      .slice(-6)}`;

    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        name: workspaceName,
        slug: uniqueSlug,
        owner_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

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
      const workspaceName = defaultWorkspaceName;

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

      await ensureWorkspace(activeUser.id, workspaceName);

      await runPostAuthRecovery({
        user: activeUser,
        router,
        searchParams,
        setInfo,
      });
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
              Create a real account with Supabase Auth and provision your first workspace automatically.
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
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="At least 6 characters"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="confirmPassword"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="Repeat your password"
              />
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
            This sign-up flow is now wired to Supabase Auth and creates a real user.
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