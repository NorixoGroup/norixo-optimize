# Run Provider Resolver V1

## Role

This tool demonstrates the local provider resolution layer for Norixo AI.

It does not call any external service.

## How It Works

The script resolves the configured provider from the local foundation and
returns the current secure default.

## Usage

```bash
bash marketing-agent/tools/run-provider-resolver.sh
```

## Expected Output

The output confirms:

- configured provider is `mock`
- resolver status is ready
- external API is disabled
- network is disabled

## Limits

- no runtime provider switching
- no external configuration source
- no API call
- no secret usage

## Planned Evolution

Future versions may:

- support explicit provider selection
- validate provider availability
- resolve by task type
- apply fallback policies dynamically
