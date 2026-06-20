# Run Translation Agent

## Role

This tool runs the first real localization pipeline for Norixo AI.

## Current Scope

This first patch supports only one locale:

- `en`

## Usage

```bash
MARKETING_AGENT_PROVIDER=openai \
bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=en
```

## How It Works

The script:

- checks the scenario directory
- checks the locale profile
- checks the source generated content pack
- requires `MARKETING_AGENT_PROVIDER=openai`
- builds one structured runtime request
- calls `run-llm-adapter.sh`
- extracts four localized blocks
- creates:
  - `generated/en/master-content.md`
  - `generated/en/facebook.md`
  - `generated/en/instagram.md`
  - `generated/en/snapchat.md`

## Safety Rules

- no overwrite of existing localized files
- no modification of source `generated-*` files
- no modification of official scenario files
- no review report modification
- no promotion
- no publication

## Limits

- only `--locale=en` is supported in this patch
- no multilingual batch execution
- no quality scoring
- no review workflow update
