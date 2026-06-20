# Run Content Agent V2

## Role

This tool prepares a structured editorial brief for a simulation scenario.

It can also optionally generate a first non-official marketing content pack via
the LLM Adapter and the optional OpenAI provider.

## How It Works

The script reads:

- `scenario.md`
- `marketing-brain-report.md`

Then it creates `editorial-brief.md` if the file does not already exist.

With `--generate`, the script:

- requires `MARKETING_AGENT_PROVIDER=openai`
- reads the existing `editorial-brief.md`
- sends one structured generation request through `run-llm-adapter.sh`
- extracts four local blocks
- creates:
  - `generated-master-content.md`
  - `generated-facebook.md`
  - `generated-instagram.md`
  - `generated-snapchat.md`

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

The generated content pack stays non-official and is written only into
`generated-*` files.

## Limits

- no overwrite of an existing editorial brief
- no overwrite of any existing `generated-*` file
- no update of official files such as `master-content.md`, `facebook.md`,
  `instagram.md`, or `snapchat.md`
- no publication
- no promotion

## Planned Evolution

Future versions may refine the single structured OpenAI call, add richer
content extraction rules, and later support a hybrid generation strategy if
needed.
