# Analytics Providers

## Role

This directory contains analytics-provider implementations for the Norixo AI
analytics pipeline.

## Principles

- one analytics provider per isolated subdirectory
- no direct dependency from the Analytics Agent
- the Analytics Agent prepares analytics requests
- the provider layer executes or simulates data collection
- all providers should remain replaceable without changing the Analytics Agent

## Current State

The first available analytics provider is:

- `mock-analytics`

It exists only to validate the provider architecture locally, with:

- no data collection
- no external API
- no network access
- no side effects on the marketing content pipeline

## Future Providers

This foundation is designed to host future providers such as:

- Google Analytics
- Google Search Console
- Meta Insights
- LinkedIn Analytics
- X Analytics
- YouTube Analytics
- TikTok Analytics
- Stripe
- PostHog
- Vercel Analytics
- other local or hosted providers
