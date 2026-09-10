import { NextRequest, NextResponse } from "next/server";
import { isAdminPrivateEmail } from "@/lib/auth/isAdminEmail";
import { runPreviewBookingSerpMetadataDiagnostic } from "@/lib/competitors/booking-search";
import { searchCompetitorsAroundTarget } from "@/lib/competitors/searchCompetitors";
import {
  bookingUrlHasStayDates,
  buildBookingUrlWithDates,
  extractListing,
} from "@/lib/extractors";
import type {
  BookingPriceDiagnosticEvent,
  BookingUnitTypeDiagnosticEvent,
  ExtractedListing,
} from "@/lib/extractors/types";
import { createRequestSupabaseClient } from "@/lib/server/routeAuth";

export const runtime = "nodejs";

const CONFIRM_VALUE = "fixed-y3-booking-quality";
const FIXED_MODE = "fixed";
const SERP_MODE = "serp";

const FIXED_BOOKING_CANDIDATE_URLS = [
  "https://www.booking.com/hotel/ma/wazo-appart.fr.html",
  "https://www.booking.com/hotel/ma/swiss-continental-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/citronneraie-de-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/yves-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/relax-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/ibis-moussafir-marrakech-palmeraie.fr.html",
  "https://www.booking.com/hotel/ma/golden-tulip-farah-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/pestana-cr7-marrakech.fr.html",
  "https://www.booking.com/hotel/ma/ibis-moussafir-marrakech-centre-gare.fr.html",
  "https://www.booking.com/hotel/ma/zahia-marrakech.fr.html",
] as const;


const WAZO_BOOKING_URL =
  FIXED_BOOKING_CANDIDATE_URLS[0];

function sanitizeWazoExtraction(
  listing: ExtractedListing | null,
  datedUrl: string,
  elapsedMs: number,
  error: unknown = null
) {
  return {
    success: Boolean(listing),
    urlHasStayDates: bookingUrlHasStayDates(datedUrl),
    elapsedMs,
    propertyType: listing?.propertyType ?? null,
    price:
      typeof listing?.price === "number" && Number.isFinite(listing.price)
        ? listing.price
        : null,
    currency: listing?.currency ?? null,
    error:
      error == null
        ? null
        : error instanceof Error
          ? error.name
          : "ExtractionError",
  };
}

async function runWazoPriceRecoveryDiagnostic() {
  const datedUrl = buildBookingUrlWithDates(
    WAZO_BOOKING_URL,
    AIRBNB_STUDIO_TARGET.url ?? null
  );

  const run = async (skipBookingPriceRecovery: boolean) => {
    const startedAt = Date.now();
    const priceDiagnostics: BookingPriceDiagnosticEvent[] = [];
    const unitTypeDiagnostics: BookingUnitTypeDiagnosticEvent[] = [];

    try {
      const listing = await extractListing(datedUrl, {
        extractionMode: "pricing_only",
        skipBookingPriceRecovery,
        onBookingPriceDiagnostic: (event) => {
          priceDiagnostics.push(event);
        },
        onBookingUnitTypeDiagnostic: (event) => {
          unitTypeDiagnostics.push(event);
        },
      });

      return {
        ...sanitizeWazoExtraction(
          listing,
          datedUrl,
          Date.now() - startedAt
        ),
        priceDiagnostics,
        unitTypeDiagnostics,
      };
    } catch (error) {
      return {
        ...sanitizeWazoExtraction(
          null,
          datedUrl,
          Date.now() - startedAt,
          error
        ),
        priceDiagnostics,
        unitTypeDiagnostics,
      };
    }
  };

  const recoveryOff = await run(true);
  const recoveryOn = await run(false);

  return {
    candidate: "wazo-appart",
    sameDatedInput: true,
    recoveryOff,
    recoveryOn,
    delta: {
      priceRecovered:
        recoveryOff.price == null && recoveryOn.price != null,
      propertyTypeChanged:
        recoveryOff.propertyType !== recoveryOn.propertyType,
      priceChanged:
        recoveryOff.price !== recoveryOn.price ||
        recoveryOff.currency !== recoveryOn.currency,
    },
  };
}

const AIRBNB_STUDIO_TARGET: ExtractedListing = {
  url: "https://www.airbnb.com/rooms/1349159372150853675",
  platform: "airbnb",
  title: "Marrakech studio target",
  description: "Marrakech, Morocco studio target for Booking comparable quality diagnostics.",
  amenities: [],
  photos: [],
  locationLabel: "Marrakech, Morocco",
  structure: {
    capacity: null,
    bedrooms: null,
    bedCount: null,
    bathrooms: null,
    propertyType: "studio",
    locationLabel: "Marrakech, Morocco",
  },
  propertyType: "studio",
  latitude: 31.6379,
  longitude: -8.0181,
};

function jsonNoStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function classifyPreviewDiagnosticError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";

  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();

  if (
    message.includes("executable doesn't exist") ||
    message.includes("executable does not exist") ||
    message.includes("browser executable") ||
    message.includes("chromium") ||
    message.includes("playwright")
  ) {
    return "browser_launch_failed";
  }

  if (
    name.includes("timeout") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "timeout";
  }

  if (
    message.includes("navigation") ||
    message.includes("page.goto") ||
    message.includes("net::")
  ) {
    return "navigation_failed";
  }

  return "diagnostic_runtime_error";
}

function isBrightDataConfigured(): boolean {
  const hasBrowserCdpConfig = Boolean(
    process.env.BRIGHTDATA_BROWSER_HOST?.trim() &&
      process.env.BRIGHTDATA_BROWSER_USERNAME?.trim() &&
      process.env.BRIGHTDATA_BROWSER_PASSWORD?.trim()
  );
  const hasLegacyCdpConfig = Boolean(
    process.env.BRIGHTDATA_HOST?.trim() &&
      process.env.BRIGHTDATA_USERNAME?.trim() &&
      process.env.BRIGHTDATA_PASSWORD?.trim()
  );

  return hasBrowserCdpConfig || hasLegacyCdpConfig;
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return jsonNoStore(
      { ok: false, error: "Booking cross-platform quality diagnostic is unavailable in production." },
      404
    );
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("confirm") !== CONFIRM_VALUE) {
      return jsonNoStore(
        { ok: false, error: "Explicit diagnostic confirmation is required." },
        400
      );
    }

    const requestClient = createRequestSupabaseClient(request);
    const {
      data: { user },
      error: userError,
    } = await requestClient.auth.getUser();

    if (userError || !user) {
      return jsonNoStore({ ok: false, error: "Unauthorized." }, 401);
    }

    if (!isAdminPrivateEmail(user.email)) {
      return jsonNoStore({ ok: false, error: "Forbidden." }, 403);
    }

    const mode = url.searchParams.get("mode") ?? FIXED_MODE;

    if (mode === SERP_MODE) {
      const serpMetadata = await runPreviewBookingSerpMetadataDiagnostic(
        AIRBNB_STUDIO_TARGET,
        {
          maxResults: 10,
          normalizedTargetCountry: "morocco",
        }
      );

      return jsonNoStore(
        {
          ok: true,
          mode: "preview_booking_serp_metadata",
          brightDataConfigured: isBrightDataConfigured(),
          target: {
            platform: AIRBNB_STUDIO_TARGET.platform,
            url: AIRBNB_STUDIO_TARGET.url,
            city: "marrakech",
            country: "morocco",
            propertyType: "studio",
            normalizedType: "studio_like",
            latitude: AIRBNB_STUDIO_TARGET.latitude,
            longitude: AIRBNB_STUDIO_TARGET.longitude,
          },
          serpMetadata,
        },
        200
      );
    }

    if (mode !== FIXED_MODE) {
      return jsonNoStore(
        { ok: false, error: "Unknown diagnostic mode." },
        400
      );
    }

    const wazoPriceRecovery = await runWazoPriceRecoveryDiagnostic();

    const result = await searchCompetitorsAroundTarget({
      target: AIRBNB_STUDIO_TARGET,
      maxResults: 5,
      comparables: {
        sourcePriority: ["booking"],
        city: "marrakech",
        country: "morocco",
        propertyType: "studio",
        max: 5,
      },
      diagnostic: {
        mode: "preview_fixed_booking_candidates",
        fixedBookingCandidateUrls: [...FIXED_BOOKING_CANDIDATE_URLS],
      },
    });

    return jsonNoStore(
      {
        ok: true,
        brightDataConfigured: isBrightDataConfigured(),
        target: {
          platform: AIRBNB_STUDIO_TARGET.platform,
          url: AIRBNB_STUDIO_TARGET.url,
          city: "marrakech",
          country: "morocco",
          propertyType: "studio",
          normalizedType: "studio_like",
          latitude: AIRBNB_STUDIO_TARGET.latitude,
          longitude: AIRBNB_STUDIO_TARGET.longitude,
        },
        competitorsReturned: result.competitors.length,
        diagnostic: result.diagnostic?.bookingFixedCandidateQuality ?? null,
        wazoPriceRecovery,
      },
      200
    );
  } catch (error) {
    console.error("[marketing-studio][debug][booking-cross-platform-quality] failed", {
      name: error instanceof Error ? error.name : typeof error,
    });

    return jsonNoStore(
      {
        ok: false,
        error: "Booking cross-platform quality diagnostic failed.",
        failureClass: classifyPreviewDiagnosticError(error),
      },
      500
    );
  }
}
