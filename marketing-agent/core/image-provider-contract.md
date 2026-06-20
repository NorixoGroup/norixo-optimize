# Image Provider Contract

## Role

Ce contrat definit l'entree et la sortie communes de la couche provider image.

Il doit rester independent du provider concret.

## Input

Chaque execution provider image doit pouvoir recevoir une structure equivalente
aux champs suivants :

- `requestId`
- `scenario`
- `campaignItem`
- `imagePromptPath`
- `provider`
- `format`
- `resolution`
- `locale`
- `metadata`

## Input Field Notes

### requestId

Identifiant unique de la demande provider image.

### scenario

Nom du scenario parent.

### campaignItem

Identifiant du Campaign Item source.

### imagePromptPath

Chemin vers le prompt visuel structure deja prepare.

### provider

Provider cible demande ou resolu.

### format

Format d'image demande pour la plateforme cible.

### resolution

Resolution cible attendue.

### locale

Locale associee au contenu et a l'overlay eventuel.

### metadata

Bloc libre pour les informations techniques ou de tracing.

## Output

Chaque provider image doit renvoyer une structure equivalente aux champs
suivants :

- `requestId`
- `provider`
- `status`
- `imagePath`
- `previewPath`
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

### imagePath

Chemin final de l'image generee si disponible.

### previewPath

Chemin d'un apercu ou d'une miniature si disponible.

### warnings

Liste des avertissements non bloquants.

### errors

Liste des erreurs bloquantes ou informatives.

### metadata

Informations de tracing, provider, format, cout ou execution.

### timestamp

Horodatage normalise de la sortie.

## Current Mock Usage

Dans cette phase, le mock provider image ne genere aucune image.

Les chemins image et preview restent donc a `N/A` ou vides.

Le contrat existe deja pour que les futurs providers reels puissent s'y brancher
sans modifier l'Image Agent.
