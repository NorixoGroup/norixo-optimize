# Publication Status Runner

## Role

This runner aggregates the current publication preparation state for one
campaign item.

It does not publish anything.

It does not contact any provider.

It only summarizes the files already produced by the Publisher pipeline.

## Command

```bash
bash marketing-agent/tools/run-publication-status.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `publication-request.md`
- `publication-qa-report.md`
- `publication-provider-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `publication-status.md` does not already exist
- presence of publication request
- overall status from publication QA
- provider name and provider state from publication provider report

## Output

The runner creates:

```txt
campaign-items/<item-id>/publication-status.md
```

## Status model

- `Publication Request`: FOUND or MISSING
- `Publication QA`: PASS, FAIL, or UNKNOWN
- `Publication Provider`: provider name or UNKNOWN
- `Provider Status`: READY or UNKNOWN
- `Publication`: DISABLED or UNKNOWN
- `Network`: DISABLED or UNKNOWN
- `Overall`: PASS or FAIL
- `Ready for Real Publication Provider`: YES or NO

## Rules

- no overwrite
- no publication
- no provider call
- no modification of existing publication files
