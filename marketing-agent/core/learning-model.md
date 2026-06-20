# Learning Model

## Role

Le modele Learning decrit les objets metier necessaires au futur Learning
Engine.

Il ne prend encore aucune decision automatique.

Il prepare uniquement la structure logique des signaux, insights,
recommandations, candidats de decision et niveaux de confiance.

## Learning Input

### Definition

Le bloc d'entree structure qui regroupe le contexte analytics utile au moteur
d'apprentissage.

### Attributs minimaux

- id
- analytics status source
- campaign
- campaign item
- publication
- metrics
- time window
- contexte

## Learning Signal

### Definition

Un signal interpretable derive des resultats analytics.

### Attributs minimaux

- type
- source
- description
- intensite eventuelle
- statut

## Learning Insight

### Definition

Une lecture exploitable d'un ou plusieurs signaux.

### Attributs minimaux

- id
- signal parent ou signaux parents
- formulation
- impact attendu
- statut

## Recommendation

### Definition

Une proposition d'action preparee pour les futurs choix marketing.

### Attributs minimaux

- id
- insight parent
- action suggeree
- justification
- priorite

## Decision Candidate

### Definition

Une decision potentielle transmise au Marketing Brain ou a une validation
humaine.

### Attributs minimaux

- id
- recommendation parent
- type
- perimetre
- statut

## Confidence Score

### Definition

Le niveau de confiance rattache a un insight ou a une recommandation.

### Attributs minimaux

- score
- source du score
- notes

## Feedback Loop

### Definition

Le cycle reliant analytics, enseignements, recommandations et futures
decisions marketing.

### Attributs minimaux

- source analytics
- learning output
- destination marketing brain
- statut

## Status

### Definition

L'etat de preparation ou de validation d'un resultat learning.

### Exemples

- draft
- ready
- blocked
- reviewed
- approved
- rejected
