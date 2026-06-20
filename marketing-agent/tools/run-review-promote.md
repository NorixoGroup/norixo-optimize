# Editorial Review Promote

## Role

This tool is the first human validation checkpoint between an OpenAI-generated
draft and any future official scenario content.

## Goal

It does not promote content automatically.

It only verifies whether a scenario has:

- an `openai-draft-test.md` file
- existing official content files that would block overwriting

## Usage

```bash
bash marketing-agent/tools/run-review-promote.sh scenario-003-booking-optimizer
```

## Current Behavior

- checks that the scenario exists
- checks that `openai-draft-test.md` exists
- checks whether official target files already exist
- prints a clear review report
- never copies files
- never overwrites existing content

## Why Promotion Is Blocked

In this first version, promotion is always blocked because:

- human editorial validation is still required
- official files must never be overwritten automatically
- OpenAI output remains a draft until a reviewer approves it

## Future Evolution

This workflow can later evolve toward:

- interactive human validation
- automated QA checks
- promotion preparation
- publication workflows after explicit approval
