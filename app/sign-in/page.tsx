import { Suspense } from "react";
import SignInContent from "./SignInContent";

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SignInContent />
    </Suspense>
  );
}
