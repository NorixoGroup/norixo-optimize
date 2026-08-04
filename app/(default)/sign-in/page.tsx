import type { Metadata } from "next";
import SignInContent from "./SignInContent";

type SignInPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

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

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const { next } = await searchParams;
  const nextPath = Array.isArray(next) ? next[0] : next;

  return (
    <SignInContent nextPath={nextPath} />
  );
}
