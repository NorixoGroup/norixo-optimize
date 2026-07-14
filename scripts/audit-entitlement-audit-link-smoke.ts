import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type RouteExpectation = {
  label: string;
  path: string;
  reservationField: string;
};

function assertLinkedAuditInsert(expectation: RouteExpectation) {
  const source = readFileSync(expectation.path, "utf8");
  const reserveIndex = source.indexOf("await reserveAuditEntitlement(");
  const auditInsertIndex = source.indexOf('.from("audits")');
  const linkFieldIndex = source.indexOf(expectation.reservationField);
  const auditPersistedIndex = source.indexOf("auditPersisted = true;");
  const finalizeIndex = source.indexOf("await finalizeAuditEntitlement(");
  const releaseIndex = source.indexOf("await releaseAuditEntitlement(");

  assert.notEqual(reserveIndex, -1, `${expectation.label}: reserve missing`);
  assert.notEqual(auditInsertIndex, -1, `${expectation.label}: audit insert missing`);
  assert.notEqual(linkFieldIndex, -1, `${expectation.label}: entitlement link field missing`);
  assert.notEqual(auditPersistedIndex, -1, `${expectation.label}: auditPersisted marker missing`);
  assert.notEqual(finalizeIndex, -1, `${expectation.label}: finalize missing`);
  assert.notEqual(releaseIndex, -1, `${expectation.label}: release missing`);

  assert.ok(
    reserveIndex < auditInsertIndex,
    `${expectation.label}: reserve must happen before audit insert`,
  );
  assert.ok(
    auditInsertIndex < linkFieldIndex,
    `${expectation.label}: entitlement_reservation_id must be inside audit insert payload`,
  );
  assert.ok(
    linkFieldIndex < auditPersistedIndex,
    `${expectation.label}: audit link must exist before auditPersisted flips`,
  );
  assert.ok(
    auditPersistedIndex < finalizeIndex,
    `${expectation.label}: finalize must happen after successful insert`,
  );

  const insertWindow = source.slice(auditInsertIndex, finalizeIndex);
  assert.match(
    insertWindow,
    /entitlement_reservation_id:\s*entitlementReservation\.reservationId/,
    `${expectation.label}: insert must use reservationId returned by the gate`,
  );
  assert.doesNotMatch(
    insertWindow,
    /entitlement_reservation_id:.*source_url|entitlement_reservation_id:.*url|entitlement_reservation_id:.*payload/i,
    `${expectation.label}: linked field must not use private URL or payload data`,
  );
}

function assertFailureSemantics(path: string, label: string) {
  const source = readFileSync(path, "utf8");

  assert.match(
    source,
    /if\s*\(auditError \|\| !auditRow\)\s*\{[\s\S]*throw new Error/,
    `${label}: insertion failure must throw`,
  );
  assert.match(
    source,
    /catch\s*\(error\)[\s\S]*(releaseAuditEntitlement|releaseHeldEntitlement)/,
    `${label}: catch must still release when persistence never completed`,
  );
  assert.match(
    source,
    /auditPersisted = true;[\s\S]*await finalizeAuditEntitlement\(/,
    `${label}: finalize failure must happen after the durable link exists`,
  );
}

function assertMigrationShape() {
  const migration = readFileSync(
    "supabase/migrations/20260714120000_link_audits_to_entitlement_reservations.sql",
    "utf8",
  );

  assert.match(
    migration,
    /alter table public\.audits\s+add column if not exists entitlement_reservation_id uuid null;/i,
  );
  assert.match(
    migration,
    /foreign key \(entitlement_reservation_id\)\s+references public\.audit_entitlement_reservations\(id\)/i,
  );
  assert.match(
    migration,
    /create unique index if not exists audits_entitlement_reservation_id_unique/i,
  );
  assert.doesNotMatch(migration, /route_source/i);
}

function main() {
  assertLinkedAuditInsert({
    label: "api/audits",
    path: "app/api/audits/route.ts",
    reservationField:
      "entitlement_reservation_id: entitlementReservation.reservationId",
  });
  assertLinkedAuditInsert({
    label: "api/listings",
    path: "app/api/listings/route.ts",
    reservationField:
      "entitlement_reservation_id: entitlementReservation.reservationId",
  });

  assertFailureSemantics("app/api/audits/route.ts", "api/audits");
  assertFailureSemantics("app/api/listings/route.ts", "api/listings");
  assertMigrationShape();

  console.log("PASS — Audit entitlement audit link smoke");
}

main();
