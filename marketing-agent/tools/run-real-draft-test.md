# Real Draft Test

## Role

This tool runs a first real OpenAI-backed draft generation test for a single
simulation scenario.

It does not modify any existing draft or final content file.

## Usage

```bash
MARKETING_AGENT_PROVIDER=openai \
OPENAI_API_KEY=... \
bash marketing-agent/tools/run-real-draft-test.sh scenario-003-booking-optimizer
```

## Expected Input

- an existing simulation scenario
- an existing `editorial-brief.md`
- `MARKETING_AGENT_PROVIDER=openai`
- a valid `OPENAI_API_KEY`

## Output

The script creates only one separate file:

```txt
marketing-agent/simulations/<scenario-name>/openai-draft-test.md
```

## Safety Rules

- never overwrite `openai-draft-test.md`
- never modify existing draft or final scenario files
- never fall back silently to `mock`
- always go through `run-llm-adapter.sh`

## Limits

- this is a manual runtime validation tool
- it depends on the optional OpenAI provider
- it is not part of the regular Draft Generator flow
