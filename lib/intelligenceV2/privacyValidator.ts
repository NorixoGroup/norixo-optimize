export type PrivacyViolationCode =
  | "forbidden_key"
  | "forbidden_url_value"
  | "forbidden_coordinate_object"
  | "non_serializable_value"
  | "non_plain_object";

export type PrivacyViolation = Readonly<{
  path: string;
  code: PrivacyViolationCode;
}>;

export type PrivacyValidationResult = Readonly<{
  valid: boolean;
  violations: PrivacyViolation[];
}>;

const FORBIDDEN_KEYS = new Set(
  [
    "userId",
    "user_id",
    "workspaceId",
    "workspace_id",
    "listingId",
    "listing_id",
    "auditId",
    "audit_id",
    "snapshotId",
    "snapshot_id",
    "comparableId",
    "comparable_id",
    "url",
    "sourceUrl",
    "source_url",
    "title",
    "description",
    "photo",
    "photos",
    "image",
    "images",
    "latitude",
    "longitude",
    "lat",
    "lng",
    "address",
    "raw",
    "payload",
    "html",
  ].map((value) => normalizeKey(value)),
);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isForbiddenUrlValue(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function isCoordinateObject(value: Record<string, unknown>): boolean {
  const latitude = value.latitude;
  const longitude = value.longitude;
  const lat = value.lat;
  const lng = value.lng;

  const hasLatLng =
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng);
  const hasLatitudeLongitude =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  return hasLatLng || hasLatitudeLongitude;
}

function pushViolation(
  violations: PrivacyViolation[],
  path: string,
  code: PrivacyViolationCode,
): void {
  violations.push({ path, code });
}

function visitValue(
  value: unknown,
  path: string,
  violations: PrivacyViolation[],
): void {
  if (value == null) return;

  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    typeof value === "undefined"
  ) {
    pushViolation(violations, path, "non_serializable_value");
    return;
  }

  if (typeof value === "string") {
    if (isForbiddenUrlValue(value)) {
      pushViolation(violations, path, "forbidden_url_value");
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      visitValue(value[index], `${path}[${index}]`, violations);
    }
    return;
  }

  if (value instanceof Date) {
    pushViolation(violations, path, "non_plain_object");
    return;
  }

  if (!isPlainObject(value)) {
    pushViolation(violations, path, "non_plain_object");
    return;
  }

  if (isCoordinateObject(value)) {
    pushViolation(violations, path, "forbidden_coordinate_object");
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const childPath = path === "$" ? `$.${key}` : `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
      pushViolation(violations, childPath, "forbidden_key");
    }
    visitValue(nestedValue, childPath, violations);
  }
}

export function validateSharedIntelligencePrivacy(
  value: unknown,
): PrivacyValidationResult {
  const violations: PrivacyViolation[] = [];
  visitValue(value, "$", violations);
  return {
    valid: violations.length === 0,
    violations,
  };
}
