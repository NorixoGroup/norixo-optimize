import type { Metadata } from "next";
import { Suspense } from "react";
import SignUpContent from "./SignUpContent";

export const metadata: Metadata = {
  title: "Sign up | Norixo",
  description: "Create your Norixo account.",
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
