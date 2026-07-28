import assert from "node:assert/strict";
import fs from "node:fs/promises";

const routeFiles = [
  "app/api/backlinks/opportunities/route.ts",
  "app/api/backlinks/opportunities/[id]/route.ts",
  "app/api/backlinks/campaigns/route.ts",
  "app/api/backlinks/campaigns/[id]/route.ts",
  "app/api/backlinks/outreach/route.ts",
  "app/api/backlinks/outreach/[id]/route.ts",
  "app/api/backlinks/links/route.ts",
  "app/api/backlinks/links/[id]/route.ts",
];

const collectionRoutes = [
  "app/api/backlinks/opportunities/route.ts",
  "app/api/backlinks/campaigns/route.ts",
  "app/api/backlinks/outreach/route.ts",
  "app/api/backlinks/links/route.ts",
];

const itemRoutes = [
  "app/api/backlinks/opportunities/[id]/route.ts",
  "app/api/backlinks/campaigns/[id]/route.ts",
  "app/api/backlinks/outreach/[id]/route.ts",
  "app/api/backlinks/links/[id]/route.ts",
];

async function main(): Promise<void> {
  for (const routeFile of routeFiles) {
    const source = await fs.readFile(routeFile, "utf8");
    assert.match(source, /getRequestUserAndWorkspace/);
    assert.match(source, /isAdminPrivateEmail/);
    assert.match(source, /context\.workspace\.id|requestContext\.workspace\.id/);
    assert.doesNotMatch(
      source,
      /\.from\(|createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|service_role|fetch\(|repositories\//,
    );
  }

  for (const routeFile of collectionRoutes) {
    const source = await fs.readFile(routeFile, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function POST/);
    assert.match(source, /context\.user\.id/);
  }

  for (const routeFile of itemRoutes) {
    const source = await fs.readFile(routeFile, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function PATCH/);
    assert.match(source, /params: Promise<\{ id: string \}>/);
  }

  console.info("Backlink API smoke passed.");
}

void main();
