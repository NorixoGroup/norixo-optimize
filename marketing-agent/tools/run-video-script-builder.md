# Video Script Builder

## Role

This runner converts a validated `video-request.md` file into a first
provider-independent `video-script.md`.

It does not generate any real marketing copy.

It does not contact any AI model.

It does not contact any video provider.

It does not create any storyboard.

## Command

```bash
bash marketing-agent/tools/run-video-script-builder.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `video-request.md`

## Checks

- scenario exists
- campaign item folder exists
- `video-request.md` exists
- video request status is `READY`
- required video request fields are present
- `video-script.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-script.md
```

## Output structure

The script contains:

- hook
- problem
- solution
- demonstration
- benefits
- call to action
- voice
- language
- subtitles
- estimated duration
- provider
- status

## Rules

- no AI call
- no provider call
- no storyboard creation
- no modification of `video-request.md`
- no overwrite
