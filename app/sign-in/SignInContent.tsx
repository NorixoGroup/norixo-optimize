"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { runPostAuthRecovery } from "@/lib/auth/postAuthRecovery";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { isGuestAuditDraftExpired, loadGuestAuditDraft } from "@/lib/guestAuditDraft";
import { useTranslation } from "@/components/i18n/useTranslation";
import { authI18n } from "@/data/authI18n";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { copy: commonCopy } = useTranslation(authI18n);
  const copy = commonCopy.signIn;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const rawNextTarget = searchParams.get("next");
  const hasExplicitNextTarget = Boolean(rawNextTarget);
  const safeNextTarget =
    rawNextTarget &&
    rawNextTarget.startsWith("/") &&
    !rawNextTarget.startsWith("//")
      ? rawNextTarget
      : "/dashboard";

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || !session || hasExplicitNextTarget) return;

      const draft = loadGuestAuditDraft();
      const hasRecoverableDraft = draft != null && !isGuestAuditDraftExpired(draft);

      if (hasRecoverableDraft) {
        await runPostAuthRecovery({
          user: session.user,
          router,
          searchParams,
          setInfo,
        });
        return;
      }

      if (hasCompletedOnboarding(session.user)) {
        router.replace("/dashboard");
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [hasExplicitNextTarget, router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      router.replace(safeNextTarget);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : copy.error
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
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Authentification
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Se connecter
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Connectez-vous pour accéder à votre espace de travail et retrouver vos audits.
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Aucune configuration compliquée. Vous pourrez commencer immédiatement.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-sm">
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
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                  placeholder={copy.passwordPlaceholder}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-slate-500 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Link
              href="/reset-password"
              className="block text-xs font-medium text-orange-600 hover:text-orange-500"
            >
              Mot de passe oublié ?
            </Link>

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
              className="inline-flex w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? copy.submitting : copy.submit}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-500">
            Connexion sécurisée.
          </p>

          <p className="mt-4 text-xs text-slate-600">
            {copy.noAccount}{" "}
            <Link
              href={`/sign-up?next=${encodeURIComponent(safeNextTarget)}`}
              className="font-semibold text-orange-600 hover:text-orange-500"
            >
              Créer un compte
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
