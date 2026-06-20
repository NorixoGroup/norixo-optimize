# Simulations

## Role

Ce dossier contient les scenarios de simulation de Norixo AI.

Chaque scenario documente ce que le systeme devrait produire dans un cas
marketing concret, sans publication reelle ni appel externe.

## Scenario Structure

Un scenario complet suit la structure definie par le QA Framework et contient
au minimum :

- un contexte
- un rapport Marketing Brain
- un Master Content
- des declinaisons reseaux sociaux
- un prompt image
- un script video
- un storyboard
- un plan de traduction
- un plan de publication
- une checklist QA
- une scorecard locale
- un lessons learned

## Naming Convention

Les scenarios suivent une convention stable :

- `scenario-001-*`
- `scenario-002-*`
- `scenario-003-*`

Le numero sert d'identifiant de reference dans le registre officiel.

## Golden Scenario Principle

Les premiers scenarios valides servent de references qualitatives.

Ils aident a comparer les futures productions, a detecter les regressions et a
maintenir un niveau constant de clarte, de coherence produit et de qualite de
declinaison.

## Link With The QA Framework

Chaque scenario doit provenir du template officiel present dans
`marketing-agent/qa/scenario-template/`.

Le QA Framework fournit :

- la structure attendue
- la checklist qualite
- le cadre de score
- les references de regression

Le registre des scenarios permet ensuite de suivre l'etat reel de chaque
scenario et sa couverture fonctionnelle.
