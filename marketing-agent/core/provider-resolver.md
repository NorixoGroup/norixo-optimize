# Provider Resolver

## Role

Le Provider Resolver est la couche chargee de resoudre quel provider doit etre
utilise par le LLM Adapter.

## Responsibilities

- lire la configuration fournisseur
- valider que le provider resolu est autorise
- appliquer un fallback securise
- renvoyer une valeur stable au LLM Adapter

## Resolution Logic

En V1, la logique est simple :

- lire la configuration par defaut
- resoudre `mock`
- retourner un statut pret

## Validation

Le resolver doit s'assurer que :

- le provider est connu
- le provider respecte la configuration courante
- aucun provider externe n'est active par erreur

## Fallback

Si une configuration future est absente, invalide ou incertaine, le fallback
doit toujours revenir a :

- `mock`

## Errors

Les erreurs futures pourront couvrir :

- provider inconnu
- configuration absente
- provider desactive
- configuration incoherente

En V1, le resolver ne doit pas echouer tant que la configuration par defaut
reste `mock`.
