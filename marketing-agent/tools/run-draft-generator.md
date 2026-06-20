# Run Draft Generator V1

## Role

This tool prepares structured draft files from an existing editorial brief.

It does not write final marketing content. It creates editable working drafts
that can later be enriched by a future AI engine or by human review.

## How It Works

The script reads:

- `editorial-brief.md`

Then it runs the local Mock LLM Adapter to validate the future execution path:

- Editorial Brief
- LLM Adapter
- Draft Generator
- Draft files

Then it creates, only if missing:

- `draft-master-content.md`
- `draft-facebook.md`
- `draft-instagram.md`
- `draft-snapchat.md`

## Output Philosophy

The generated files are working drafts.

They provide a normalized structure so that future content generation can start
from a consistent base rather than from an empty file.

## Limits

- no LLM
- no external provider call
- no automatic copywriting
- no modification of final content files
- no overwrite of existing draft files
- no publishing behavior

## Current Mock Behavior

The LLM Adapter remains local and deterministic.

It only confirms:

- Mock Provider selected
- API disabled
- network disabled
- no external request executed

## Planned Evolution

Future versions may:

- inject stronger context from richer briefs
- prefill more platform-specific guidance
- hand off directly to a future AI writing layer
