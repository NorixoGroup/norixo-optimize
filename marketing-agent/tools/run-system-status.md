# Run System Status

## Role

`run-system-status.sh` aggregates the full structural readiness of one Norixo
AI campaign item without launching any agent or provider.

## Inputs

- scenario name
- campaign item identifier
- existing status files produced by the campaign item QA, image, video,
  publication, analytics, and learning layers

## Checks

The runner verifies and aggregates:

- `qa-report.md`
- `image-status.md`
- `video-status.md`
- `publication-status.md`
- `analytics-status.md`
- `learning-status.md`

It then extracts:

- each engine overall status
- each mock provider name
- current execution flags such as generation, publication, collection, and
  decision states

## Output

The runner writes:

- `system-status.md`

The report summarizes the complete V1 system state for one campaign item and
indicates whether the stack is ready for real provider integrations.

## Safety

- no agent execution
- no provider execution
- no content generation
- no publication
- no analytics collection
- no learning decision
- no overwrite if `system-status.md` already exists
