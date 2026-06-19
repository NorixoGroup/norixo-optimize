import { notFound } from "next/navigation";

import { DemoContent } from "@/components/marketing/DemoContent";
import { isLocale } from "@/data/i18n";

type Props = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DemoPage({ params }: Props) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <DemoContent />;
}
