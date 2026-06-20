# Run Scenario Dashboard Summary

## Role

`run-scenario-dashboard-summary.sh` creates a short scenario-level dashboard
summary intended for fast administrative review.

## Inputs

- `campaign/campaign.md`
- `system-status-index.md`
- existing `system-status.md` files inside `campaign-items/`

## Checks

The runner reads the scenario campaign name, the scenario item counts, the
engine readiness across all items, and the providers already detected in item
system reports.

It never regenerates any status file and never launches another runner.

## Output

The runner writes:

- `scenario-dashboard-summary.md`

The report is designed as a quick steering view rather than a detailed
inventory.

## Safety

- no runner execution
- no provider execution
- no report regeneration
- no network access
- no overwrite if `scenario-dashboard-summary.md` already exists
