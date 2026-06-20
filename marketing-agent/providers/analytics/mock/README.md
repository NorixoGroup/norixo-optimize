# Mock Analytics Provider

## Role

This provider simulates the future analytics-provider execution layer.

It does not collect any data.

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
- collection mode
- network mode
- report path placeholder
