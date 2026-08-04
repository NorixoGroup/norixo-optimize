"use client";

import Link from "next/link";
import { useTranslation } from "@/components/i18n/useTranslation";
import { footerCopy } from "@/data/footerI18n";

export default function Footer() {
  const { copy } = useTranslation(footerCopy);

  return (
    <footer className="border-t border-white/15 bg-slate-100/60 text-blue-800 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-xs">
          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link
              href="/privacy"
              className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4"
            >
              {copy.privacy}
            </Link>

            <Link
              href="/legal"
              className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4"
            >
              {copy.legal}
            </Link>

            <Link
              href="/terms"
              className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4"
            >
              {copy.terms}
            </Link>

            <Link
              href="/contact"
              className="font-semibold text-blue-700 transition-colors hover:text-blue-800 hover:underline underline-offset-4"
            >
              {copy.contact}
            </Link>
          </nav>

          <p className="text-[11px] text-blue-700/75">
            {copy.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
