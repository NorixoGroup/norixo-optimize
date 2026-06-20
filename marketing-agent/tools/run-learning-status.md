# Learning Status Runner

## Role

This runner aggregates the current learning preparation state for one campaign
item.

It does not perform any learning.

It does not produce any recommendation.

It does not take any decision.

It only summarizes the files already produced by the Learning pipeline.

## Command

```bash
bash marketing-agent/tools/run-learning-status.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `learning-input.md`
- `learning-qa-report.md`
- `learning-provider-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `learning-status.md` does not already exist
- presence of learning input
- overall status from learning QA
- provider name and provider state from learning provider report

## Output

The runner creates:

```txt
campaign-items/<item-id>/learning-status.md
```

## Status model

- `Learning Input`: FOUND or MISSING
- `Learning QA`: PASS, FAIL, or UNKNOWN
- `Learning Provider`: provider name or UNKNOWN
- `Provider Status`: READY or UNKNOWN
- `Learning`: DISABLED or UNKNOWN
- `Decision`: DISABLED or UNKNOWN
- `Network`: DISABLED or UNKNOWN
- `Overall`: PASS or FAIL
- `Ready for Real Learning Provider`: YES or NO

## Rules

- no overwrite
- no provider call
- no learning
- no recommendation
- no decision
- no modification of existing learning files
