# Campaign QA Runner

## Role

This tool runs the first structural QA check for a campaign folder.

It does not read campaign content semantically, does not call AI, and does not
publish anything.

## Usage

```bash
bash marketing-agent/tools/run-campaign-qa.sh scenario-003-booking-optimizer
```

## Checks

The V1 runner verifies:

- campaign structure files exist:
  - `campaign.md`
  - `items.md`
  - `calendar.md`
  - `qa.md`
- at least one item exists
- the expected number of items is present
- no duplicate item IDs exist
- the calendar contains the same number of entries as the expected item count
- the campaign QA file keeps:
  - `review requise : YES`
  - `promotion bloquee : YES`

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-qa-report.md
```

The report contains:

- Campaign status
- Items status
- Calendar status
- QA status
- Promotion state
- Review state
- Overall state
- readiness for content generation

## Safety

- no AI
- no OpenAI
- no content generation
- no campaign modification
- no overwrite if the report already exists

## Limits

This V1 runner is purely structural. It does not validate message quality,
campaign sequencing quality, platform balance quality, or business relevance.
