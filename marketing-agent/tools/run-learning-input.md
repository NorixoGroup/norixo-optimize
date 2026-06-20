# Learning Input Runner

## Role

This runner creates the first provider-independent learning input for one
campaign item.

It does not perform any learning.

It does not produce recommendations.

It does not take any decision.

It only prepares a standardized local input for the future Learning Engine.

## Command

```bash
bash marketing-agent/tools/run-learning-input.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `analytics-status.md`
- `analytics-request.md`

## Checks

- scenario exists
- campaign item folder exists
- `analytics-status.md` exists
- analytics overall status is `PASS`
- `analytics-request.md` exists
- `learning-input.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/learning-input.md
```

## Status model

- `Analytics`: READY
- `Campaign`: from `analytics-request.md`
- `Platform`: from `analytics-request.md`
- `Locale`: from `analytics-request.md`
- `Time Window`: from `analytics-request.md`
- `Learning Scope`: Standard
- `Status`: READY FOR LEARNING QA

## Rules

- no overwrite
- no API call
- no learning
- no recommendation
- no decision
- no modification of existing analytics files
