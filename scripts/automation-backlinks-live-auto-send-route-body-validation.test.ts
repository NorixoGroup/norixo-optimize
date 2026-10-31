import assert from "node:assert/strict";
import test from "node:test";

import { parseBody } from "@/app/api/internal/automation/backlinks/outreach/send-one/route";

const VALID_ID = "550e8400-e29b-41d4-a716-4466554400bb";

test("parseBody: absent outreachId key is rejected", () => {
  assert.equal(parseBody({ confirm: true }), null);
});

test("parseBody: outreachId null is rejected", () => {
  assert.equal(parseBody({ confirm: true, outreachId: null }), null);
});

test("parseBody: outreachId empty string is rejected", () => {
  assert.equal(parseBody({ confirm: true, outreachId: "" }), null);
});

test("parseBody: outreachId whitespace-only is rejected", () => {
  assert.equal(parseBody({ confirm: true, outreachId: "   " }), null);
});

test("parseBody: outreachId of the wrong type is rejected", () => {
  assert.equal(parseBody({ confirm: true, outreachId: 12345 }), null);
  assert.equal(parseBody({ confirm: true, outreachId: true }), null);
  assert.equal(parseBody({ confirm: true, outreachId: [VALID_ID] }), null);
  assert.equal(parseBody({ confirm: true, outreachId: { id: VALID_ID } }), null);
});

test("parseBody: outreachId malformed (not a UUID, including a business key) is rejected", () => {
  assert.equal(parseBody({ confirm: true, outreachId: "BL-OUT-2026-019" }), null);
  assert.equal(parseBody({ confirm: true, outreachId: "not-a-uuid" }), null);
});

test("parseBody: whole body absent, null, or not an object is rejected", () => {
  assert.equal(parseBody(undefined), null);
  assert.equal(parseBody(null), null);
  assert.equal(parseBody("string"), null);
  assert.equal(parseBody([{ confirm: true, outreachId: VALID_ID }]), null);
});

test("parseBody: confirm must be exactly true", () => {
  assert.equal(parseBody({ confirm: false, outreachId: VALID_ID }), null);
  assert.equal(parseBody({ confirm: "true", outreachId: VALID_ID }), null);
});

test("parseBody: extra or missing keys are rejected even with a valid outreachId", () => {
  assert.equal(parseBody({ outreachId: VALID_ID }), null);
  assert.equal(parseBody({ confirm: true, outreachId: VALID_ID, extra: "x" }), null);
});

test("parseBody: a valid confirm + well-formed UUID outreachId is accepted and trimmed", () => {
  assert.deepEqual(parseBody({ confirm: true, outreachId: `  ${VALID_ID}  ` }), {
    confirm: true,
    outreachId: VALID_ID,
  });
});
