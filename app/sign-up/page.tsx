"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export default function SignUpPage() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">
          This is a mocked sign-up flow. No emails are sent.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-300" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="block w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-emerald-400"
              placeholder="Pro Host Co."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="block w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-emerald-400"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300"
          >
            Continue to dashboard
          </button>
        </form>
        <p className="mt-4 text-xs text-neutral-400">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-emerald-300 hover:text-emerald-200">
            Sign in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
