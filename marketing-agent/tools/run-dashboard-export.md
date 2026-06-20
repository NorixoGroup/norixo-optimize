# Run Dashboard Export

## Role

`run-dashboard-export.sh` converts the global scenario registry into a stable
JSON export for a future React or Next.js admin dashboard.

## Inputs

- `marketing-agent/simulations/scenario-registry.md`

## Output

The runner writes:

- `marketing-agent/dashboard-data/scenario-registry.json`

The dashboard should read this export instead of parsing Markdown files
directly.

## Modes

Default mode:

- creates the JSON export only if it does not already exist
- blocks generation if `scenario-registry.json` is already present

Refresh mode:

- rebuilds the JSON export intentionally
- rewrites only `scenario-registry.json`
- never launches any runner

## Safety

- no runner execution
- no provider execution
- no scenario mutation
- no registry mutation
- no network access
- no overwrite if `scenario-registry.json` already exists in default mode
- overwrite allowed only for `scenario-registry.json` in refresh mode
