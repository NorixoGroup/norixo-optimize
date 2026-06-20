# Quality Gate Runner

## Role

This tool runs the first structural quality gate for a simulation scenario.

## Goal

It does not evaluate the text itself.

It only verifies whether the minimum structural files required for a future
human review are present.

## Usage

```bash
bash marketing-agent/tools/run-quality-gate.sh scenario-003-booking-optimizer
```

## Current Checks

- `openai-draft-test.md`
- `editorial-brief.md`
- official scenario files
- `generated-master-content.md`
- `generated-facebook.md`
- `generated-instagram.md`
- `generated-snapchat.md`
- `generated/en/master-content.md`
- `generated/en/facebook.md`
- `generated/en/instagram.md`
- `generated/en/snapchat.md`

## Output

The script prints a structural compliance report with:

- draft presence
- editorial brief presence
- official files presence
- source generated content presence
- source generated file-by-file presence
- english localization file-by-file presence
- english localization structural status
- overall structural status
- content review status
- promotion status

## Current Limits

- no text analysis
- no AI call
- no score
- no automatic approval
- no automatic promotion
