# Video Provider Contract

## Role

Ce contrat definit l'entree et la sortie communes de la couche provider video.

Il doit rester independent du provider concret.

## Input

Chaque execution provider video doit pouvoir recevoir une structure equivalente
aux champs suivants :

- `requestId`
- `scenario`
- `campaignItem`
- `storyboardPath`
- `provider`
- `duration`
- `ratio`
- `locale`
- `metadata`

## Input Field Notes

### requestId

Identifiant unique de la demande provider video.

### scenario

Nom du scenario parent.

### campaignItem

Identifiant du Campaign Item source.

### storyboardPath

Chemin vers le storyboard structure deja prepare.

### provider

Provider cible demande ou resolu.

### duration

Duree cible de la video.

### ratio

Ratio ou format principal attendu.

### locale

Locale associee a la voix, aux sous-titres ou aux overlays.

### metadata

Bloc libre pour les informations techniques ou de tracing.

## Output

Chaque provider video doit renvoyer une structure equivalente aux champs
suivants :

- `requestId`
- `provider`
- `status`
- `videoPath`
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

### videoPath

Chemin final de la video generee si disponible.

### previewPath

Chemin d'un apercu, d'une miniature ou d'un rendu court si disponible.

### warnings

Liste des avertissements non bloquants.

### errors

Liste des erreurs bloquantes ou informatives.

### metadata

Informations de tracing, provider, format, cout ou execution.

### timestamp

Horodatage normalise de la sortie.

## Current Mock Usage

Dans cette phase, le mock provider video ne genere aucune video.

Les chemins video et preview restent donc a `N/A` ou vides.

Le contrat existe deja pour que les futurs providers reels puissent s'y
brancher sans modifier le Video Agent.
