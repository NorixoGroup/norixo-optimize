# V3 pilot runbook (S5.3-C5) — Paris, Barcelona, Amsterdam

Status: PREPARATION ONLY. No network collection, no import, no fact, no decision exists. The 180-day threshold is provisional
and unconfirmed. Nothing here authenticates a person or makes the decision log tamper-proof.

## 1. Generate the three sheets (offline, prints JSON, writes nothing)

    npx --no-install tsx scripts/seo-v3-pilot-sheets.ts --as-of <ISO instant> > <outside the repo>/pilot-sheets.json

Output: three `long_stay_rule` sheets, `origin: "voluntary"`, `ready_to_collect`, accepted types `minimum_stay` / `night_cap`,
`candidateSources: []` (no source is approved yet).

## 2. Expected files (none exists today)

    data/seo-v3/sources.json            source registry (seo-v3-source-registry/1), entries approved by a human only
    data/seo-v3/facts/<name>.json       fact files (seo-v3-fact-file), one record per fact, NO `validation` / `usage` keys
    data/seo-v3/decisions/<name>.jsonl  append-only human decisions (submit -> validate -> approve_public_use)
    <evidence-dir>/<sha256>             archived pages/PDFs, outside the repository, one file per SHA-256, no extension

## 3. Fields still to be filled by a person

- Sources: `sourceId`, `publisher`, `sourceType` (official_authority), `terms` (verified_permissive + reference),
  `rights.publicTextUse`, `requiredRestrictions`, exact `allowedHosts`, `reviewedBy` (role:xxx), `reviewedAt`, `reviewValidUntil`.
- Facts: `factId`, `ruleType` (minimum_stay | night_cap), `rule`, `effectiveFrom`/`effectiveUntil`, `officialReference`,
  `source` (https locator on an allowed host, `consultedAt`, method, terms copied from the registry, content_hash evidence),
  `confidence`, `collectedAt`, `validUntil`, `citations[]` (artifactSha256, verbatim quote 12-400 chars, locator, geographic /
  temporal / semantic applicability).
- Decisions: validate (three checks + exact list of reviewed citation hashes), approve_public_use (scope = topics).
- A timezone fact (platform null, property type null, same exact city scope) once a rule is validated.

## 4. To confirm before any network step

- Exact host names (`paris.fr` and `www.paris.fr` are different hosts) and exact URLs: not documented in the repo, to be verified.
- Reuse and attribution rights of every source (read the site terms and robots.txt before fetching anything).
- Municipal vs regional vs national authority: a national text is never a city fact.
- Whether Spain needs a national authority host (not in the candidate list).
- Decision on the 180 days and on the `observationMustEndAfter` label.

## 5. External evidence folder and backups

- Keep the evidence folder OUTSIDE the repository and OUTSIDE the same disk when possible; one file per SHA-256.
- Keep a second copy on independent media and record a manifest of hashes (`shasum -a 256`).
- Never put the baseline report hash only in the repository it protects.

## 6. First import (not run yet)

    npx --no-install tsx scripts/seo-v3-import-facts.ts --as-of <ISO> --dir data/seo-v3 --evidence-dir <dir> \
      --allowed-actors role:owner --first-import > <outside the repo>/baseline-1.json

Store `baseline-1.json`, and write down its `reportHash` field (not the file hash) somewhere independent.

## 7. Second import (not run yet)

    npx --no-install tsx scripts/seo-v3-import-facts.ts --as-of <ISO> --dir data/seo-v3 --evidence-dir <dir> \
      --allowed-actors role:owner --previous-report <baseline-1.json> --expect-baseline-hash <reportHash>

Expected refusals: no baseline -> nothing imported (exit 2); edited baseline or hash mismatch -> exit 1; modified, removed or
unreadable decision line -> the affected facts are refused (exit 2).
