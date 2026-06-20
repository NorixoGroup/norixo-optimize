# Publication Request Runner

## Role

This runner creates the first provider-independent publication request for a
validated campaign item.

It does not publish anything.

It does not contact any API.

It does not trigger any provider.

## Command

```bash
bash marketing-agent/tools/run-publication-request.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `qa-report.md`
- `image-status.md`
- `video-status.md`

## Checks

- scenario exists
- campaign item folder exists
- `qa-report.md` exists and is `PASS`
- `image-status.md` exists and is `PASS`
- `video-status.md` exists and is `PASS`
- `publication-request.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/publication-request.md
```

## Output structure

The request contains:

- platform
- locale
- content readiness
- image readiness
- video readiness
- publication type
- schedule
- hashtags
- metadata
- provider
- status

## Rules

- no publication
- no API call
- no provider call
- no modification of existing files
- no overwrite
