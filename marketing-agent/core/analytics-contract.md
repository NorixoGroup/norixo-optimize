# Analytics Contract

## Role

Ce contrat definit l'entree et la sortie communes du futur Analytics Engine.

Il doit rester independent des providers concrets.

## Input

Chaque demande analytics doit pouvoir recevoir une structure equivalente aux
champs suivants :

- `campaign`
- `publication`
- `provider`
- `platform`
- `locale`
- `timeWindow`

## Input Field Notes

### campaign

Identifiant ou reference de la campagne analysee.

### publication

Identifiant ou reference de la publication analysee.

### provider

Source ou provider analytics cible.

### platform

Plateforme associee a la publication ou a la mesure.

### locale

Locale rattachee au contenu mesure.

### timeWindow

Periode de collecte ou d'analyse demandee.

## Output

Chaque execution analytics doit renvoyer une structure equivalente aux champs
suivants :

- `normalizedMetrics`
- `providerMetrics`
- `report`
- `status`
- `timestamp`

## Output Field Notes

### normalizedMetrics

Bloc des metriques harmonisees entre plateformes.

### providerMetrics

Bloc des metriques brutes ou proches de la source provider.

### report

Rapport structure, lisible par les autres moteurs.

### status

Etat final de la demande analytics.

Exemples :

- `ready`
- `collected`
- `normalized`
- `blocked`
- `failed`

### timestamp

Horodatage normalise de la sortie.

## Current Mode

Dans cette phase, aucun provider analytics reel n'est branche.

Le contrat existe deja pour que les futurs collecteurs et providers puissent
s'y brancher sans modifier l'Analytics Agent.
