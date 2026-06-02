"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { supabase } from "@/lib/supabase";

const SUCCESS_MESSAGE =
  "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setInfo(SUCCESS_MESSAGE);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer le lien de réinitialisation. Veuillez réessayer."
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
              Mot de passe oublié
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Entrez votre email pour recevoir un lien de réinitialisation de votre mot de passe.
            </p>
            <p className="text-xs leading-5 text-slate-500">
              Si votre compte existe, nous vous enverrons les instructions de réinitialisation.
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
              className="inline-flex w-full items-center justify-center rounded-lg border !border-blue-500/80 !bg-[linear-gradient(135deg,#3b82f6_0%,#06b6d4_50%,#7c3aed_100%)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white !shadow-[0_14px_30px_rgba(59,130,246,0.30)] transition-all duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Envoi..." : "Envoyer le lien de réinitialisation"}
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
