# Learning Provider Runner

## Role

This runner validates the first learning-provider execution layer for a
prepared learning input.

It does not perform any learning.

It does not produce any recommendation.

It does not take any decision.

It only calls the local mock learning provider.

## Command

```bash
bash marketing-agent/tools/run-learning-provider.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `learning-input.md`
- `learning-qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `learning-input.md` exists
- `learning-qa-report.md` exists
- learning QA overall status is `PASS`
- mock learning provider exists
- `learning-provider-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/learning-provider-report.md
```

## Status model

- `Provider`: mock-learning
- `Status`: READY
- `Learning`: DISABLED
- `Decision`: DISABLED
- `Network`: DISABLED
- `Report Path`: N/A
- `Ready for real learning provider`: YES

## Rules

- no overwrite
- no API call
- no network access
- no learning
- no recommendation
- no decision
- no modification of `learning-input.md`
- no modification of `learning-qa-report.md`
