# Analytics Workflow

## Workflow cible

Campaign
|
v
Publication
|
v
Analytics Request
|
v
Analytics Collector
|
v
Analytics QA
|
v
Analytics Provider
|
v
Analytics Status
|
v
Learning Engine

## Lecture du workflow

### 1. Campaign

La campagne fixe le contexte metier et le perimetre d'analyse.

### 2. Publication

La publication fournit l'unite de diffusion rattachee aux metriques.

### 3. Analytics Request

La demande structure la collecte ciblee par plateforme, locale et periode.

### 4. Analytics Collector

Le collecteur futur recupere ou agrege les metriques depuis les sources.

### 5. Analytics QA

La QA verifie la completude, la coherence et le statut de la collecte.

### 6. Analytics Provider

Le futur provider execute ou simule la lecture des metriques.

### 7. Analytics Status

Le statut analytics permet de suivre readiness, blocages et rapports produits.

### 8. Learning Engine

Le Learning Engine recevra ensuite des donnees normalisees sans que
l'Analytics Agent ne prenne lui-meme de decision.

## Principes clefs

- aucune interpretation metier automatique dans cette phase
- la collecte doit rester distincte de l'apprentissage
- les sources et periodes doivent rester explicites
