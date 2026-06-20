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
- with `OPENAI_API_KEY`: the provider performs a minimal real OpenAI connectivity check
- the test prompt is fixed and does not generate marketing content
- runtime output is always normalized through the shared runtime response contract

## Runtime Test

The provider sends a minimal prompt to OpenAI and expects a small JSON answer.

Default model:

```bash
gpt-5.4-mini
```

Optional override:

```bash
OPENAI_MODEL=...
```

## Failure Handling

- missing key: controlled runtime error, no network call
- network timeout: controlled runtime error
- API error: controlled runtime error
- mock mode remains the default when no provider override is set
