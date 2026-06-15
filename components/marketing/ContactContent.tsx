"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { contactI18n } from "@/data/marketing/contactI18n";

export function ContactContent() {
  const { locale } = useI18n();
  const copy = contactI18n[locale];

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
          {copy.paragraphOneBeforeEmail} (
          {copy.paragraphOneAfterEmail}{" "}
          <span className="text-slate-200">support@votredomaine.com</span>
          ).
        </p>
        <p>{copy.paragraphTwo}</p>
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
