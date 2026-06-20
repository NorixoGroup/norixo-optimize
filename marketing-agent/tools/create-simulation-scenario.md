# Create Simulation Scenario

## Objective

Prepare a new simulation scenario folder from the official QA scenario template.

The tool does not generate marketing content automatically. It only creates a
clean structure ready to be completed and reviewed.

## Usage

```bash
bash marketing-agent/tools/create-simulation-scenario.sh scenario-002-airbnb-title
```

## Example

Input:

```bash
bash marketing-agent/tools/create-simulation-scenario.sh scenario-002-airbnb-title
```

Output:

- a new folder inside `marketing-agent/simulations/`
- all template files copied from `marketing-agent/qa/scenario-template/`
- a clear list of created files

## Safety Rules

- requires a scenario name
- refuses unsafe names
- refuses to overwrite an existing scenario
- never edits an existing file
- never calls the network
- never publishes anything

## Limits

- does not generate content
- does not validate quality
- does not update memory automatically
- does not commit anything

