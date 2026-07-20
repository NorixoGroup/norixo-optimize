"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

const SUCCESS_MESSAGE = "Votre mot de passe a été mis à jour.";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function hydrateRecoverySession() {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }

          const cleanUrl = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        const {
          data: { session },
          error: getSessionError,
        } = await supabase.auth.getSession();

        if (getSessionError) {
          throw getSessionError;
        }

        if (!mounted) return;

        setHasRecoverySession(Boolean(session));
        if (!session) {
          setError(
            "Le lien de réinitialisation est invalide ou a expiré. Veuillez recommencer la procédure."
          );
        }
      } catch (err) {
        if (!mounted) return;
        setHasRecoverySession(false);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de vérifier votre lien de réinitialisation."
        );
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    void hydrateRecoverySession();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setInfo(SUCCESS_MESSAGE);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour votre mot de passe. Veuillez réessayer."
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
              Définir un nouveau mot de passe
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Choisissez un nouveau mot de passe pour sécuriser votre compte.
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Utilisez au minimum 8 caractères et confirmez votre nouveau mot de passe.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-sm">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="password"
              >
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="Minimum 8 caractères"
                disabled={isInitializing || !hasRecoverySession || info === SUCCESS_MESSAGE}
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                htmlFor="confirm-password"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400"
                placeholder="Confirmez votre mot de passe"
                disabled={isInitializing || !hasRecoverySession || info === SUCCESS_MESSAGE}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {info && (
              <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                <p>{info}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <Link
                    href="/sign-in"
                    className="font-semibold text-orange-600 hover:text-orange-500"
                  >
                    Aller à la connexion
                  </Link>
                  <Link
                    href="/dashboard"
                    className="font-semibold text-orange-600 hover:text-orange-500"
                  >
                    Aller au dashboard
                  </Link>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting || isInitializing || !hasRecoverySession || info === SUCCESS_MESSAGE
              }
              className="inline-flex w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isInitializing
                ? "Vérification..."
                : isSubmitting
                  ? "Mise à jour..."
                  : "Mettre à jour mon mot de passe"}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-500">Connexion sécurisée.</p>

          <p className="mt-4 text-xs text-slate-600">
            <Link
              href="/sign-in"
              className="font-semibold text-orange-600 hover:text-orange-500"
            >
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
