# Video QA Runner

## Role

This runner performs the first structural quality gate for a prepared video
request, script, and storyboard set.

It does not judge the quality of the script.

It does not judge the quality of the storyboard.

It does not generate any video.

It does not contact any provider.

## Command

```bash
bash marketing-agent/tools/run-video-qa.sh \
  <scenario-name> \
  --item=<item-id>
```

## Inputs

- scenario name
- campaign item identifier
- `video-request.md`
- `video-script.md`
- `video-storyboard.md`

## Checks

- scenario exists
- campaign item folder exists
- request, script, and storyboard files exist
- required request fields exist
- required script fields exist
- storyboard provider and status fields exist
- storyboard contains at least 5 scenes
- `video-qa-report.md` does not already exist

## Output

The runner creates:

```txt
campaign-items/<item-id>/video-qa-report.md
```

## Status model

- `Video Request`: PASS or FAIL
- `Video Script`: PASS or FAIL
- `Storyboard`: PASS or FAIL
- `Required Fields`: PASS or FAIL
- `Scene Count`: PASS or FAIL
- `Provider`: NOT EXECUTED
- `Generation`: BLOCKED
- `Overall`: PASS or FAIL

## Rules

- no overwrite
- no video generation
- no provider call
- no modification of the request, script, or storyboard files
