import BookingCrossPlatformQualityDiagnosticClient from "./BookingCrossPlatformQualityDiagnosticClient";

export const dynamic = "force-dynamic";

export default function BookingCrossPlatformQualityDiagnosticPage() {
  if (process.env.VERCEL_ENV === "production") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Diagnostic unavailable
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Booking cross-platform comparable quality
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This temporary diagnostic page is disabled in production.
        </p>
      </main>
    );
  }

  return <BookingCrossPlatformQualityDiagnosticClient />;
}
