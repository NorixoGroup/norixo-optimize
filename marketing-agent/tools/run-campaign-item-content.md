# Campaign Item Content Generator V1

## Role

This tool creates the first isolated content workspace for one campaign item.

It does not generate marketing copy and does not call AI. It only creates the
working file structure that a future item-level Content Agent flow can fill.

## Usage

```bash
bash marketing-agent/tools/run-campaign-item-content.sh \
scenario-003-booking-optimizer \
--item=campaign-item-001
```

## Input

The runner reads:

```txt
marketing-agent/simulations/<scenario-name>/campaign-content-requests.md
```

It supports two item reference styles:

- the request index alias, for example `campaign-item-001`
- the resolved request ID already present in the requests file

## Output

The runner creates:

```txt
marketing-agent/simulations/<scenario-name>/campaign-items/<item-id>/
```

With four placeholder work files:

- `master-content.md`
- `facebook.md`
- `instagram.md`
- `snapchat.md`

## Safety

- no AI
- no OpenAI
- no content generation
- no translation
- no modification of `generated/`
- no modification of the source scenario files
- no overwrite if the item folder already exists

## Limits

This V1 generator is only a structural placeholder bridge. It does not build
briefs, does not inject scenario context, and does not create real marketing
content yet.
