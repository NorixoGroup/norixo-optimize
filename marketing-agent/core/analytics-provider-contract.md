# Analytics Provider Contract

## Role

Ce contrat definit l'entree et la sortie communes de la couche provider
analytics.

Il doit rester independent du provider concret.

## Input

Chaque execution provider analytics doit pouvoir recevoir une structure
equivalente aux champs suivants :

- `requestId`
- `scenario`
- `campaignItem`
- `analyticsRequestPath`
- `provider`
- `platform`
- `locale`
- `timeWindow`
- `metadata`

## Input Field Notes

### requestId

Identifiant unique de la demande provider analytics.

### scenario

Nom du scenario parent.

### campaignItem

Identifiant du Campaign Item source.

### analyticsRequestPath

Chemin vers la demande analytics deja preparee.

### provider

Provider cible demande ou resolu.

### platform

Plateforme cible de la collecte.

### locale

Locale associee au contenu ou a la publication analysee.

### timeWindow

Periode de collecte demandee.

### metadata

Bloc libre pour les informations techniques ou de tracing.

## Output

Chaque provider analytics doit renvoyer une structure equivalente aux champs
suivants :

- `requestId`
- `provider`
- `status`
- `reportPath`
- `normalizedMetrics`
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

### reportPath

Chemin du rapport brut ou local produit si disponible.

### normalizedMetrics

Bloc de metriques harmonisees si le provider ou le collecteur en produit deja.

### warnings

Liste des avertissements non bloquants.

### errors

Liste des erreurs bloquantes ou informatives.

### metadata

Informations de tracing, provider, plateforme, fenetre temporelle ou
execution.

### timestamp

Horodatage normalise de la sortie.

## Current Mock Usage

Dans cette phase, le mock provider analytics ne collecte aucune donnee.

Le chemin de rapport reste donc a `N/A`.

Le contrat existe deja pour que les futurs providers reels puissent s'y
brancher sans modifier l'Analytics Agent.
