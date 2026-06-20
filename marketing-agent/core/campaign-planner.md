# Campaign Planner

## Role

Le Campaign Planner est la couche documentaire qui prepare le travail du futur
Campaign Engine.

Il ne redige rien.

Il ne traduit rien.

Il ne publie rien.

## Mission

Le Planner :

- recoit un objectif du Marketing Brain
- choisit un type de campagne
- choisit un template de campagne
- adapte le nombre d'items
- adapte la duree
- transmet une structure exploitable au Campaign Engine

## Inputs

- objectif du Marketing Brain
- audience cible
- priorite
- plateformes recommandees
- saisonnalite
- contexte Knowledge Hub
- historique et memoire de campagne

## Decisions prises

- quel type de campagne lancer
- quel template appliquer
- combien d'items utiliser
- dans quel ordre les items doivent se suivre
- quelle duree donner a la campagne
- quels canaux privilegier

## Outputs attendus

- type de campagne retenu
- template retenu
- duree recommande
- nombre d'items recommande
- ordre logique recommande
- objectifs secondaires utiles
- instructions de passage au Campaign Engine

## Ce qu'il ne fait pas

- il ne cree pas encore la campagne finale
- il ne produit pas les contenus
- il ne choisit pas les mots ou les CTA finaux
- il ne remplace pas la validation humaine

## Relations

### Marketing Brain

Le Marketing Brain decide qu'une campagne est necessaire.

### Campaign Planner

Le Planner choisit la bonne forme strategique pour cette campagne.

### Campaign Engine

Le Campaign Engine construit ensuite la campagne exploitable a partir du plan
retenu.

## Regles

- un objectif similaire doit idealement reutiliser un template connu
- la duree doit rester proportionnee a l'enjeu
- le nombre d'items doit rester coherent avec la disponibilite des canaux
- le Planner doit preferer la simplicite a une campagne trop lourde
