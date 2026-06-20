# Analytics Provider Runner

## Role

This runner validates the first analytics-provider execution layer for a
prepared analytics request.

It does not collect any data.

It does not contact any API.

It only calls the local mock analytics provider.

## Command

```bash
bash marketing-agent/tools/run-analytics-provider.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `analytics-request.md`
- `analytics-qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `analytics-request.md` exists
- `analytics-qa-report.md` exists
- analytics QA overall status is `PASS`
- mock analytics provider exists
- `analytics-provider-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/analytics-provider-report.md
```

## Status model

- `Provider`: mock-analytics
- `Status`: READY
- `Collection`: DISABLED
- `Network`: DISABLED
- `Report Path`: N/A
- `Ready for real analytics provider`: YES

## Rules

- no overwrite
- no API call
- no network access
- no data collection
- no modification of `analytics-request.md`
- no modification of `analytics-qa-report.md`
