# Campaign Item QA Runner

## Role

This tool runs the first structural QA check for one isolated campaign item
workspace.

It does not read content quality, does not call AI, and does not publish
anything.

## Usage

```bash
bash marketing-agent/tools/run-campaign-item-qa.sh \
scenario-003-booking-optimizer \
--item=campaign-item-001
```

## Checks

The V1 runner verifies:

- the campaign item folder exists
- the item identifier format is valid
- `master-content.md` exists
- `facebook.md` exists
- `instagram.md` exists
- `snapchat.md` exists

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-items/<item-id>/qa-report.md
```

The report includes:

- scenario
- item
- structure status per file
- overall status
- readiness for real content generation
- promotion state

## Safety

- no AI
- no OpenAI
- no content generation
- no campaign modification
- no overwrite if `qa-report.md` already exists

## Limits

This V1 runner is structural only. It does not evaluate message quality,
platform fit, or content completeness beyond file presence.
