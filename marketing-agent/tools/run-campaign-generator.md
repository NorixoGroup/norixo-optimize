# Campaign Generator V1

## Role

This tool creates the first structural `campaign/` folder from an existing
Campaign Planner report.

It does not generate marketing content, does not call AI, and does not publish
anything.

## Usage

```bash
bash marketing-agent/tools/run-campaign-generator.sh scenario-003-booking-optimizer
```

## Inputs

The generator requires:

- an existing scenario folder
- an existing `campaign-planner-report.md`

It reads the following planner fields:

- recommended campaign type
- template
- duration
- items
- platforms

## Output

If `campaign/` does not already exist, the generator creates:

```txt
campaign/README.md
campaign/campaign.md
campaign/items.md
campaign/calendar.md
campaign/qa.md
```

## Safety

- no AI
- no OpenAI
- no content generation
- no translation
- no publication
- no overwrite if `campaign/` already exists

## Current Expected Behavior

For `scenario-003-booking-optimizer`, the folder already exists, so the
expected result is:

```txt
Campaign already exists.
Generation blocked.
```

## Limits

This V1 generator creates only a structural campaign draft. It does not fill
business-ready objectives, angles, formats, or schedules beyond a deterministic
template skeleton.
