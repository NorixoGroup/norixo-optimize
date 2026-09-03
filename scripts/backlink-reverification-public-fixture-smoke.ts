import { GET } from "../app/__backlink-fixtures/reverification/bl-p1-03/route";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const first = GET();
  const second = GET();
  const body = await first.text();

  assert(first.status === 200, "Fixture must return 200.");
  assert(first.headers.get("content-type") === "text/html; charset=utf-8", "Fixture must return HTML.");
  assert(first.headers.get("x-robots-tag") === "noindex, nofollow", "Fixture must be noindex.");
  assert(body.includes('<meta name="robots" content="noindex,nofollow">'), "Fixture must include robots meta.");
  assert(body.includes('<a href="https://norixo.io/">Norixo</a>'), "Fixture must contain the exact followed backlink.");
  assert(!body.includes("rel="), "Fixture anchor must not have rel attributes.");
  assert(body === await second.text(), "Fixture response must be deterministic.");
  console.info("PASS — Backlink reverification public fixture smoke");
}

void main();
