# Image Status Runner

## Role

This runner aggregates the current Image Agent state for one campaign item.

It does not generate any image.

It does not contact any provider.

It only summarizes artifacts that already exist.

## Command

```bash
bash marketing-agent/tools/run-image-status.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `image-request.md`
- `image-prompt.md`
- `image-qa-report.md`
- `image-provider-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `image-status.md` does not already exist

## Summary fields

The runner aggregates:

- image request presence
- image prompt presence
- image QA overall status
- provider name
- provider status
- generation mode
- network mode
- overall readiness

## Output

The runner creates:

```txt
campaign-items/<item-id>/image-status.md
```

## Rules

- no overwrite
- no image generation
- no provider call
- no modification of existing image artifacts
