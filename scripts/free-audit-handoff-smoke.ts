import assert from "node:assert/strict";

import type { FreeAuditFormValues } from "../app/free-audit/freeAuditPageModel";

const FORBIDDEN_KEYS = new Set([
  "artifactKey",
  "artifact_key",
  "marketCellKey",
  "market_cell_key",
  "benchmark",
  "confidence",
  "recommendations",
  "reasonCodes",
  "reason_codes",
  "userId",
  "user_id",
  "workspaceId",
  "workspace_id",
  "auditId",
  "audit_id",
  "checkoutSessionId",
  "checkout_session_id",
]);

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

function buildValidForm(
  overrides: Partial<FreeAuditFormValues> = {},
): FreeAuditFormValues {
  return {
    listingUrl: "https://www.airbnb.com/rooms/123456789",
    country: "France",
    city: "Paris",
    platform: "airbnb",
    propertyType: "apartment",
    ...overrides,
  };
}

function collectForbiddenKeys(value: unknown, found: Set<string> = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectForbiddenKeys(entry, found);
    }
    return found;
  }

  if (value != null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        found.add(key);
      }
      collectForbiddenKeys(nested, found);
    }
  }

  return found;
}

function withWindowStorage<T>(run: (storage: MemoryStorage) => T): T {
  const storage = new MemoryStorage();

  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  });

  return run(storage);
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??=
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.payload";

  const {
    FREE_AUDIT_ALLOWED_PAYLOAD_KEYS,
    FREE_AUDIT_HANDOFF_ALLOWED_KEYS,
    buildFreeAuditHandoffDraftInput,
    validateFreeAuditForm,
  } = await import("../app/free-audit/freeAuditPageModel");
  const {
    GUEST_AUDIT_DRAFTS_KEY,
    GUEST_AUDIT_DRAFT_KEY,
    clearGuestAuditDraft,
    consumeFreeAuditGuestDraftForAuditNew,
    isGuestAuditDraftExpired,
    loadGuestAuditDraft,
    saveFreeAuditGuestDraft,
  } = await import("../lib/guestAuditDraft");

  withWindowStorage((storage) => {
    const validation = validateFreeAuditForm(buildValidForm());
    assert.equal(validation.ok, true);
    if (!validation.ok) {
      throw new Error("Expected a valid free audit form");
    }

    assert.deepEqual(
      Object.keys(validation.payload).sort(),
      [...FREE_AUDIT_ALLOWED_PAYLOAD_KEYS].sort(),
    );
    assert.equal("guestCapacity" in validation.payload, false);
    assert.equal("declaredNightlyPrice" in validation.payload, false);
    assert.equal("currency" in validation.payload, false);

    const handoffDraft = buildFreeAuditHandoffDraftInput(validation);
    assert.deepEqual(
      Object.keys(handoffDraft).sort(),
      [...FREE_AUDIT_HANDOFF_ALLOWED_KEYS].sort(),
    );
    assert.equal(handoffDraft.origin, "free_audit");
    assert.equal(handoffDraft.listingUrl, "https://www.airbnb.com/rooms/123456789");
    assert.deepEqual([...collectForbiddenKeys(handoffDraft)], []);

    saveFreeAuditGuestDraft(handoffDraft);

    const storedDraft = loadGuestAuditDraft();
    assert.notEqual(storedDraft, null);
    assert.equal(storedDraft?.origin, "free_audit");
    assert.equal(storedDraft?.listing_url, "https://airbnb.com/rooms/123456789");
    assert.equal(storedDraft?.platform, "airbnb");
    assert.equal(storedDraft?.property_type_override, "apartment");
    assert.equal(storedDraft?.country, "France");
    assert.equal(storedDraft?.city, "Paris");
    assert.equal(storedDraft?.guest_capacity, undefined);
    assert.equal(storedDraft?.declared_nightly_price, undefined);
    assert.equal(storedDraft?.currency, undefined);
    assert.deepEqual([...collectForbiddenKeys(storedDraft)], []);

    const consumedPrefill = consumeFreeAuditGuestDraftForAuditNew();
    assert.deepEqual(consumedPrefill, {
      origin: "free_audit",
      listingUrl: "https://airbnb.com/rooms/123456789",
      platform: "airbnb",
      country: "France",
      city: "Paris",
      propertyTypeOverride: "apartment",
      guestCapacity: null,
      declaredNightlyPrice: null,
      currency: null,
    });
    assert.equal(consumeFreeAuditGuestDraftForAuditNew(), null);

    clearGuestAuditDraft();

    const noUrlValidation = validateFreeAuditForm(buildValidForm({ listingUrl: "" }));
    assert.equal(noUrlValidation.ok, true);
    if (!noUrlValidation.ok) {
      throw new Error("Expected a valid free audit handoff without listing URL");
    }

    saveFreeAuditGuestDraft(buildFreeAuditHandoffDraftInput(noUrlValidation));
    const noUrlConsumed = consumeFreeAuditGuestDraftForAuditNew();
    assert.notEqual(noUrlConsumed, null);
    assert.equal(noUrlConsumed?.listingUrl, null);
    assert.equal(noUrlConsumed?.propertyTypeOverride, "apartment");
    assert.equal(noUrlConsumed?.guestCapacity, null);
    assert.equal(noUrlConsumed?.declaredNightlyPrice, null);
    assert.equal(noUrlConsumed?.currency, null);

    clearGuestAuditDraft();

    const expiredCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    storage.setItem(
      GUEST_AUDIT_DRAFTS_KEY,
      JSON.stringify([
        {
          origin: "free_audit",
          listing_url: "",
          platform: "airbnb",
          property_type_override: "apartment",
          country: "France",
          city: "Paris",
          guest_capacity: 4,
          declared_nightly_price: 145,
          currency: "EUR",
          generated_at: expiredCreatedAt,
          created_at: expiredCreatedAt,
          updated_at: expiredCreatedAt,
          result: {},
        },
      ]),
    );
    const expiredDraft = loadGuestAuditDraft();
    assert.notEqual(expiredDraft, null);
    assert.equal(isGuestAuditDraftExpired(expiredDraft!), true);
    assert.equal(consumeFreeAuditGuestDraftForAuditNew(), null);

    clearGuestAuditDraft();

    storage.setItem(GUEST_AUDIT_DRAFTS_KEY, JSON.stringify([{ origin: "free_audit" }]));
    assert.equal(loadGuestAuditDraft(), null);

    clearGuestAuditDraft();

    storage.setItem(
      GUEST_AUDIT_DRAFT_KEY,
      JSON.stringify({
        origin: "free_audit",
        listing_url: "",
        platform: "invalid-platform",
        property_type_override: "invalid-type",
        generated_at: new Date().toISOString(),
        result: {},
      }),
    );
    storage.removeItem(GUEST_AUDIT_DRAFTS_KEY);
    const sanitizedLegacyDraft = loadGuestAuditDraft();
    assert.notEqual(sanitizedLegacyDraft, null);
    assert.equal(sanitizedLegacyDraft?.platform, undefined);
    assert.equal(sanitizedLegacyDraft?.property_type_override, undefined);
    const sanitizedLegacyPrefill = consumeFreeAuditGuestDraftForAuditNew();
    assert.deepEqual(sanitizedLegacyPrefill, {
      origin: "free_audit",
      listingUrl: null,
      platform: null,
      country: null,
      city: null,
      propertyTypeOverride: null,
      guestCapacity: null,
      declaredNightlyPrice: null,
      currency: null,
    });
  });

  console.log("PASS — Free audit handoff smoke");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
