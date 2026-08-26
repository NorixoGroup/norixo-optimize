"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "@/components/i18n/useTranslation";
import { legalI18n } from "@/data/marketing/legalI18n";

export function LegalContent() {
  const { copy } = useTranslation(legalI18n);
  const legalCopy = copy as (typeof legalI18n)["en"];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {legalCopy.eyebrow}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {legalCopy.title}
      </h1>
      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-300">
        <p>{legalCopy.intro}</p>

        <section className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight text-white">
            {legalCopy.publisherSectionTitle}
          </h2>
          <p>{legalCopy.publisherLead}</p>
          <dl className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <DefinitionRow label={legalCopy.companyNameLabel} value={legalCopy.companyNameValue} />
            <DefinitionRow label={legalCopy.legalFormLabel} value={legalCopy.legalFormValue} />
            <DefinitionRow label={legalCopy.registeredOfficeLabel} value={legalCopy.registeredOfficeValue} multiline />
            <DefinitionRow label={legalCopy.shareCapitalLabel} value={legalCopy.shareCapitalValue} />
            <DefinitionRow label={legalCopy.commercialRegisterLabel} value={legalCopy.commercialRegisterValue} />
            <DefinitionRow label={legalCopy.iceLabel} value={legalCopy.iceValue} />
            <DefinitionRow label={legalCopy.taxIdLabel} value={legalCopy.taxIdValue} />
            <DefinitionRow label={legalCopy.professionalTaxLabel} value={legalCopy.professionalTaxValue} />
            <DefinitionRow label={legalCopy.legalRepresentativeLabel} value={legalCopy.legalRepresentativeValue} />
            <DefinitionRow
              label={legalCopy.contactLabel}
              value={<a className="font-medium text-orange-300 underline-offset-4 hover:underline" href="mailto:support@norixo.io">{legalCopy.contactValue}</a>}
            />
            <DefinitionRow
              label={legalCopy.websiteLabel}
              value={<a className="font-medium text-orange-300 underline-offset-4 hover:underline" href="https://norixo.io">{legalCopy.websiteValue}</a>}
            />
          </dl>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight text-white">
            {legalCopy.serviceSectionTitle}
          </h2>
          <p>{legalCopy.serviceParagraphOne}</p>
          <p>{legalCopy.serviceParagraphTwo}</p>
          <p>{legalCopy.serviceParagraphThree}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight text-white">
            {legalCopy.hostingSectionTitle}
          </h2>
          <p>{legalCopy.hostingParagraphOne}</p>
          <p>{legalCopy.hostingParagraphTwo}</p>
        </section>
      </div>
      <p className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {legalCopy.backHome}
        </Link>
      </p>
    </div>
  );
}

function DefinitionRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
      <dd className={multiline ? "whitespace-pre-line text-slate-200" : "text-slate-200"}>
        {typeof value === "string" ? value : value}
      </dd>
    </div>
  );
}
