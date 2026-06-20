# Run Dashboard Validation

## Role

`run-dashboard-validation.sh` validates the structure of dashboard JSON exports
before a future React or Next.js admin interface reads them.

## Input

- `marketing-agent/dashboard-data/scenario-registry.json`

## Checks

The runner validates:

- JSON presence
- JSON syntax
- top-level metadata fields
- summary fields
- scenario collection presence
- required fields inside each scenario entry

It never rewrites the JSON export and never launches another runner.

## Output

The runner writes:

- `marketing-agent/dashboard-data/dashboard-validation-report.md`

## Modes

Default mode:

- creates the validation report only if it does not already exist
- blocks generation if `dashboard-validation-report.md` is already present

Refresh mode:

- rebuilds the validation report intentionally
- rewrites only `dashboard-validation-report.md`
- never regenerates the JSON export

## Safety

- no runner execution
- no provider execution
- no export regeneration
- no network access
- no overwrite if `dashboard-validation-report.md` already exists in default mode
- overwrite allowed only for `dashboard-validation-report.md` in refresh mode
