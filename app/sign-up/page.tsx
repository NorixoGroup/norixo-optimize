import { Suspense } from "react";
import SignUpContent from "./SignUpContent";

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SignUpContent />
    </Suspense>
  );
}
