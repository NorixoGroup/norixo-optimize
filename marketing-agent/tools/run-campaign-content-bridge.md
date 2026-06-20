# Campaign Content Bridge

## Role

This tool creates the first bridge between a campaign structure and the future
Content Agent workflow.

It does not generate content and does not call AI. It only converts campaign
items into standalone content requests.

## Usage

```bash
bash marketing-agent/tools/run-campaign-content-bridge.sh \
scenario-003-booking-optimizer
```

## Input

The bridge reads:

```txt
marketing-agent/simulations/<scenario-name>/campaign/items.md
```

It detects each campaign item and extracts:

- item title
- item id
- item goal

## Output

The bridge creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-content-requests.md
```

Each campaign item becomes one independent request marked:

- `READY FOR CONTENT AGENT`

## Safety

- no AI
- no OpenAI
- no content generation
- no campaign modification
- no overwrite if the report already exists

## Limits

This V1 bridge is structural only. It does not enrich the request with source
context, CTA data, dependencies, or localization instructions yet.
