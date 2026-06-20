# Run System Status Index

## Role

`run-system-status-index.sh` aggregates all existing campaign item system
status reports into one scenario-level index.

## Inputs

- scenario name
- existing `system-status.md` files inside `campaign-items/`

## Checks

The runner:

- detects each campaign item directory
- checks whether `system-status.md` exists for each item
- extracts the item overall status
- extracts the item system readiness flag

It never launches `run-system-status.sh` and never creates missing item
statuses.

## Output

The runner writes:

- `system-status-index.md`

The report summarizes detected items, `PASS` items, missing item statuses, and
failed items for the full scenario.

## Safety

- no agent execution
- no provider execution
- no status regeneration
- no network access
- no overwrite if `system-status-index.md` already exists
