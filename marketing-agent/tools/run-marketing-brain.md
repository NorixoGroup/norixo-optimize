# Run Marketing Brain

## Objective

This tool runs the V0 decision engine for Norixo AI.

It does not generate content. It only recommends the next scenario to create.

## How It Works

The script reads:

- the scenario registry
- the existing simulation folders
- the declared scenario families

Then it applies simple documented rules to recommend one next scenario.

## Usage

```bash
bash marketing-agent/tools/run-marketing-brain.sh
```

## Example Output

```text
============================

MARKETING BRAIN REPORT

============================

Topics analyses :

✓ nouvelles fonctionnalites
✓ guides
✓ villes
✓ scenarios existants

Sujet recommande :

Scenario 003
Booking Optimizer

Raison :

La famille Booking n'est couverte que partiellement aujourd'hui.

Priorite :

HIGH

Confiance :

92 %

Action recommandee :

Creer scenario-003-booking-optimizer
```

## Limits

- no AI
- no external calls
- no automatic scenario creation
- no automatic registry update

This is a deterministic recommendation helper, not an autonomous planner.
