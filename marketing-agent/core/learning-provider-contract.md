# Learning Provider Contract

## Role

Ce contrat definit l'entree et la sortie communes de la couche provider
learning.

Il doit rester independent du provider concret.

## Input

Chaque execution provider learning doit pouvoir recevoir une structure
equivalente aux champs suivants :

- `requestId`
- `scenario`
- `campaignItem`
- `learningInputPath`
- `provider`
- `context`
- `metadata`

## Input Field Notes

### requestId

Identifiant unique de la demande provider learning.

### scenario

Nom du scenario parent.

### campaignItem

Identifiant du Campaign Item source.

### learningInputPath

Chemin vers la learning input deja preparee.

### provider

Provider cible demande ou resolu.

### context

Contexte additionnel transmis au moteur d'analyse.

### metadata

Bloc libre pour les informations techniques ou de tracing.

## Output

Chaque provider learning doit renvoyer une structure equivalente aux champs
suivants :

- `requestId`
- `provider`
- `status`
- `reportPath`
- `learningSignals`
- `recommendations`
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

### learningSignals

Bloc de signaux produits si un provider learning est reellement branche.

### recommendations

Bloc de recommandations produites si le provider en emet.

### warnings

Liste des avertissements non bloquants.

### errors

Liste des erreurs bloquantes ou informatives.

### metadata

Informations de tracing, provider ou execution.

### timestamp

Horodatage normalise de la sortie.

## Current Mock Usage

Dans cette phase, le mock provider learning ne produit aucun signal ni aucune
recommandation.

Le chemin de rapport reste donc a `N/A`.

Le contrat existe deja pour que les futurs providers reels puissent s'y
brancher sans modifier le Learning Agent.
