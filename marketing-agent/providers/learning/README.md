# Learning Providers

## Role

This directory contains learning-provider implementations for the Norixo AI
learning pipeline.

## Principles

- one learning provider per isolated subdirectory
- no direct dependency from the Learning Agent
- the Learning Agent prepares learning inputs
- the provider layer executes or simulates learning analysis
- all providers should remain replaceable without changing the Learning Agent

## Current State

The first available learning provider is:

- `mock-learning`

It exists only to validate the provider architecture locally, with:

- no learning
- no recommendation
- no decision
- no external API
- no network access
- no side effects on the marketing content pipeline

## Future Providers

This foundation is designed to host future providers such as:

- Rule-based Learning
- LLM Learning
- Pattern Detection
- Statistical Learning
- Reinforcement Learning
- Hybrid Learning
- other local or hosted providers
