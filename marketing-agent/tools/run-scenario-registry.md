# Run Scenario Registry

## Role

`run-scenario-registry.sh` creates a single registry for all Marketing AI
simulation scenarios.

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

## Safety

- no runner execution
- no provider execution
- no scenario mutation
- no network access
- no overwrite if `scenario-registry.md` already exists
