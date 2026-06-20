# Campaign Planner Runner

## Role

This tool runs the first deterministic version of the Campaign Planner.

It does not use AI, does not generate content, and does not create a campaign.
It only produces a recommendation report from a simple goal string.

## Usage

```bash
bash marketing-agent/tools/run-campaign-planner.sh \
scenario-003-booking-optimizer \
--goal="launch booking optimizer"
```

## Rule Set

The V1 runner applies simple keyword rules:

- `launch` -> `Feature Launch`
- `tutorial` -> `Tutorial`
- `seo` -> `Evergreen SEO`
- `comparison` -> `Comparison`
- `testimonial` -> `Testimonial`
- `update` -> `Product Update`
- `newsletter` -> `Newsletter`

If no rule matches, the fallback recommendation is:

- `General Awareness`

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-planner-report.md
```

The report includes:

- scenario
- goal
- recommended campaign type
- template
- duration
- number of items
- recommended platforms
- status

## Safety

- no AI
- no OpenAI
- no content generation
- no campaign creation
- no scenario modification
- no overwrite if the report already exists

## Limits

This V1 runner is deterministic and intentionally simple. It does not analyze
performance, seasonality, campaign memory, or editorial collisions yet.
