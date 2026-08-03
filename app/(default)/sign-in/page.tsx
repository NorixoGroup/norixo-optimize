import type { Metadata } from "next";
import { Suspense } from "react";
import SignInContent from "./SignInContent";

export const metadata: Metadata = {
  title: "Sign in | Norixo",
  description:
    "Sign in to your Norixo account to access your dashboard, listing audits, optimization insights, and the tools available for your short-term rental work.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
