# Run Draft Generator V1

## Role

This tool prepares structured draft files from an existing editorial brief.

It does not write final marketing content. It creates editable working drafts
that can later be enriched by a future AI engine or by human review.

## How It Works

The script reads:

- `editorial-brief.md`

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
- no automatic copywriting
- no modification of final content files
- no overwrite of existing draft files
- no publishing behavior

## Planned Evolution

Future versions may:

- inject stronger context from richer briefs
- prefill more platform-specific guidance
- hand off directly to a future AI writing layer
