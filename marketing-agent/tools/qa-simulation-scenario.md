# QA Simulation Scenario

## Objective

This tool checks whether a simulation scenario is structurally complete.

It verifies the presence of all mandatory files expected by the Norixo AI
scenario format.

## Usage

```bash
bash marketing-agent/tools/qa-simulation-scenario.sh scenario-002-airbnb-title
```

## Example

```bash
bash marketing-agent/tools/qa-simulation-scenario.sh scenario-002-airbnb-title
```

## What It Checks

- scenario folder exists
- scenario name is valid
- all required files are present

## What It Does Not Check

- editorial quality
- product accuracy
- branding quality
- translation quality
- CTA quality

Those points remain part of the human QA process.

## Safety Rules

- no file modification
- no internet access
- no API calls
- no publication behavior
- no automatic registry update

## Completeness vs Quality

This tool checks completeness only.

A scenario can be structurally complete and still require human review before
it is considered high quality.
