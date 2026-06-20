# Analytics Status Runner

## Role

This runner aggregates the current analytics preparation state for one
campaign item.

It does not collect any data.

It does not contact any provider.

It only summarizes the files already produced by the Analytics pipeline.

## Command

```bash
bash marketing-agent/tools/run-analytics-status.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `analytics-request.md`
- `analytics-qa-report.md`
- `analytics-provider-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `analytics-status.md` does not already exist
- presence of analytics request
- overall status from analytics QA
- provider name and provider state from analytics provider report

## Output

The runner creates:

```txt
campaign-items/<item-id>/analytics-status.md
```

## Status model

- `Analytics Request`: FOUND or MISSING
- `Analytics QA`: PASS, FAIL, or UNKNOWN
- `Analytics Provider`: provider name or UNKNOWN
- `Provider Status`: READY or UNKNOWN
- `Collection`: DISABLED or UNKNOWN
- `Network`: DISABLED or UNKNOWN
- `Overall`: PASS or FAIL
- `Ready for Real Analytics Provider`: YES or NO

## Rules

- no overwrite
- no provider call
- no data collection
- no modification of existing analytics files
