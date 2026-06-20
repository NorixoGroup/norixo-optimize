# Image Provider Runner

## Role

This runner prepares the first provider-layer execution for the image pipeline.

In this phase it calls only the mock image provider.

It does not generate any image.

It does not contact any API.

It does not access the network.

## Command

```bash
bash marketing-agent/tools/run-image-provider.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `image-prompt.md`
- `image-qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `image-prompt.md` exists
- `image-qa-report.md` exists
- image QA overall status is `PASS`
- mock image provider exists
- `image-provider-report.md` does not already exist

## Behavior

The runner:

- calls only `marketing-agent/providers/images/mock/provider.sh`
- reads the mock provider report
- writes a local `image-provider-report.md`

## Output

The runner creates:

```txt
campaign-items/<item-id>/image-provider-report.md
```

## Rules

- no real provider call
- no image generation
- no network
- no overwrite
- no modification of the prompt or QA files
