# Publication Providers

## Role

This directory contains publication-provider implementations for the Norixo AI
publisher pipeline.

## Principles

- one publication provider per isolated subdirectory
- no direct dependency from the Publisher Agent
- the Publisher Agent prepares publication requests
- the provider layer executes or simulates publication
- all providers should remain replaceable without changing the Publisher Agent

## Current State

The first available publication provider is:

- `mock-publication`

It exists only to validate the provider architecture locally, with:

- no real publication
- no external API
- no network access
- no side effects on the marketing content pipeline

## Future Providers

This foundation is designed to host future providers such as:

- Facebook Graph API
- Instagram Graph API
- LinkedIn API
- X API
- Threads API
- TikTok API
- YouTube API
- WordPress API
- Buffer
- Hootsuite
- Zapier
- other local or hosted providers
