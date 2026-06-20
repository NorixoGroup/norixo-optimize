# Image Prompt Request V1

## Role

This tool creates the first provider-independent image request for one validated
campaign item.

It does not generate images, does not call any API, and does not contact any
provider.

## Usage

```bash
bash marketing-agent/tools/run-image-prompt-request.sh \
scenario-003-booking-optimizer \
--item=campaign-item-001
```

## Preconditions

The runner requires:

- the scenario folder
- the isolated campaign item folder
- an existing `qa-report.md`
- a `PASS` overall item QA status

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-items/<item-id>/image-request.md
```

The request includes:

- scenario
- campaign item
- request status
- image type
- platform
- ratio
- resolution
- language
- overlay flag
- brand
- visual goal
- placeholder image prompt
- placeholder negative prompt
- provider placeholder

## Safety

- no AI
- no OpenAI
- no provider call
- no image generation
- no overwrite if `image-request.md` already exists

## Limits

This V1 request is deterministic and structural. It does not analyze the item
copy or infer real visual direction yet.
