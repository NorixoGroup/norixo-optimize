# Mock Video Provider

## Role

This provider simulates the future video-provider execution layer.

It does not generate any video.

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
- generation mode
- network mode
- video path placeholder
- preview path placeholder
