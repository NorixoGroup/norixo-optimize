# Publication QA Runner

## Role

This runner performs the first structural quality gate for a prepared
publication request.

It does not verify marketing quality.

It does not publish anything.

It does not contact any API.

## Command

```bash
bash marketing-agent/tools/run-publication-qa.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `publication-request.md`

## Checks

- scenario exists
- campaign item folder exists
- `publication-request.md` exists
- required publication fields exist
- content, image, and video statuses are `READY`
- `publication-qa-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/publication-qa-report.md
```

## Status model

- `Publication Request`: PASS or FAIL
- `Required Fields`: PASS or FAIL
- `Content`: READY or UNKNOWN
- `Image`: READY or UNKNOWN
- `Video`: READY or UNKNOWN
- `Provider`: NOT EXECUTED
- `Publication`: BLOCKED
- `Overall`: PASS or FAIL

## Rules

- no overwrite
- no publication
- no API call
- no modification of `publication-request.md`
