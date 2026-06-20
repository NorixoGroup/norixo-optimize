# Campaign Model

## Role

Le Campaign Model decrit la structure strategique utilisee par le futur
Campaign Engine.

Une campagne n'est pas un contenu.

Une campagne est un conteneur strategique qui regroupe plusieurs items,
plusieurs contenus et plusieurs actions planifiees autour d'un meme objectif.

## Objectif

Permettre a Norixo AI de decider :

- quoi produire
- quand le produire
- dans quel ordre
- sur quelles plateformes
- pour quels objectifs

## Ce qu'une campagne contient

- un identifiant
- un nom
- un objectif principal
- une audience principale
- une periode
- une liste de plateformes
- un statut global
- une liste de Campaign Items
- un Campaign Calendar local
- des liens vers contenus, localisations, assets et performances

## Attributs minimaux

- id
- nom
- objectif
- audience
- plateformes
- date de debut
- date de fin
- priorite
- statut
- owner logique
- campagne parent si applicable

## Statuts possibles

- idee
- planifiee
- en preparation
- en production
- a valider
- active
- terminee
- archivee

## Relations principales

### Marketing Brain

Le Marketing Brain decide si une campagne doit exister, pourquoi et avec quel
niveau de priorite.

### Campaign Engine

Le Campaign Engine transforme une intention strategique en campagne exploitable
et ordonnee.

### Campaign Items

Les items sont les unites d'execution de la campagne.

### Content Agent

Le Content Agent produit le contenu source a partir des items, pas a partir de
la campagne brute.

### Localization

La localisation part des contenus generes pour les items retenus.

### Image / Video

Les agents visuel et video derivent des memes items ou des memes contenus
source sans recreer une logique parallele.

### Publisher

Le Publisher prepare la diffusion a partir du Campaign Calendar et des
validations obtenues.

### Analytics

Les performances doivent pouvoir remonter a la campagne, a ses items et a ses
contenus associes.

## Regles

- une campagne ne redige jamais elle-meme
- une campagne ne traduit jamais
- une campagne ne publie jamais
- une campagne doit rester tracable
- une campagne doit pouvoir etre reliee a ses decisions, ses items et ses
  performances
