# Publisher Model

## Role

Le modele publisher decrit les objets metier necessaires au futur Publisher
Engine.

Il ne declenche aucune publication.

Il prepare uniquement la structure logique des jobs, des publications, des
plateformes, des assets, des schedules et des metadonnees.

## Publication Job

### Definition

Une demande de diffusion rattachee a un Campaign Item, une locale et une ou
plusieurs plateformes.

### Attributs minimaux

- id
- campaign item parent
- locale cible
- plateformes cibles
- statut
- date

## Publication

### Definition

Une unite de diffusion preparee pour une plateforme unique.

### Attributs minimaux

- id
- publication job parent
- plateforme cible
- contenu
- assets associes
- schedule
- statut

## Platform

### Definition

Le canal de diffusion sur lequel une publication sera preparee.

### Attributs minimaux

- id
- nom
- formats acceptes
- medias acceptes
- contraintes

## Asset

### Definition

Une ressource rattachee a une publication.

### Attributs minimaux

- id
- type
- chemin ou reference
- locale
- statut QA

## Locale

### Definition

La langue et le contexte culturel associes a une publication.

### Attributs minimaux

- code locale
- marche cible
- variante eventuelle

## Schedule

### Definition

Le plan de diffusion rattache a une publication.

### Attributs minimaux

- date
- heure
- fuseau
- priorite
- retries
- expiration
- statut

## Metadata

### Definition

Le bloc d'informations techniques ou marketing rattache a une publication.

### Attributs minimaux

- hashtags
- liens
- CTA
- tags campagne
- notes plateforme

## Status

### Definition

L'etat de preparation ou d'execution d'une publication.

### Exemples

- draft
- ready
- blocked
- scheduled
- published
- failed

## Relations

### Campaign Item

Chaque Publication Job doit remonter a un Campaign Item valide.

### Localization

Une publication s'appuie sur un contenu localise explicite.

### Image

Une publication peut embarquer un ou plusieurs assets image valides.

### Video

Une publication peut embarquer un ou plusieurs assets video valides.

### Analytics

Les performances futures doivent rester rattachables a la publication source.
