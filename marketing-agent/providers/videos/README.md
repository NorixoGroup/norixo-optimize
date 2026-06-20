# Video Providers

## Role

This directory contains video-provider implementations for the Norixo AI video
pipeline.

## Principles

- one video provider per isolated subdirectory
- no direct dependency from the Video Agent
- the Video Agent prepares requests, scripts, and storyboards
- the provider layer executes or simulates video generation
- all providers should remain replaceable without changing the Video Agent

## Current State

The first available video provider is:

- `mock-video`

It exists only to validate the provider architecture locally, with:

- no video generation
- no external API
- no network access
- no side effects on the marketing content pipeline

## Future Providers

This foundation is designed to host future providers such as:

- OpenAI Video
- Google Veo
- Runway
- Pika
- Kling
- InVideo
- CapCut
- other local or hosted providers
