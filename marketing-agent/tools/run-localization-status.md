# Localization Status Runner

## Role

This tool creates a single structural localization status report for one
scenario.

## Goal

It does not generate any translation.

It only detects:

- which locale profiles exist
- which localized folders exist under `generated/`
- which status should be shown per locale
- which locale should be recommended next according to the preferred locale order

## Usage

```bash
bash marketing-agent/tools/run-localization-status.sh scenario-003-booking-optimizer
```

## Output

The script creates:

```txt
marketing-agent/simulations/<scenario-name>/localization-status.md
```

## Safety Rules

- no translation generation
- no content rewrite
- no official file update
- no overwrite of an existing `localization-status.md`
- no promotion
- no publication

## Current Status Logic

- source locale is inferred from the existing scenario structure
- locale directory exists under `generated/` -> `GENERATED`
- otherwise -> `NOT GENERATED`
- preferred locale order is discovered from `agents/translation-agent.md`
- if the report already exists, the script keeps the file untouched and prints
  the current computed report without overwriting
