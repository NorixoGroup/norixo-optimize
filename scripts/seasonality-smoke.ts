/**
 * Smoke Seasonality Engine v1 (lecture DB).
 *
 * Variables d’env Supabase requises : `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
 * (ex. via `.env.local` — à exporter manuellement avant `node` si besoin).
 *
 * @example
 * DEBUG_SEASONALITY_ENGINE=true \
 * SEASON_TEST_PLATFORM=booking \
 * SEASON_TEST_CITY="marrakech" \
 * SEASON_TEST_COUNTRY="morocco" \
 * SEASON_TEST_PROPERTY_TYPE="villa" \
 * SEASON_TEST_CHECK_IN="2026-05-05" \
 * SEASON_TEST_CHECK_OUT="2026-05-09" \
 * npx esbuild scripts/seasonality-smoke.ts \
 *   --bundle --platform=node --packages=external --alias:@/=./ \
 *   --outfile=.tmp-seasonality-smoke.cjs \
 * && node .tmp-seasonality-smoke.cjs
 *
 * Préfixe sur **une ligne** avant `node` : `SEASON_TEST_PLATFORM=booking … node …`
 * Sinon : **`export SEASON_TEST_…`** sur chaque ligne (sans export, les sous-processus comme
 * `node` ne reçoivent pas les valeurs assignées ligne à ligne dans le shell).
 */
import { buildSeasonalityEngineV1 } from "../lib/marketIntelligence/buildSeasonalityEngineV1";

/** Lecture par indice dynamique : évite qu’esbuild ne fige les `process.env.SEASON_*` au bundle. */
function envRaw(name: "SEASON_TEST_PLATFORM" | "SEASON_TEST_CITY" | "SEASON_TEST_COUNTRY" | "SEASON_TEST_PROPERTY_TYPE" | "SEASON_TEST_CHECK_IN" | "SEASON_TEST_CHECK_OUT"): string {
  const v = process.env[name];
  return typeof v === "string" ? v : "";
}

function toLowerTrimOrNull(raw: string): string | null {
  const x = raw.trim().toLowerCase();
  return x.length > 0 ? x : null;
}

function trimOrNull(raw: string): string | null {
  const x = raw.trim();
  return x.length > 0 ? x : null;
}

async function main() {
  const r = await buildSeasonalityEngineV1({
    platform: toLowerTrimOrNull(envRaw("SEASON_TEST_PLATFORM")),
    city: toLowerTrimOrNull(envRaw("SEASON_TEST_CITY")),
    country: toLowerTrimOrNull(envRaw("SEASON_TEST_COUNTRY")),
    propertyType: toLowerTrimOrNull(envRaw("SEASON_TEST_PROPERTY_TYPE")),
    checkIn: trimOrNull(envRaw("SEASON_TEST_CHECK_IN")),
    checkOut: trimOrNull(envRaw("SEASON_TEST_CHECK_OUT")),
  });
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
