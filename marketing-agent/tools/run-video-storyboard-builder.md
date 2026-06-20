# Video Storyboard Builder

## Role

This runner converts a structured `video-script.md` into a first
provider-independent `video-storyboard.md`.

It does not generate any video.

It does not create any media asset.

It does not contact any provider.

## Command

```bash
bash marketing-agent/tools/run-video-storyboard-builder.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `video-script.md`

## Checks

- scenario exists
- campaign item folder exists
- `video-script.md` exists
- video script status is `READY FOR STORYBOARD`
- required script metadata exists
- `video-storyboard.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-storyboard.md
```

## Output structure

The storyboard contains:

- five placeholder scenes
- duration per scene
- visual placeholder
- screen text placeholder
- voice placeholder
- transition
- asset placeholder
- provider
- status

## Rules

- no video generation
- no provider call
- no media creation
- no modification of `video-script.md`
- no overwrite
