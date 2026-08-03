import type { Metadata } from "next";
import { Suspense } from "react";
import SignUpContent from "./SignUpContent";

export const metadata: Metadata = {
  title: "Sign up | Norixo",
  description:
    "Create a Norixo account to access your dashboard, run listing audits, review optimization insights, and use tools for your short-term rental work.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}
