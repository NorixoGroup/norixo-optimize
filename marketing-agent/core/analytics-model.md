# Analytics Model

## Role

Le modele Analytics decrit les objets metier necessaires au futur Analytics
Engine.

Il ne collecte encore aucune donnee reelle.

Il prepare uniquement la structure logique des demandes, rapports, metriques,
sources, fenetres temporelles et statuts.

## Analytics Request

### Definition

Une demande de collecte ou d'aggregation de metriques rattachee a une campagne,
une publication, une plateforme et une periode.

### Attributs minimaux

- id
- campaign cible
- publication cible
- provider cible
- plateforme cible
- locale
- time window
- statut

## Analytics Report

### Definition

Le document structure qui regroupe les metriques normalisees et les metriques
provider pour une demande donnee.

### Attributs minimaux

- id
- analytics request parent
- normalized metrics
- provider metrics
- source
- statut
- timestamp

## Metric

### Definition

Une valeur mesuree ou calculee rattachee a une campagne, une publication ou
une plateforme.

### Attributs minimaux

- nom
- categorie
- valeur
- unite eventuelle
- source

## Source

### Definition

Le systeme externe ou interne d'ou provient la metrique.

### Attributs minimaux

- id
- nom
- type
- statut

## Campaign

### Definition

La campagne parente a laquelle les metriques doivent pouvoir etre rattachees.

### Attributs minimaux

- id
- nom
- statut

## Publication

### Definition

L'unite de diffusion suivie par l'Analytics Engine.

### Attributs minimaux

- id
- campagne parente
- plateforme
- locale
- statut

## Time Window

### Definition

La periode analysee pour lire, comparer ou agreger des metriques.

### Attributs minimaux

- date de debut
- date de fin
- fuseau
- granularite eventuelle

## Provider

### Definition

Le connecteur ou systeme de collecte utilise pour recuperer des metriques.

### Attributs minimaux

- id
- nom
- type
- statut

## Status

### Definition

L'etat de preparation, collecte ou normalisation d'une demande analytics.

### Exemples

- draft
- ready
- blocked
- collected
- normalized
- failed
