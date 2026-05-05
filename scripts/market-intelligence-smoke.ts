/**
 * Smoke test Market Intelligence v1 (lecture DB uniquement).
 *
 * Prérequis : variables d’env Supabase (ex. depuis `.env.local`).
 *
 * @example
 * DEBUG_MARKET_INTELLIGENCE=true \
 * MI_TEST_PLATFORM=booking MI_TEST_CITY="Paris" MI_TEST_COUNTRY="France" MI_TEST_PROPERTY_TYPE=villa \
 * npx esbuild scripts/market-intelligence-smoke.ts --bundle --platform=node --packages=external --alias:@/=./ --outfile=/tmp/market-intelligence-smoke.cjs \
 * && node /tmp/market-intelligence-smoke.cjs
 */
import { buildMarketIntelligenceV1 } from "../lib/marketIntelligence/buildMarketIntelligenceV1";

async function main() {
  const r = await buildMarketIntelligenceV1({
    city: process.env.MI_TEST_CITY?.trim() || null,
    country: process.env.MI_TEST_COUNTRY?.trim() || null,
    propertyType: (process.env.MI_TEST_PROPERTY_TYPE ?? "").toLowerCase().trim() || null,
    platform: process.env.MI_TEST_PLATFORM?.trim()?.toLowerCase() || null,
  });
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
