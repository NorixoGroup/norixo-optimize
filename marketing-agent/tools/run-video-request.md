# Video Request Runner

## Role

This runner creates the first provider-independent video request for a validated
campaign item.

It does not generate any video.

It does not create a script.

It does not create a storyboard.

It does not contact any provider.

## Command

```bash
bash marketing-agent/tools/run-video-request.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `qa-report.md`

## Checks

- scenario exists
- campaign item folder exists
- `qa-report.md` exists
- campaign item QA overall status is `PASS`
- `video-request.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-request.md
```

## Output structure

The request contains:

- video type
- platform
- ratio
- duration
- language
- voice
- subtitles
- brand
- visual style
- video goal
- source
- status
- provider

## Rules

- no video generation
- no provider call
- no script creation
- no storyboard creation
- no overwrite
