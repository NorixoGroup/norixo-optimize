# Review Report Runner

## Role

This tool assembles a single human review report from generated content files.

## Goal

It does not validate or modify content.

It only groups the generated pack into a single review document that can be
used during human editorial validation.

## Usage

```bash
bash marketing-agent/tools/run-review-report.sh scenario-003-booking-optimizer
```

## Required Inputs

- `generated-master-content.md`
- `generated-facebook.md`
- `generated-instagram.md`
- `generated-snapchat.md`

## Output

The script creates:

```txt
marketing-agent/simulations/<scenario-name>/review-report.md
```

## Safety Rules

- never overwrite an existing `review-report.md`
- never modify generated files
- never modify official files
- never promote content
- never publish content

## Current Limits

- no automatic review
- no scoring
- no QA decision
- no approval workflow
