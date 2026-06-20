# Localization Batch Runner

## Role

This tool orchestrates sequential localization runs for the remaining locales
 of one scenario.

It does not contain translation logic, does not build prompts, and does not
call any provider directly. It only discovers the remaining locales and calls
the existing Translation Agent one locale at a time.

## Usage

Dry run:

```bash
bash marketing-agent/tools/run-localization-batch.sh scenario-003-booking-optimizer --dry-run
```

Execute:

```bash
MARKETING_AGENT_PROVIDER=openai \
bash marketing-agent/tools/run-localization-batch.sh scenario-003-booking-optimizer --execute
```

## Behavior

- discovers the locale profiles dynamically from `marketing-agent/locales/`
- discovers the already generated locale folders dynamically from
  `marketing-agent/simulations/<scenario-name>/generated/`
- considers a locale generated only when its full localized pack is present
- excludes the `fr` source locale
- processes only the remaining locales
- runs one locale at a time
- stops immediately on the first failure

## Safety

- no prompt construction
- no direct OpenAI logic
- no direct LLM Adapter logic
- no modification of existing generated files
- no Quality Gate modification
- no build

## Limits

This V1 runner is a simple sequential orchestrator. It does not retry failed
locales, does not parallelize work, and does not update localization status or
review documents automatically.
