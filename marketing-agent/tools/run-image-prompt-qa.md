# Image Prompt QA Runner

## Role

This runner performs the first structural quality gate for an image prompt
prepared by the Image Agent flow.

It does not evaluate artistic quality.

It does not generate any image.

It does not contact any provider.

## Command

```bash
bash marketing-agent/tools/run-image-prompt-qa.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `image-request.md`
- `image-prompt.md`

## Checks

- scenario exists
- campaign item folder exists
- `image-request.md` exists
- `image-prompt.md` exists
- request required fields exist
- prompt required fields exist
- `image-qa-report.md` does not already exist

## Required fields

### Image request

- Image Type
- Platform
- Ratio
- Resolution
- Language
- Brand
- Status

### Image prompt

- Image Type
- Platform
- Visual Direction
- Main Scene
- Composition
- Style
- Negative Prompt
- Provider
- Status

## Output

The runner creates:

```txt
campaign-items/<item-id>/image-qa-report.md
```

## Status model

- `Image Request`: PASS or FAIL
- `Image Prompt`: PASS or FAIL
- `Required Fields`: PASS or FAIL
- `Provider`: NOT EXECUTED
- `Generation`: BLOCKED
- `Overall`: PASS or FAIL

## Rules

- no overwrite
- no image generation
- no provider call
- no file modification outside the report creation
