# OpenAI Provider

## Role

This provider prepares the OpenAI integration path for Norixo AI.

It is optional and does not replace the default `mock` behavior unless the
provider is explicitly selected.

## Activation

Set:

```bash
MARKETING_AGENT_PROVIDER=openai
```

## API Key

The OpenAI API key must be read only inside:

```txt
marketing-agent/providers/openai/provider.sh
```

Expected variable:

```bash
OPENAI_API_KEY
```

## Safety Rules

- no provider selection outside the resolver
- no key lookup inside agents
- no impact on mock mode
- fallback remains `mock` unless explicitly configured

## Current Behavior

- without `OPENAI_API_KEY`: controlled error response
- with `OPENAI_API_KEY`: provider path considered configured
- no verification step in this phase performs a live network call
