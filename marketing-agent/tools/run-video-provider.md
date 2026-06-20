# Video Provider Runner

## Role

This runner prepares the first provider-layer execution for the video pipeline.

In this phase it calls only the mock video provider.

It does not generate any video.

It does not contact any API.

It does not access the network.

## Command

```bash
bash marketing-agent/tools/run-video-provider.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `video-storyboard.md`
- `video-qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `video-storyboard.md` exists
- `video-qa-report.md` exists
- video QA overall status is `PASS`
- mock video provider exists
- `video-provider-report.md` does not already exist

## Behavior

The runner:

- calls only `marketing-agent/providers/videos/mock/provider.sh`
- reads the mock provider report
- writes a local `video-provider-report.md`

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-provider-report.md
```

## Rules

- no real provider call
- no video generation
- no network
- no overwrite
- no modification of the storyboard or QA files
