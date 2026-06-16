"use client";

import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { legalI18n } from "@/data/marketing/legalI18n";

export function LegalContent() {
  const { copy } = useTranslation(legalI18n);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {copy.eyebrow}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {copy.title}
      </h1>
      <div className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
        <p>
          <strong className="text-slate-200">{copy.publisherLabel}</strong>{" "}
          {copy.publisherText}
        </p>
        <p>
          <strong className="text-slate-200">{copy.hostingLabel}</strong>{" "}
          {copy.hostingText}
        </p>
        <p>
          <strong className="text-slate-200">{copy.intellectualPropertyLabel}</strong>{" "}
          {copy.intellectualPropertyText}
        </p>
        <p>
          {copy.claimBeforeLink}{" "}
          <Link href="/contact" className="font-medium text-orange-300 underline-offset-4 hover:underline">
            {copy.contactLink}
          </Link>
          .
        </p>
      </div>
      <p className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {copy.backHome}
        </Link>
      </p>
    </div>
  );
}
