# Providers

## Role

This directory contains executable provider implementations for the Norixo AI
runtime layer.

## Principles

- one provider per isolated subdirectory
- no direct dependency from agents
- all providers must be called through the LLM Adapter
- all providers must respect the runtime request and runtime response contracts

## Current State

The first wired provider is:

- `mock`
- `openai` (optional alpha mode)

It exists only to validate the runtime flow locally, with:

- no network
- no external API
- no API keys
- no content generation side effects

## Optional Providers

The first optional real-provider integration path is:

- `openai`

It must remain:

- opt-in only
- reversible
- non-breaking for `mock`
