# Video Status Runner

## Role

This runner aggregates the current Video Agent state for one campaign item.

It does not generate any video.

It does not contact any provider.

It only summarizes artifacts that already exist.

## Command

```bash
bash marketing-agent/tools/run-video-status.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `video-request.md`
- `video-script.md`
- `video-storyboard.md`
- `video-qa-report.md`
- `video-provider-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `video-status.md` does not already exist

## Summary fields

The runner aggregates:

- video request presence
- video script presence
- video storyboard presence
- video QA overall status
- provider name
- provider status
- generation mode
- network mode
- overall readiness

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-status.md
```

## Rules

- no overwrite
- no video generation
- no provider call
- no modification of existing video artifacts
