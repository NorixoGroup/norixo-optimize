# Learning Contract

## Role

Ce contrat definit l'entree et la sortie communes du futur Learning Engine.

Il doit rester independent de tout moteur d'execution automatique.

## Input

Chaque execution learning doit pouvoir recevoir une structure equivalente aux
champs suivants :

- `analyticsStatus`
- `campaign`
- `campaignItem`
- `publication`
- `metrics`
- `timeWindow`
- `context`

## Input Field Notes

### analyticsStatus

Etat analytics source qui certifie la disponibilite des donnees exploitees.

### campaign

Campagne analysee ou ciblee par l'apprentissage.

### campaignItem

Item de campagne rattache au signal ou a l'insight.

### publication

Publication ou unite de diffusion associee aux mesures.

### metrics

Bloc de metriques normalisees ou selectionnees pour l'analyse.

### timeWindow

Periode sur laquelle l'apprentissage doit s'appuyer.

### context

Bloc libre pour les hypotheses, notes ou contraintes metier.

## Output

Chaque execution learning doit renvoyer une structure equivalente aux champs
suivants :

- `insights`
- `signals`
- `recommendations`
- `confidence`
- `decisionCandidates`
- `status`

## Output Field Notes

### insights

Lectures exploitables derivees des resultats observes.

### signals

Signaux identifies et relies a leurs sources.

### recommendations

Propositions d'action preparees pour le Marketing Brain.

### confidence

Niveau de confiance associe aux lectures et recommandations.

### decisionCandidates

Ensemble des decisions potentielles soumises a validation.

### status

Etat final du traitement learning.

Exemples :

- `ready`
- `reviewed`
- `blocked`
- `approved`
- `rejected`

## Current Mode

Dans cette phase, aucun moteur de decision automatique n'est branche.

Le contrat existe deja pour que les futurs outils de learning puissent s'y
brancher sans modifier le Marketing Brain.
