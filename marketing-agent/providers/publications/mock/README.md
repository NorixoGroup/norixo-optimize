# Mock Publication Provider

## Role

This provider simulates the future publication-provider execution layer.

It does not publish any content.

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
- publication mode
- network mode
- publication ID placeholder
- publication URL placeholder
