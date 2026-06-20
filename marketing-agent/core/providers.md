# Providers

## Role

Ce document recense les fournisseurs de langage prevus pour Norixo AI.

Ils ne sont pas encore connectes. Cette liste sert a preparer une architecture
stable et interchangeable.

## Provider List

### Mock Provider

- statut : ready for foundation
- avantages : zero dependance externe, zero cout, ideal pour tests locaux
- limites : aucune generation reelle
- cout estime : nul
- cas d'usage : validation du contrat, tests d'integration locale, simulation

### OpenAI

- statut : alpha-ready
- avantages : tres bon niveau generaliste, bon support des workflows
- limites : cout variable, dependance cloud
- cout estime : moyen a eleve selon les volumes
- cas d'usage : redaction, structuration, transformation de briefs, variations
- activation : optionnelle via `MARKETING_AGENT_PROVIDER=openai`
- cle requise : `OPENAI_API_KEY`

### Claude

- statut : planned
- avantages : souvent tres bon pour la redaction nuancee et les longs contextes
- limites : dependance cloud, cout a surveiller
- cout estime : moyen a eleve
- cas d'usage : contenus longs, reformulation, revue qualitative

### Gemini

- statut : planned
- avantages : ecosysteme large, possibilites multimodales
- limites : comportement a evaluer selon les taches
- cout estime : moyen
- cas d'usage : experimentation multimodale, structuration, generation assistee

### Mistral

- statut : planned
- avantages : offre europeenne interessante, flexibilite de deploiement
- limites : qualite a comparer selon les cas d'usage
- cout estime : moyen
- cas d'usage : generation texte, adaptation locale, experimentation

### Ollama

- statut : planned
- avantages : execution locale, controle fort, cout marginal faible hors infra
- limites : qualite et latence dependantes des modeles et de la machine
- cout estime : faible a moyen selon l'infra locale
- cas d'usage : prototypage offline, tests internes, scenarios sensibles

## Selection Principle

Le choix d'un provider doit dependre de :

- la tache
- le cout
- la qualite attendue
- la confidentialite
- la latence acceptable

Le choix du provider ne doit jamais modifier le contrat des agents.
