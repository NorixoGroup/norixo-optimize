# Image Providers

## Role

This directory contains image-provider implementations for the Norixo AI image
pipeline.

## Principles

- one image provider per isolated subdirectory
- no direct dependency from the Image Agent
- the Image Agent prepares prompts and requests
- the provider layer executes or simulates image generation
- all providers should remain replaceable without changing the Image Agent

## Current State

The first available image provider is:

- `mock-image`

It exists only to validate the provider architecture locally, with:

- no image generation
- no external API
- no network access
- no side effects on the marketing content pipeline

## Future Providers

This foundation is designed to host future providers such as:

- OpenAI Images
- Flux
- Ideogram
- Midjourney
- Stable Diffusion
- other local or hosted providers
