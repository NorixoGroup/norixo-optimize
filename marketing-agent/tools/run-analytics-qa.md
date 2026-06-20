# Analytics QA Runner

## Role

This runner performs the first structural quality gate for a prepared
analytics request.

It does not collect any data.

It does not contact any provider.

It only validates local request structure before any future analytics provider
execution.

## Command

```bash
bash marketing-agent/tools/run-analytics-qa.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `analytics-request.md`

## Checks

- scenario exists
- campaign item folder exists
- `analytics-request.md` exists
- required analytics fields exist
- publication status is `READY`
- analytics request status is `READY FOR ANALYTICS QA`
- `analytics-qa-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/analytics-qa-report.md
```

## Status model

- `Analytics Request`: PASS or FAIL
- `Required Fields`: PASS or FAIL
- `Publication`: READY or UNKNOWN
- `Provider`: NOT EXECUTED
- `Collection`: BLOCKED
- `Overall`: PASS or FAIL

## Rules

- no overwrite
- no provider call
- no data collection
- no modification of `analytics-request.md`
