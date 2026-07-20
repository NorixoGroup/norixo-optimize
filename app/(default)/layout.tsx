import "../globals.css";
import { defaultLocale } from "@/data/i18n";
import { RootDocumentShell, rootMetadata } from "@/app/rootLayoutShared";

export const metadata = rootMetadata;

export default function DefaultRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RootDocumentShell locale={defaultLocale} lang="en" dir="ltr">
      {children}
    </RootDocumentShell>
  );
}
