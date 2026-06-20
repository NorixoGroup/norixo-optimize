# Campaign Status Report

## Role

This tool creates a single structural status report for one campaign-ready
scenario.

It does not modify the campaign, does not generate content, and does not call
AI.

## Usage

```bash
bash marketing-agent/tools/run-campaign-status.sh scenario-003-booking-optimizer
```

## Checks

The runner summarizes:

- Campaign Planner report presence
- campaign folder presence
- `campaign.md`
- `items.md`
- `calendar.md`
- `qa.md`
- Campaign QA report presence
- Campaign QA overall status
- readiness for the next phase
- promotion state

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-status.md
```

## Safety

- no AI
- no OpenAI
- no content generation
- no campaign modification
- no overwrite if the report already exists

## Limits

This V1 status report is structural only. It does not evaluate campaign
quality, business value, or editorial readiness in depth.
