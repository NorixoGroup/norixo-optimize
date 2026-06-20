# Localization Review Summary

## Role

This tool creates a compact human-facing summary of the localization state for
one scenario.

It does not copy the localized content itself. It only summarizes the
structural status of the source and every generated locale.

## Usage

```bash
bash marketing-agent/tools/run-localization-review-summary.sh scenario-003-booking-optimizer
```

## Behavior

- detects the scenario folder
- runs the existing Quality Gate
- extracts the structural localization status for every generated locale
- summarizes the source status
- writes one report file:

```txt
marketing-agent/simulations/<scenario-name>/localization-review-summary.md
```

## Output

The report contains:

- the scenario name
- source locale status
- one compact status row per generated locale
- a global summary of generated locales, PASS, FAIL, and pending review
- the current promotion status
- the next high-level phase

## Safety

- no AI call
- no translation
- no generation
- no content copy
- no overwrite if the summary file already exists

## Limits

This tool is only a structural summary. It does not evaluate wording, tone,
cultural adaptation quality, or readiness for publication.
