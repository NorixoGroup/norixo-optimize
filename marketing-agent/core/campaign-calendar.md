# Campaign Calendar

## Role

Le Campaign Calendar est la vue locale d'une campagne dans le temps.

Il ne remplace pas l'Editorial Calendar global.

Il permet d'organiser les items d'une campagne selon leur ordre logique et
leur cadence propre.

## Difference avec l'Editorial Calendar

### Editorial Calendar global

- gere l'equilibre editorial de Norixo dans son ensemble
- arbitre entre plusieurs campagnes et plusieurs sujets

### Campaign Calendar

- organise uniquement les items d'une campagne donnee
- precise l'ordre d'execution et de diffusion a l'interieur de cette campagne

## Informations minimales par entree

- jour
- heure
- plateforme
- langue
- format
- statut
- dependance
- validation

## Informations utiles en plus

- campaign item associe
- priorite
- objectif du slot
- variante locale si applicable
- asset requis
- commentaire de validation

## Statuts possibles

- idee
- reserve
- en preparation
- a valider
- planifie
- publie
- reporte
- annule

## Regles

- ne pas casser l'ordre logique de la campagne
- ne pas saturer une meme plateforme
- respecter les dependances entre items
- garder une trace des validations
- pouvoir remonter a l'item parent et a la campagne parente

## Usage

Le Campaign Calendar sert a :

- voir la campagne comme une sequence
- verifier les collisions internes
- preparer le travail du Publisher
- comparer le plan initial et l'execution reelle
