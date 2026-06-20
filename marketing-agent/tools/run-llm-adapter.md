# Run LLM Adapter V0

## Role

This tool demonstrates the local foundation of the Norixo AI LLM Adapter.

It does not contact any external model provider.

## How It Works

The script selects the Mock Provider and prints a normalized readiness report.

## Usage

```bash
bash marketing-agent/tools/run-llm-adapter.sh
```

## Expected Output

The output confirms:

- Mock Provider selected
- API disabled
- network disabled
- no external request executed

## Limits

- no real model call
- no API key
- no prompt execution
- no scenario modification

## Planned Evolution

Future versions may:

- accept structured input
- return a normalized mock payload
- test provider selection logic
- simulate contract validation before real integrations
