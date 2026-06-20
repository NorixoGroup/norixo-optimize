# Image Prompt Builder

## Role

This runner converts a validated `image-request.md` file into a first
provider-independent `image-prompt.md`.

It does not generate any image.

It does not call any API.

It does not contact any image provider.

## Command

```bash
bash marketing-agent/tools/run-image-prompt-builder.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `image-request.md`

## Checks

- scenario exists
- campaign item folder exists
- `image-request.md` exists
- image request status is `READY`
- required image request fields are present
- `image-prompt.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/image-prompt.md
```

## Output structure

The generated prompt contains:

- scenario
- campaign item
- image type
- platform
- ratio
- resolution
- language
- brand
- visual goal
- visual direction
- main scene
- composition
- overlay text
- style
- negative prompt
- provider
- status

## Rules

- no image generation
- no provider dependency
- no overwrite
- no modification of `image-request.md`
