# Run Simulation Pipeline

## Objective

This tool chains the local Marketing Brain, scenario creation, and structural
QA steps into one safe simulation workflow.

It does not generate content, publish anything, or call any external service.

## Usage

```bash
bash marketing-agent/tools/run-simulation-pipeline.sh scenario-003-booking-optimizer
```

## Example Flow

1. run the Marketing Brain
2. create the scenario if it does not exist
3. skip creation if it already exists
4. run the scenario completeness QA
5. print a final human-readable report

## Example Outcome

- Marketing Brain executed
- scenario created or already present
- QA complete or incomplete
- next human action suggested

## Limits

- no AI generation
- no editorial scoring
- no registry update
- no publication
- no automatic completion of missing scenario files

## Safety Rules

- validate scenario name
- never overwrite an existing scenario
- never modify files outside `marketing-agent/`
- never call the network
