import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditNewCopy, getAuditNewCopy, type AuditNewCopy, type AuditNewErrorCode } from "../data/auditNewI18n";
import { defaultLocale } from "../data/i18n";
import {
  AIRBNB_INVALID_MESSAGE,
  AIRBNB_SHORT_LINK_MESSAGE,
  PAGE_UNUSABLE_MESSAGE,
  PLATFORM_UNSUPPORTED_MESSAGE,
  URL_INCOMPLETE_MESSAGE,
  URL_INVALID_MESSAGE,
  getGuestListingReasonCode,
  validateGuestListingUrl,
} from "../lib/guestAudit/shared";

/**
 * S5.4-AB tests: localization of the guest/paywall page /audit/new and of its error messages.
 * Local and deterministic: no network, database, payment, credit or external service. The only process started is a read-only `git diff`.
 *
 *   npx tsx scripts/audit-new-i18n.test.ts
 */

const read = (path: string) => readFileSync(path, "utf8");
const PAGE = "app/(default)/audit/new/AuditNewContent.tsx";

/** Every string a dictionary can show, functions included (called with sample arguments). */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (typeof value === "function") {
    const fn = value as (...args: string[]) => unknown;
    return [[path, String(fn("4.6", "SAMPLE"))]];
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const STOP = new Set("le la les des du une votre vos pour avec sans annonce est sont pas vous cette ce que qui dans sur ou et au aux plus par ses son sa leur nous afin ainsi peut".split(" "));
const looksFrench = (text: string) => {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ']+/g) ?? [];
  const stop = words.filter((w) => STOP.has(w)).length;
  return stop >= 2 || (/[éèêàçùô]/.test(text) && stop >= 1);
};

const en = auditNewCopy.en;
const fr = auditNewCopy.fr;

test("S5.4-AB the English and French dictionaries have exactly the same shape", () => {
  const shape = (c: AuditNewCopy) => leaves(c).map(([k]) => k).sort();
  assert.deepEqual(shape(en), shape(fr));
  assert.ok(shape(en).length > 150, "the dictionary covers the whole page");
  for (const [path, text] of [...leaves(en), ...leaves(fr)]) assert.ok(text.trim().length > 0, `empty text at ${path}`);
});

test("S5.4-AB English text on /audit/new: no French in the English dictionary", () => {
  const allowedAccents = new Set(["titlePlaceholder"]); // the invented example title names a real district ("Guéliz")
  for (const [path, text] of leaves(en)) {
    assert.ok(!looksFrench(text), `French-looking English text at ${path}: ${text}`);
    if (!allowedAccents.has(path)) assert.ok(!/[éèêàçùô]/.test(text), `accented letter at ${path}: ${text}`);
  }
  assert.equal(en.heroTitle, "Start an audit of your listing");
  assert.equal(en.launch, "Continue");
  assert.equal(en.unlockCta, "Unlock my bookings now");
  assert.equal(en.errors.checkout_unavailable, "Unable to open Stripe checkout right now.");
});

test("S5.4-AB French text on /audit/new: the French dictionary keeps the text the page showed before", () => {
  const anchors = [
    "Lancez l’audit de votre annonce", "Paramètres de l’annonce", "URL de l’annonce", "Continuer", "Analyse en cours...", "Lancer un audit",
    "Mode compte connecté", "Offre sélectionnée", "Aller à la facturation", "Débloquer mes réservations maintenant", "J'ai déjà un compte", "Paiement sécurisé • Sans engagement",
    "Extraction du logement...", "Préparation de l’aperçu...", "Veuillez choisir le type de logement.", "Une erreur inconnue est survenue",
    "Session introuvable. Reconnectez-vous puis réessayez.", "Impossible de charger votre espace de travail.", "Workspace introuvable. Réessayez ou ouvrez la page Facturation.",
    "Impossible d'ouvrir le checkout Stripe pour le moment.", "Session Stripe indisponible, merci de réessayer.", "Pack 5 audits", "Audit unique", "9 €", "39 €", "99 €",
    "5 audits, soit 7,80 € / audit", "15 audits, soit 6,60 € / audit", "Accès activé une fois le paiement confirmé", "Votre annonce est vue… mais vos concurrents convertissent mieux.",
  ];
  const all = new Set(leaves(fr).map(([, v]) => v));
  for (const a of anchors) assert.ok(all.has(a), `missing French text: ${a}`);
  assert.equal(fr.visibleRating("4.6"), "Note visible : 4.6 / 5");
  assert.equal(en.visibleRating("4.6"), "Visible rating: 4.6 / 5");
});

test("S5.4-AB English fallback for a language the page does not cover", () => {
  for (const locale of ["es", "it", "pt", "nl", "de", "ja", "zh", "ko", "ar", "xx", ""]) assert.equal(getAuditNewCopy(locale), en, locale);
  assert.equal(getAuditNewCopy("fr"), fr);
  assert.equal(getAuditNewCopy("en"), en);
  // the page uses the project's hook, whose own rule is the same fallback to the default locale
  assert.equal(defaultLocale, "en");
  assert.match(read("components/i18n/useTranslation.ts"), /dictionary\[locale\] \? locale : defaultLocale/);
  assert.match(read(PAGE), /useTranslation\(auditNewCopy\)/);
});

test("S5.4-AB API/validation errors are translated by stable code", () => {
  const known: [string, string][] = [
    [URL_INCOMPLETE_MESSAGE, "url_incomplete"], [URL_INVALID_MESSAGE, "url_invalid"], [PLATFORM_UNSUPPORTED_MESSAGE, "platform_unsupported"],
    [PAGE_UNUSABLE_MESSAGE, "page_unusable"], [AIRBNB_INVALID_MESSAGE, "airbnb_invalid"], [AIRBNB_SHORT_LINK_MESSAGE, "airbnb_short_link"],
  ];
  for (const [message, code] of known) {
    assert.equal(getGuestListingReasonCode(message), code);
    // the French copy is exactly the historical message; the English copy is a translation
    assert.equal(fr.errors[code as AuditNewErrorCode], message);
    assert.notEqual(en.errors[code as AuditNewErrorCode], message);
  }
  assert.equal(getGuestListingReasonCode("some other text"), null);
  assert.equal(getGuestListingReasonCode(undefined), null);
  // real inputs of the validator: every refusal maps to a code with an English message
  const refused = ["", "hello", "https://www.airbnb.com/h/abc", "https://www.airbnb.com/rooms/abc", "https://example.com/listing/1", "https://www.booking.com/", "https://www.vrbo.com/"];
  for (const input of refused) {
    const result = validateGuestListingUrl(input);
    assert.equal(result.valid, false, input);
    const code = getGuestListingReasonCode(result.reason);
    assert.notEqual(code, null, `${input} -> ${result.reason}`);
    assert.ok(!looksFrench(en.errors[code!]), en.errors[code!]);
  }
  assert.equal(validateGuestListingUrl("https://www.airbnb.com/rooms/12345").valid, true);
  // the page maps a refusal to the code, never shows the historical string, and no longer compares message text
  const page = read(PAGE);
  assert.match(page, /setError\(getGuestListingReasonCode\(validation\.reason\) \?\? "url_invalid"\)/);
  assert.match(page, /if \(!propertyTypeOverride\.trim\(\)\) \{\s*setError\("property_type_required"\);/);
  assert.match(page, /error === "property_type_required"/);
  for (const code of ["session_not_found", "workspace_load_failed", "workspace_not_found", "checkout_unavailable", "checkout_session_unavailable"]) {
    assert.match(page, new RegExp(`setPremiumCheckoutError\\("${code}"\\)`), code);
    assert.ok(en.errors[code as AuditNewErrorCode].length > 10 && fr.errors[code as AuditNewErrorCode].length > 10);
  }
  assert.match(page, /t\.errors\[error\]/);
  assert.match(page, /t\.errors\[premiumCheckoutError\]/);
  assert.doesNotMatch(page, /Veuillez choisir le type de logement|Impossible d'ouvrir le checkout/);
});

test("S5.4-AB historical responses stay compatible", () => {
  // validator: same fields, same historical reasons; the guest-audit API still returns them
  const result = validateGuestListingUrl("https://www.airbnb.com/h/abc");
  assert.deepEqual(Object.keys(result).sort(), ["platform", "reason", "valid"]);
  assert.equal(result.reason, AIRBNB_SHORT_LINK_MESSAGE);
  assert.match(read("app/api/guest-audit/route.ts"), /error: validation\.reason \|\| "URL invalide"/);
});

test("S5.4-AB no regression on offers, credits and payments", () => {
  const page = read(PAGE);
  // offer codes, order, highlight and plan mapping are unchanged
  assert.match(page, /\{ code: "audit_test", highlighted: false \},\s*\{ code: "pack_5", highlighted: true \},\s*\{ code: "pack_15", highlighted: false \},/);
  assert.match(page, /if \(offer === "pack_5"\) return "pro";\s*if \(offer === "pack_15"\) return "scale";\s*return "audit_test";/);
  // checkout request unchanged
  assert.match(page, /fetch\("\/api\/stripe\/checkout"/);
  assert.match(page, /checkoutMode: "one_shot"/);
  assert.match(page, /interval: "month"/);
  assert.match(page, /\.\.\.\(checkoutPlan === "audit_test" \? \{ quantity: 1 \} : \{\}\)/);
  // amounts: the same numbers in both languages
  const numbers = (c: AuditNewCopy) => ["audit_test", "pack_5", "pack_15"].map((k) => {
    const o = c.offers[k as keyof AuditNewCopy["offers"]];
    return [o.price, o.detail, o.listings].map((x) => x.match(/\d+(?:[.,]\d+)?/g)!.map((n) => n.replace(",", ".")).join("|")).join(" / ");
  });
  assert.deepEqual(numbers(en), numbers(fr));
  assert.deepEqual(numbers(en), ["9 / 1 / 1", "39 / 5|7.80 / 5", "99 / 15|6.60 / 15"]);
});

test("S5.4-AC the public page shows no debugging panel", () => {
  const page = read(PAGE);
  // the panel printed internal state to every visitor: url, detectedPlatform, isSubmitting, canLaunchAudit, disabledFinal
  for (const label of ["disabledFinal", "canLaunchAudit:", "detectedPlatform:", "isSubmitting:", "canCreateAudit (", "url: {"]) {
    assert.ok(!page.includes(label), `debug rendering is back: ${label}`);
  }
  // the underlying logic is kept: the launch button is still disabled by the same condition
  assert.match(page, /const isLaunchDisabled = isSubmitting \|\| !canLaunchAudit;/);
  assert.match(page, /disabled=\{isLaunchDisabled\}/);
  // the dictionary no longer carries debug strings
  for (const copy of [en, fr]) assert.ok(!("debugEmpty" in copy) && !("adminDebugLine" in copy));
  // the Suspense fallback of the route shows no French word
  assert.ok(!/Chargement/.test(read("app/(default)/audit/new/page.tsx")));
});

test("S5.4-AC no unproven promise of speed or immediacy in the page copy", () => {
  // the code guarantees no duration (no timeout setting, no measure) and credits are granted after payment confirmation
  const banned = /30 seconds|30 secondes|within minutes|quelques minutes|under \d+|moins de \d+|immediate|immédiat|instantly|instantanément|guarantee|garanti/i;
  const allowedGuestPreview = new Set(["guestInstant", "submitHintGuest"]); // reported to the product owner, wording not decided here
  for (const [path, text] of [...leaves(en), ...leaves(fr)]) {
    if (allowedGuestPreview.has(path)) continue;
    assert.ok(!banned.test(text), `unproven promise at ${path}: ${text}`);
  }
  assert.equal(en.immediateAccess, "Access is activated once your payment is confirmed");
  assert.equal(fr.immediateAccess, "Accès activé une fois le paiement confirmé");
});
