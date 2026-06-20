# Learning QA Runner

## Role

This runner performs the first structural quality gate for a prepared
learning input.

It does not perform any learning.

It does not produce any recommendation.

It does not take any decision.

It only validates local input structure before any future learning provider or
signal engine execution.

## Command

```bash
bash marketing-agent/tools/run-learning-qa.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `learning-input.md`

## Checks

- scenario exists
- campaign item folder exists
- `learning-input.md` exists
- required learning fields exist
- analytics status is `READY`
- learning input status is `READY FOR LEARNING QA`
- `learning-qa-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/learning-qa-report.md
```

## Status model

- `Learning Input`: PASS or FAIL
- `Required Fields`: PASS or FAIL
- `Analytics`: READY or UNKNOWN
- `Learning`: NOT EXECUTED
- `Decision`: BLOCKED
- `Overall`: PASS or FAIL

## Rules

- no overwrite
- no API call
- no learning
- no recommendation
- no decision
- no modification of `learning-input.md`
