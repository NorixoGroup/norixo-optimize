# Runtime Contract

## Role

Le Runtime Contract definit la forme executable stable des echanges entre :

- les agents Norixo AI
- le LLM Adapter
- le Provider Resolver
- les futurs providers

## Full Request Cycle

Le cycle cible est le suivant :

1. un agent prepare une demande
2. la demande est encodee selon `runtime-request.md`
3. le LLM Adapter recoit cette structure
4. le Provider Resolver choisit un provider compatible
5. le provider traite la demande
6. la reponse est normalisee selon `runtime-response.md`
7. l'adapter renvoie une sortie stable a l'agent appelant

## Responsibilities

### Agent

- produire le contexte utile
- definir le role attendu
- transmettre un brief et des contraintes claires

### LLM Adapter

- faire respecter le contrat runtime
- appeler le resolver
- mapper si necessaire entre contrat commun et format fournisseur
- renvoyer une reponse normalisee

### Provider Resolver

- selectionner un provider autorise
- appliquer les regles de fallback
- proteger la configuration par defaut

### Provider

- accepter une demande mappable depuis le contrat runtime
- retourner une sortie mappable vers le contrat runtime

## Invariants

- le contrat runtime doit rester identique quel que soit le provider
- les agents ne doivent jamais dependre du format natif d'un provider
- le resolver ne doit pas contenir la logique marketing
- le provider ne doit pas redefinir le role fonctionnel de l'agent
- le fallback securise doit toujours etre possible

## Compatibility Rules

Les providers suivants devront respecter exactement cette structure :

- Mock
- OpenAI
- Claude
- Gemini
- Ollama

Les futurs providers additionnels devront eux aussi s'y conformer avant d'etre
integres.

## Versioning Principle

Le contrat runtime devra evoluer par versions explicites et compatibles autant
que possible.

L'objectif est d'eviter qu'un changement provider casse :

- les scripts
- les agents
- les scenarios
- les futures integrations

## Current Scope

Dans l'etat actuel :

- le contrat runtime est defini
- aucun provider reel n'est branche
- aucune cle API n'est utilisee
- aucun acces reseau n'est active

Cette couche prepare simplement une integration future stable et interchangeable.
