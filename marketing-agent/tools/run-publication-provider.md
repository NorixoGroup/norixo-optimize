# Publication Provider Runner

## Role

This runner validates the first publication-provider execution layer for a
prepared publication request.

It does not publish anything.

It does not contact any API.

It only calls the local mock publication provider.

## Command

```bash
bash marketing-agent/tools/run-publication-provider.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `publication-request.md`
- `publication-qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `publication-request.md` exists
- `publication-qa-report.md` exists
- publication QA overall status is `PASS`
- mock publication provider exists
- `publication-provider-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/publication-provider-report.md
```

## Status model

- `Provider`: mock-publication
- `Status`: READY
- `Publication`: DISABLED
- `Network`: DISABLED
- `Publication ID`: N/A
- `Publication URL`: N/A
- `Ready for real publication provider`: YES

## Rules

- no overwrite
- no API call
- no network access
- no publication
- no modification of `publication-request.md`
- no modification of `publication-qa-report.md`
