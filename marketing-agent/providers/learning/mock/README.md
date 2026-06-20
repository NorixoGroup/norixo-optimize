# Mock Learning Provider

## Role

This provider simulates the future learning-provider execution layer.

It does not generate any signal.

It does not produce any recommendation.

It does not take any decision.

It does not contact any API.

It does not access the network.

## Purpose

The mock provider exists only to validate:

- provider invocation
- provider isolation
- provider reporting
- future orchestration compatibility

## Output

The provider returns a local mock report with:

- provider name
- status
- learning mode
- decision mode
- network mode
- report path placeholder
