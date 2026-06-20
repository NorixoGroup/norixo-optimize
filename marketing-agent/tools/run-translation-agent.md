# Run Translation Agent

## Role

This tool runs the first real localization pipeline for Norixo AI.

## Current Scope

This patch supports one locale per execution.

Any locale is accepted only if:

```txt
marketing-agent/locales/<locale>/profile.md
```

exists.

## Usage

```bash
MARKETING_AGENT_PROVIDER=openai \
bash marketing-agent/tools/run-translation-agent.sh scenario-003-booking-optimizer --locale=<locale>
```

## How It Works

The script:

- checks the scenario directory
- checks the locale profile
- rejects unknown locales dynamically
- checks the source generated content pack
- requires `MARKETING_AGENT_PROVIDER=openai`
- builds one structured runtime request
- calls `run-llm-adapter.sh`
- extracts four localized blocks
- creates:
  - `generated/<locale>/master-content.md`
  - `generated/<locale>/facebook.md`
  - `generated/<locale>/instagram.md`
  - `generated/<locale>/snapchat.md`

## Safety Rules

- no overwrite of existing localized files
- no modification of source `generated-*` files
- no modification of official scenario files
- no review report modification
- no promotion
- no publication

## Limits

- one locale per execution
- no multilingual batch execution
- no quality scoring
- no review workflow update
