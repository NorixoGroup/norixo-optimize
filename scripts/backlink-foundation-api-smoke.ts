import assert from "node:assert/strict";
import fs from "node:fs/promises";

const services = [
  "lib/backlinks/services/assetService.ts",
  "lib/backlinks/services/domainService.ts",
  "lib/backlinks/services/contactService.ts",
];
const collectionRoutes = [
  "app/api/backlinks/assets/route.ts",
  "app/api/backlinks/domains/route.ts",
  "app/api/backlinks/contacts/route.ts",
];
const itemRoutes = [
  "app/api/backlinks/assets/[id]/route.ts",
  "app/api/backlinks/domains/[id]/route.ts",
  "app/api/backlinks/contacts/[id]/route.ts",
];

async function main(): Promise<void> {
  for (const file of services) {
    const source = await fs.readFile(file, "utf8");
    assert.doesNotMatch(source, /\.from\(|fetch\(|NextRequest|NextResponse|cookies\(|headers\(|service_role|createClient|as any|: any/);
  }
  for (const file of collectionRoutes) {
    const source = await fs.readFile(file, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function POST/);
    assert.match(source, /getRequestUserAndWorkspace/);
    assert.match(source, /isAdminPrivateEmail/);
    assert.match(source, /requestContext\.user\.id/);
    assert.doesNotMatch(source, /repositories\/|\.from\(|fetch\(|service_role|createClient|DELETE|as any|: any/);
  }
  for (const file of itemRoutes) {
    const source = await fs.readFile(file, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export async function PATCH/);
    assert.match(source, /getRequestUserAndWorkspace/);
    assert.match(source, /isAdminPrivateEmail/);
    assert.doesNotMatch(source, /repositories\/|\.from\(|fetch\(|service_role|createClient|DELETE|as any|: any/);
  }
  console.info("Backlink foundation API smoke passed.");
}

void main();
