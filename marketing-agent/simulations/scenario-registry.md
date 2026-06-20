# Scenario Registry

## Role

Ce registre est la source de verite des scenarios de simulation Norixo AI.

Il centralise :

- les scenarios existants
- leur statut
- leur couverture fonctionnelle
- leur maturite QA
- leur etat de validation

## Scenario Tracking Table

| ID | Nom | Famille | Statut | QA | Regression | Priorite | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Booking Description | Feature Launch | Done | Partial | Candidate | High | Scenario historique, utile comme reference, mais sans scorecard locale ni lessons learned |
| 002 | Airbnb Title Optimizer | Feature Launch | Done | 90/100 | Candidate | High | Scenario complet avec checklist, scorecard et lessons learned locaux |
| 003 | Booking Optimizer | Listing Optimization | Planned | Pending | No | High | Extension logique du coverage OTA |
| 004 | Guide SEO | Educational Content | Planned | Pending | No | Medium | Doit couvrir la transformation d'un guide en contenu marketing |
| 005 | City Landing | Local Marketing | Planned | Pending | No | Medium | Doit couvrir les pages villes et les angles locaux |
| 006 | Case Study | Social Proof | Planned | Pending | No | Medium | Scenario centre sur la preuve, les resultats et la credibilite |
| 007 | Product Release | Release Communication | Planned | Pending | No | High | Scenario pour annonces produit plus larges que les micro-features |
| 008 | Revenue Tips | Educational Content | Planned | Pending | No | Medium | Scenario pedagogique oriente optimisation revenu |
| 009 | OTA Comparison | Comparative Education | Planned | Pending | No | Low | Scenario pour comparer Airbnb, Booking et autres plateformes |
| 010 | Customer Success | Testimonial | Planned | Pending | No | Medium | Scenario centre sur l'adoption, les usages et la reussite client |

## Functional Coverage

- ✅ Nouvelle fonctionnalite
- ✅ Optimisation Airbnb
- ⏳ Optimisation Booking
- ⏳ Guides
- ⏳ Pages villes
- ⏳ Temoignages
- ⏳ Releases
- ⏳ Etudes de cas

## Status Legend

- `Done` : scenario complete et documente
- `In Progress` : scenario ouvert mais non finalise
- `Planned` : scenario identifie mais non produit

## QA Interpretation

- `Partial` : scenario utile mais incomplet vis-a-vis du standard QA actuel
- `Pending` : scenario non encore evalue
- `score/100` : scenario evalue avec sa scorecard locale

## Rules

Tout nouveau scenario doit :

- provenir du template officiel
- passer la QA
- avoir une scorecard locale
- avoir un lessons learned
- etre enregistre dans ce registre

## Maintenance Notes

Le registre doit etre mis a jour a chaque creation, completion ou archivage
d'un scenario.

Il sert aussi de point d'entree pour les futures suites de regression.
