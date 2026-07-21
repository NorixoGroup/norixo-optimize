import "../globals.css";
import { RootDocumentShell, rootMetadata } from "@/app/rootLayoutShared";

export const metadata = rootMetadata;

export default function PilotFrRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RootDocumentShell locale="fr" lang="fr" dir="ltr">
      {children}
    </RootDocumentShell>
  );
}
