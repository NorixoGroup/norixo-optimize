import Link from "next/link";

type PageNavigationLink = {
  href: string;
  label: string;
};

type PageNavigationProps = {
  links: PageNavigationLink[];
};

export function PageNavigation({ links }: PageNavigationProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
