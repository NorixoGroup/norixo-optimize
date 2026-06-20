# Run Scenario Registry

## Role

`run-scenario-registry.sh` creates a single registry for all Marketing AI
simulation scenarios.

By default it protects an existing registry from overwrite.

With `--refresh` or `--refresh=true`, it rebuilds the registry intentionally.

## Inputs

- scenario directories inside `marketing-agent/simulations/`
- optional `campaign/`
- optional `campaign-items/`
- optional `scenario-dashboard-summary.md`
- optional `system-status-index.md`

## Checks

The runner:

- detects every scenario directory
- checks whether each scenario has campaign structure
- checks whether dashboard and system index reports already exist
- reads campaign name when available
- counts campaign item directories
- classifies each scenario as healthy, warning, or error

It never launches any other runner and never creates missing scenario assets.

## Output

The runner writes:

- `marketing-agent/simulations/scenario-registry.md`

The registry is intended to become the single source for a future Admin
Dashboard.

## Modes

Default mode:

- creates the registry only if it does not already exist
- blocks generation if `scenario-registry.md` is already present

Refresh mode:

- rescans every scenario
- rebuilds `scenario-registry.md`
- rewrites only the global registry file
- never relaunches any runner

## Safety

- no runner execution
- no provider execution
- no scenario mutation
- no network access
- no overwrite if `scenario-registry.md` already exists in default mode
- overwrite allowed only for `scenario-registry.md` in refresh mode
