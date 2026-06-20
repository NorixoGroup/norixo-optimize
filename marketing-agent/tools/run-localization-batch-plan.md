# Localization Batch Plan

## Role

This tool prepares a localization generation plan for one scenario without
launching any translation.

It discovers the documented locale profiles, compares them with the already
generated locale folders, excludes the source locale, and builds a simple
ordered action plan for the remaining work.

## Usage

```bash
bash marketing-agent/tools/run-localization-batch-plan.sh scenario-003-booking-optimizer
```

## Output

The script creates a single file:

```txt
marketing-agent/simulations/<scenario-name>/localization-batch-plan.md
```

The report includes:

- the scenario name
- the source locale
- the locales already generated
- the locales still missing
- the recommended order
- ready-to-run translation commands

## Discovery Rules

- locale profiles are discovered dynamically from `marketing-agent/locales/`
- generated locale folders are discovered dynamically from
  `marketing-agent/simulations/<scenario-name>/generated/`
- the source locale remains `fr`
- the preferred locale order follows the documented order in
  `marketing-agent/agents/translation-agent.md`

## Safety Rules

- no AI call
- no OpenAI call
- no translation launch
- no modification of generated content
- no Quality Gate update
- no overwrite if `localization-batch-plan.md` already exists

## Limits

This tool only prepares a batch plan. It does not validate translation
quality, does not generate content, and does not update any localization
status files automatically.
