# Runtime Response

## Role

Ce document definit la structure de sortie runtime commune pour tous les
providers LLM de Norixo AI.

## Common Structure

Chaque reponse runtime doit exposer les champs suivants :

- requestId
- provider
- status
- output
- confidence
- warnings
- errors
- usage
- latency
- timestamp

## Field Definitions

### requestId

Identifiant de la requete source.

Il doit permettre de faire le lien exact avec l'entree runtime.

### provider

Nom du provider qui a effectivement traite la demande.

### status

Etat global de la reponse.

Valeurs possibles recommandees :

- success
- partial
- failed
- mocked

### output

Contenu principal retourne par le provider.

Ce champ peut contenir :

- du texte
- une structure markdown
- une structure JSON
- des sections nommees

### confidence

Indicateur de confiance normalise.

Il peut etre numerique, qualitatif ou derive du provider, mais il doit rester
comparable a travers les integrations.

### warnings

Liste des alertes non bloquantes.

Exemples :

- output truncated
- low confidence
- fallback provider used

### errors

Liste des erreurs bloquantes ou semi-bloquantes.

Liste vide si la reponse est valide.

### usage

Bloc de suivi de consommation.

Exemples futurs :

- input tokens
- output tokens
- estimated cost
- provider counters

### latency

Mesure logique du temps de traitement.

Elle peut etre absente en mode mock, mais le champ doit exister dans la
structure cible.

### timestamp

Marqueur temporel logique de generation de la reponse.

## Invariant

Tous les providers devront renvoyer cette structure de sortie, meme si leur
format natif differe fortement.
