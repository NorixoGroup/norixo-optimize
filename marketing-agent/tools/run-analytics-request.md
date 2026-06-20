# Analytics Request Runner

## Role

This runner creates the first provider-independent analytics request for one
campaign item.

It does not collect any data.

It does not contact any provider.

It only prepares a standardized local request for the future Analytics Engine.

## Command

```bash
bash marketing-agent/tools/run-analytics-request.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `publication-status.md`
- `campaign/campaign.md`

## Checks

- scenario exists
- campaign item folder exists
- `publication-status.md` exists
- publication overall status is `PASS`
- campaign file exists
- `analytics-request.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/analytics-request.md
```

## Status model

- `Publication`: READY
- `Platform`: Website
- `Locale`: fr
- `Campaign`: campaign name from `campaign/campaign.md`
- `Time Window`: Last 7 Days
- `Metrics`: Standard
- `Provider`: TBD
- `Status`: READY FOR ANALYTICS QA

## Rules

- no overwrite
- no provider call
- no data collection
- no modification of existing publication files
