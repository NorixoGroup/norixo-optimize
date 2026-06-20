# Publication Provider Contract

## Role

Ce contrat definit l'entree et la sortie communes de la couche provider
publication.

Il doit rester independent du provider concret.

## Input

Chaque execution provider publication doit pouvoir recevoir une structure
equivalente aux champs suivants :

- `requestId`
- `scenario`
- `campaignItem`
- `publicationRequestPath`
- `provider`
- `platform`
- `locale`
- `metadata`

## Input Field Notes

### requestId

Identifiant unique de la demande provider publication.

### scenario

Nom du scenario parent.

### campaignItem

Identifiant du Campaign Item source.

### publicationRequestPath

Chemin vers la demande de publication deja preparee.

### provider

Provider cible demande ou resolu.

### platform

Plateforme cible de diffusion.

### locale

Locale associee au contenu de la publication.

### metadata

Bloc libre pour les informations techniques ou de tracing.

## Output

Chaque provider publication doit renvoyer une structure equivalente aux champs
suivants :

- `requestId`
- `provider`
- `status`
- `publicationId`
- `publicationUrl`
- `warnings`
- `errors`
- `metadata`
- `timestamp`

## Output Field Notes

### requestId

Identifiant de la requete tracable entre l'agent et le provider.

### provider

Nom du provider effectivement utilise.

### status

Etat final du traitement.

Exemples :

- `ready`
- `success`
- `error`
- `disabled`

### publicationId

Identifiant de publication retourne par la plateforme si disponible.

### publicationUrl

URL finale de la publication si disponible.

### warnings

Liste des avertissements non bloquants.

### errors

Liste des erreurs bloquantes ou informatives.

### metadata

Informations de tracing, provider, plateforme ou execution.

### timestamp

Horodatage normalise de la sortie.

## Current Mock Usage

Dans cette phase, le mock provider publication ne publie aucun contenu.

Les identifiants et URLs restent donc a `N/A` ou vides.

Le contrat existe deja pour que les futurs providers reels puissent s'y
brancher sans modifier le Publisher Agent.
