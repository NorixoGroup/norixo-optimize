# Run Content Agent V1

## Role

This tool prepares a structured editorial brief for a simulation scenario.

It is the first operational step of the Content Agent, but it does not write
the final article or social posts.

## How It Works

The script reads:

- `scenario.md`
- `marketing-brain-report.md`

Then it creates `editorial-brief.md` if the file does not already exist.

## Output

The generated brief follows a normalized structure:

- Sujet
- Objectif
- Audience
- Message principal
- Benefices cles
- Objections possibles
- CTA recommande
- Formats recommandes
- Reseaux recommandes
- Points a ne pas oublier

## Limits

- no LLM
- no automatic article generation
- no social post generation
- no update of `master-content.md`
- no overwrite of an existing editorial brief

## Planned Evolution

Future versions may enrich the brief with:

- stronger extraction from completed scenarios
- structured decision inputs from the Marketing Brain
- optional handoff to a future LLM-based drafting step
