/**
 * SEO generator V3 — page scope (S5.4-P). Pure; no clock, network or model.
 *
 * `global`: methodological content, not tied to a place. It has no city, no default city and no local fact.
 * `local`: content justified by verified local facts of ONE exact scope; it needs at least
 * `LOCAL_SCOPE_MIN_DISTINCT_FACTS` distinct facts, on top of every requirement the topic already has.
 * A plan without a scope behaves exactly as before S5.4-P.
 */

export const PAGE_SCOPES = ["global", "local"] as const;
export type PageScope = (typeof PAGE_SCOPES)[number];

export const isPageScope = (value: unknown): value is PageScope => typeof value === "string" && (PAGE_SCOPES as readonly string[]).includes(value);

/** Provisional (a person decides the final value). It never replaces a topic's own depth rules; the stricter one applies. */
export const LOCAL_SCOPE_MIN_DISTINCT_FACTS = 2;
export const LOCAL_SCOPE_THRESHOLD_BASIS = "provisional_pending_human_decision" as const;
